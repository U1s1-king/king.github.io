/* ============================================================
 * 兜底音源回归测试
 * ------------------------------------------------------------
 * 两个第三方兜底（都是自己实测挑出来的）：
 *   • ncm.landdy.cn  网易云公共增强实例 —— 按 id 给直链。**时好时坏**，只配当兜底
 *   • buguyy.top     聚合站，返回酷我 CDN 直链 —— 按**歌名**搜
 *
 * 要守住的几件事：
 *   1. 兜底能通（从**网关这个出口**，不是从我这台机器 —— 这是关键差别）
 *   2. 必须升成 https（网站是 https 页面，http 音频会被混合内容拦掉）
 *   3. 歌名对不上必须拒绝（聚合站爱用同名翻唱顶替，会「点 A 放 B」）
 *   4. 主链路正常时**不能**用到兜底、也不能被拖慢
 *
 * 用法: node tools/test-backups.js
 * ============================================================ */
const https = require('https');
const GW = 'https://sakura-music-api.pages.dev';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m + (x ? '  ' + x : '')); } };

function get(url) {
  return new Promise(r => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cache-Control': 'no-cache' }, timeout: 40000 }, x => {
      const c = []; x.on('data', d => c.push(d)); x.on('end', () => r({ code: x.statusCode, body: Buffer.concat(c).toString() }));
    }).on('error', e => r({ code: 0, body: 'ERR ' + e.message })).on('timeout', function () { this.destroy(); r({ code: 0, body: 'TIMEOUT' }); });
  });
}
function audio(url) {
  return new Promise(r => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Range: 'bytes=0-2047' }, timeout: 25000 }, x => {
      x.once('data', d => { const o = { code: x.statusCode, ct: x.headers['content-type'] || '', magic: d.slice(0, 3).toString('latin1') }; x.destroy(); r(o); });
      x.on('end', () => r({ code: x.statusCode, ct: x.headers['content-type'] || '', magic: '' }));
    }).on('error', e => r({ code: 0, err: e.message })).on('timeout', function () { this.destroy(); r({ code: 0, err: 'TIMEOUT' }); });
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('=== 用 /api/backup-check 从**网关出口**探测兜底源 ===');
  const check = async (q) => {
    const r = await get(GW + '/api/backup-check?' + q + '&_=' + Date.now());
    try { return JSON.parse(r.body).data || {}; } catch (e) { return { hit: false, errors: ['解析失败 ' + r.body.slice(0, 60)] }; }
  };

  /* ---------- 1) buguyy：按歌名 ---------- */
  console.log('\n【buguyy（酷我兜底）】');
  const k = await check('server=kuwo&name=' + encodeURIComponent('晴天') + '&artist=' + encodeURIComponent('周杰伦'));
  console.log('  ' + JSON.stringify(k).slice(0, 200));
  ok(k.hit, '从网关出口能拿到地址', JSON.stringify(k.errors || []).slice(0, 120));
  if (k.hit) {
    ok(/^https:\/\//.test(k.url), '是 https（http 会被混合内容拦掉）', k.url.slice(0, 40));
    const a = await audio(k.url);
    console.log('  出流 code=' + a.code + ' ct=' + a.ct + ' magic=' + JSON.stringify(a.magic));
    ok(a.code === 200 || a.code === 206, '真能出音频');
  }

  /* ---------- 2) 歌名对不上必须拒绝 ---------- */
  console.log('\n【防「点 A 放 B」】');
  const bad = await check('server=kuwo&name=' + encodeURIComponent('这首歌根本不存在xyzqwe123'));
  console.log('  ' + JSON.stringify(bad).slice(0, 160));
  ok(!bad.hit, '不存在的歌名被拒绝（没拿别的歌来顶）');

  /* ---------- 3) landdy：按 id ----------
     它是个第三方公共实例，**实测很抖**：同一分钟里从本机 4/4 成功、
     从 CF Worker 连续 3 次 522。所以这里**不写「必须成功」**（那会让 CI 随机红），
     只断言「行为正确」：要么给出 https 直链且真能出音频，要么干净地报错、不抛异常。
     兜底源的价值就在于「失败也不影响主链路」——这正是要守住的性质。 */
  console.log('\n【landdy（网易云兜底）】—— 第三方，本身很抖，只验「行为正确」');
  let li = null, le = null;
  for (let i = 0; i < 3 && !li; i++) {
    const l = await check('server=netease&id=33894312');
    if (l.hit) li = l; else le = l;
    await sleep(700);
  }
  if (li) {
    console.log('  通了: ' + li.url.slice(0, 88));
    ok(/^https:\/\//.test(li.url), '给出的地址是 https');
    const a = await audio(li.url);
    console.log('  出流 code=' + a.code + ' ct=' + a.ct + ' magic=' + JSON.stringify(a.magic));
    ok(a.code === 200 || a.code === 206, '真能出音频');
  } else {
    console.log('  三次都没通（正常现象，它就是这么抖）：' + JSON.stringify((le && le.errors) || []).slice(0, 100));
    ok(!le.hit && Array.isArray(le.errors) && le.errors.length > 0,
       '失败时干净地返回错误列表（不崩、不影响主链路）');
  }

  /* ---------- 4) 主链路正常时不该用兜底、也不该被拖慢 ---------- */
  console.log('\n【主链路不受影响】');
  const t0 = Date.now();
  const r = await get(GW + '/api/url?id=2652820720&server=netease');
  const ms = Date.now() - t0;
  let d = {}; try { d = JSON.parse(r.body).data || {}; } catch (e) {}
  console.log('  code=' + r.code + ' 耗时=' + ms + 'ms backup=' + d.backup + ' mirror=' + (d.mirror || '?'));
  ok(r.code === 200, '正常取链成功');
  ok(!d.backup, '走的是主链路，没有动用到兜底');
  ok(ms < 3000, '没有被兜底拖慢（' + ms + 'ms）');

  console.log('\n================ ' + pass + ' 通过 / ' + fail + ' 失败 ================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩了:', e); process.exit(1); });
