/* ============================================================
 * 音乐站「网易云主推 + 能真的放出声」回归测试
 * ------------------------------------------------------------
 * 背景：
 *   1. 网易云在这条路上三个取链来源全是死的 ——
 *      网关 /api/search 的 url 是空串；网关 /api/url 期望镜像直接返回
 *      地址字符串，但 Meting 系镜像是 **302 跳转**，网关解析不出来，
 *      于是报「所有镜像都拿不到播放地址」502；GDStudio 网易云也返回空。
 *      结果：搜索结果根本带不出播放地址。
 *   2. 而 PO 搜索界面是 **直接拿 song.url 当播放地址** 的，
 *      所以网易云的歌点播放/下载必然失败。
 *   3. 平台优先级还是 B站 置顶，与「主推网易云」相反。
 *
 * 修法：把 Meting 的 type=url 当成播放地址本身（它会 302 到真实 CDN，
 *       <audio> / 下载器自己会跟随跳转），在 makeSong 里按 id 补上。
 *
 * 用法: node tools/test-netease.js
 * ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
/* 必须用网关 CORS 白名单里的端口，否则从本地页调 gateway 全是 "Failed to fetch"
   （白名单见 cloudflare/music-api/_worker.js 的 SITE_ORIGINS） */
const PORT = 8899;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

/* 跟随 302 到最后一跳，报出播放器真正看到的东西 */
async function probe(u) {
  let cur = u, hops = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-1023' } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      hops.push(r.status + ' -> ' + r.headers.get('location').slice(0, 60));
      cur = new URL(r.headers.get('location'), cur).href;
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return { hops, code: r.status, ct: r.headers.get('content-type') || '', len: buf.length, magic: buf.slice(0, 3).toString('latin1') };
  }
  return { hops, code: 0, ct: '(跳转过多)', len: 0, magic: '' };
}

let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m + (x ? '  ' + x : '')); } };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  /* 用真实来源的测试页，而不是 page.setContent —— setContent 的 Origin 是 null，
     网关会拒掉，搜出来全是 "Failed to fetch"，测不到真东西。 */
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
  p.on('pageerror', e => errs.push(e.message));

  /* 只装 music-api.js，不加载整站（整站有一堆外部 live2d / 统计脚本，慢且吵） */
  await p.goto('http://127.0.0.1:' + PORT + '/__t.html', { waitUntil: 'domcontentloaded' });
  await sleep(500);

  const has = await p.evaluate(() => !!window.MusicAPI);
  ok(has, 'MusicAPI 已加载');
  if (!has) { await b.close(); server.close(); process.exit(1); }

  /* ---------- 1) 网易云搜索必须带出可播地址 ---------- */
  console.log('\n【网易云】搜索 -> 播放地址');
  const songs = await p.evaluate(async () => {
    try {
      const r = await window.MusicAPI.searchOne('netease', '晴天', { limit: 5 });
      return (r || []).map(s => ({ name: s.name, artist: s.artist, id: s.id, url: s.url || '' }));
    } catch (e) { return [{ err: String(e && e.message || e) }]; }
  });
  if (songs[0] && songs[0].err) { ok(false, '搜索没抛错', songs[0].err); }
  else {
    ok(songs.length > 0, '搜到 ' + songs.length + ' 首');
    const withUrl = songs.filter(s => /^https?:\/\//.test(s.url));
    console.log('  样例: ' + JSON.stringify(songs[0], null, 0));
    ok(withUrl.length === songs.length, '每首都带上了播放地址 (' + withUrl.length + '/' + songs.length + ')');
    ok(songs.every(s => /api\.qijieya\.cn\/meting\/\?server=netease&type=url&id=/.test(s.url)),
       '地址是按 id 拼的 Meting 代理链');
  }

  /* ---------- 2) 那条地址真的能出音频 ---------- */
  console.log('\n【网易云】代理链真实出流');
  const u0 = songs[0] && songs[0].url;
  if (u0) {
    const r = await probe(u0);
    r.hops.forEach(h => console.log('  跳转 ' + h));
    console.log('  最终 code=' + r.code + ' ct=' + r.ct + ' len=' + r.len + ' magic=' + JSON.stringify(r.magic));
    ok(r.code === 200 || r.code === 206, '最终 2xx');
    ok(/audio|octet/i.test(r.ct), 'content-type 是音频');
  } else ok(false, '没有地址可验证');

  /* ---------- 3) 歌单 / 排行榜的曲目也要能播（makeSong 是必经之路） ---------- */
  console.log('\n【覆盖】歌单 / 排行榜曲目');
  const made = await p.evaluate(() => {
    /* 直接验 makeSong：网关给的歌（url 空）必须被补上 */
    const s = window.MusicAPI.fromGateway({ platform: 'netease', id: '2652820720', name: 'x' });
    const s2 = window.MusicAPI.fromGateway({ platform: 'netease', id: '', name: 'y' });
    return { filled: s.url, empty: s2.url };
  });
  console.log('  有 id  : ' + made.filled);
  console.log('  无 id  : ' + JSON.stringify(made.empty));
  ok(/^https:\/\/api\.qijieya/.test(made.filled), 'makeSong 补上了代理链（排行榜/歌单同样受益）');
  ok(made.empty === '', '没有 id 时不硬凑，交给 songUrlCandidates 兜底');

  /* ---------- 4) 网关解包：不许再双重解包 ---------- */
  console.log('\n【网关解包】search 必须走 gateway() 已经拆好的形状');
  const gwSrc = fs.readFileSync(path.join(ROOT, 'js/music-api.js'), 'utf8');
  ok(/Array\.isArray\(d\) \? d : \(\(d && d\.songs\) \|\| \[\]\)/.test(gwSrc),
     'search 对「数组 / {songs}」两种形状都兼容');

  /* ---------- 5) 平台优先级：网易云在 B站 前面 ---------- */
  console.log('\n【优先级】主推网易云');
  const src = fs.readFileSync(path.join(ROOT, 'js/music-bundle.js'), 'utf8');
  const m = /PO_PLATFORM_ORDER\s*=\s*\[([^\]]+)\]/.exec(src);
  const order = m ? m[1].split(',').map(x => x.trim().replace(/['"]/g, '')) : [];
  console.log('  PO_PLATFORM_ORDER = [' + order.join(', ') + ']');
  ok(order[0] === 'netease', '网易云排第一');
  ok(order.indexOf('bilibili') > 0, 'B站 仍在列表里但不再是第一');

  const rm = /var PLATFORM_RANK = \{([^}]+)\}/.exec(src);
  const rank = rm ? rm[1] : '';
  ok(/netease:\s*0/.test(rank), 'PLATFORM_RANK 里 netease=0');
  ok(/bilibili:\s*1/.test(rank), 'PLATFORM_RANK 里 bilibili=1');
  ok(!/B站固定置顶/.test(src), '过时注释「B站固定置顶」已清掉');

  /* ---------- 5) 镜像池里不留死链 ---------- */
  console.log('\n【镜像池】');
  /* 只看**代码**：注释里提到死镜像的名字是好事（说明记下了为什么不用），
     所以先剥掉注释再断言，否则注释会把测试带跑偏。
     块注释要按 / * ... * / 整体剥，光看行首是漏的。 */
  const strip = s => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

  const apiSrc = fs.readFileSync(path.join(ROOT, 'js/music-api.js'), 'utf8');
  const workerSrc = fs.readFileSync(path.join(ROOT, 'cloudflare/music-api/_worker.js'), 'utf8');
  const codeSrc = strip(src), codeApi = strip(apiSrc);
  const backup = (/var PO_BACKUP\s*=\s*'([^']+)'/.exec(src) || [])[1] || '';
  ok(/api\.injahow\.cn\/meting\//.test(backup), 'PO_BACKUP 已换成实测可用的 injahow');
  ok(!/musicapi\.qijieya\.cn/.test(codeSrc), 'music-bundle 代码里已无 521 的 musicapi.qijieya.cn');

  const sm = (/var STREAM_MIRRORS = \[([^\]]+)\]/.exec(apiSrc) || [])[1] || '';
  const mirrors = sm.replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean);
  console.log('  STREAM_MIRRORS = ' + JSON.stringify(mirrors));
  ok(mirrors.indexOf('https://api.qijieya.cn/meting/') >= 0, 'qijieya 在池中');
  ok(mirrors.indexOf('https://api.injahow.cn/meting/') >= 0, 'injahow 在池中');
  ok(!/musicapi\.qijieya\.cn|meting\.qjqq\.cn|music\.xianqiao\.wang/.test(mirrors.join(',')),
     '池中没有已死的镜像');

  /* ---------- 6) 网关侧：读不到跳转目标时不能把镜像判死 ---------- */
  console.log('\n【网关 Worker】跳转读不到时的退化');
  ok(/opaqueredirect/.test(workerSrc), '处理了 Workers 的 opaque 重定向');
  ok(/data: \{ url: target \}/.test(workerSrc), '退化时交出镜像地址本身（客户端自己跟随跳转）');
  ok(/返回 HTML 错误页/.test(workerSrc), 'HTML 错误页仍会被判死、换下一个镜像');
  const wm = (/const METING_MIRRORS = \[([^\]]+)\]/.exec(workerSrc) || [])[1] || '';
  /* ⚠️ 解析前必须先剥掉数组里的注释 —— 否则注释会被当成一个「元素」，
     导致 indexOf('https://meting.qjqq.cn/') 匹配不到（元素里混了注释文本），
     断言就变成了和 -1 比较。写死链的说明是好事，但不能把测试带跑偏。 */
  const wlist = wm.replace(/\/\*[\s\S]*?\*\//g, '')
    .split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean);
  console.log('  METING_MIRRORS = ' + JSON.stringify(wlist));
  ok(wlist[0] === 'https://api.qijieya.cn/meting/', 'qijieya 排第一');
  ok(wlist.indexOf('https://api.injahow.cn/meting/') < wlist.indexOf('https://meting.qjqq.cn/'),
     'injahow 排在已 522 的 qjqq 前面');

  console.log('\n【JS 错误】');
  ok(errs.length === 0, '无页面错误', errs.join(' | '));

  console.log('\n================ ' + pass + ' 通过 / ' + fail + ' 失败 ================');
  await b.close();
  server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩了:', e); process.exit(1); });
