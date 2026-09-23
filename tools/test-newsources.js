/* ============================================================
 * 新增音源回归测试：Audius / 喜马拉雅
 * ------------------------------------------------------------
 * 这两个源的特点（也是选它们的理由）：
 *   • 搜索结果里**直接带播放地址** -> 播放前不用第二次请求
 *   • 都发 CORS 头 -> 浏览器可直连，**不需要经过自建网关**
 *   • 补的是我们原来完全没有的品类：独立音乐 / 有声书播客
 *
 * 用法: node tools/test-newsources.js
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8896;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

async function probe(u) {
  let cur = u, hops = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1023' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      hops.push(r.status + ' -> ' + r.headers.get('location').slice(0, 55));
      cur = new URL(r.headers.get('location'), cur).href;
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { hops, code: r.status, ct: r.headers.get('content-type') || '', magic: buf.slice(0, 3).toString('latin1') };
  }
  return { hops, code: 0, ct: '(跳转过多)', magic: '' };
}

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m + (x ? '  ' + x : '')); } };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__t.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<!doctype html><meta charset="utf-8"><title>t</title><script src="/js/music-api.js"></script>');
  }
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nope'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 140)));

  await p.goto('http://127.0.0.1:' + PORT + '/__t.html', { waitUntil: 'domcontentloaded' });
  await sleep(400);
  ok(await p.evaluate(() => !!window.MusicAPI), 'MusicAPI 已加载');

  /* ---------- 注册情况 ---------- */
  console.log('\n【注册】');
  const plat = await p.evaluate(() => window.MusicAPI.PLATFORMS.map(x => x[0]));
  console.log('  PLATFORMS = ' + plat.join(', '));
  ok(plat.indexOf('audius') >= 0, 'audius 已注册');
  ok(plat.indexOf('ximalaya') >= 0, 'ximalaya 已注册');
  const src = fs.readFileSync(path.join(ROOT, 'js/music-bundle.js'), 'utf8');
  ok(/PLATFORM_RANK = \{[^}]*audius: 7[^}]*ximalaya: 8/.test(src), 'PLATFORM_RANK 已加');
  ok(/PO_PLATFORM_ORDER = \[[^\]]*'audius'[^\]]*'ximalaya'\]/.test(src), 'PO_PLATFORM_ORDER 已加');
  const html = fs.readFileSync(path.join(ROOT, 'music.html'), 'utf8');
  ok(/<option value="audius">/.test(html) && /<option value="ximalaya">/.test(html), 'music.html 下拉已加');

  /* ---------- 数据源真实性 ---------- */
  for (const [pid, kw, label] of [['audius', 'lofi', 'Audius'], ['ximalaya', '罗翔', '喜马拉雅']]) {
    console.log('\n【' + label + '】搜索');
    const songs = await p.evaluate(async ([pl, k]) => {
      try {
        const r = await window.MusicAPI.searchOne(pl, k, { limit: 5 });
        return (r || []).map(s => ({ name: s.name, artist: s.artist, id: s.id, url: s.url || '', dur: s.duration }));
      } catch (e) { return [{ err: String((e && e.message) || e) }]; }
    }, [pid, kw]);
    if (songs[0] && songs[0].err) { ok(false, '搜索没抛错', songs[0].err); continue; }
    ok(songs.length > 0, '搜到 ' + songs.length + ' 条');
    if (!songs[0]) continue;
    console.log('  样例: ' + JSON.stringify(songs[0]).slice(0, 160));
    const withUrl = songs.filter(s => /^https:\/\//.test(s.url));
    ok(withUrl.length === songs.length, '每首都带 **https** 播放地址 (' + withUrl.length + '/' + songs.length + ')');
    if (!withUrl.length) { ok(false, '一条可播的都没有，跳过出流验证'); continue; }

    console.log('  ' + label + ' 真实出流');
    const r = await probe(withUrl[0].url);
    r.hops.forEach(h => console.log('    跳转 ' + h));
    console.log('    最终 code=' + r.code + ' ct=' + r.ct + ' magic=' + JSON.stringify(r.magic));
    ok(r.code === 200 || r.code === 206, '最终 2xx');
    ok(/audio|octet/i.test(r.ct), 'content-type 是音频');
  }

  /* ---------- 喜马拉雅必须是 https（否则混合内容被拦） ---------- */
  console.log('\n【喜马拉雅】地址协议 + 付费过滤');
  const x = await p.evaluate(async () => {
    const r = await window.MusicAPI.searchOne('ximalaya', '周杰伦', { limit: 10 });
    return (r || []).map(s => s.url);
  });
  console.log('  ' + JSON.stringify(x.map(u => u.slice(0, 46))));
  ok(x.length > 0, '搜「周杰伦」有可播结果');
  ok(x.every(u => u.indexOf('https://') === 0), '全部升成 https（http 会被浏览器拦）');
  ok(x.every(u => u.length > 10), '没有空地址（拿不到流的已被过滤掉）');
  /* 喜马拉雅上一页可能整页都是付费节目 —— 那时返回 0 条是**正确**的，
     不是 bug。所以这里只断言「过滤真的在起作用」，不要求每个词都有结果。 */
  const paid = await p.evaluate(async () => {
    const r = await window.MusicAPI.searchOne('ximalaya', '有声书', { limit: 10 });
    return (r || []).filter(s => !s.url).length;
  });
  ok(paid === 0, '整页付费的关键词不会混进空地址条目（实测「有声书」整页付费）');

  console.log('\n【JS 错误】');
  ok(errs.length === 0, '无页面错误', errs.join(' | '));

  console.log('\n================ ' + pass + ' 通过 / ' + fail + ' 失败 ================');
  await b.close();
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩了:', e); process.exit(1); });
