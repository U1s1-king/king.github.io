#!/usr/bin/env node
/* ============================================================
 * 音乐音频域名迁移的回归测试
 * ------------------------------------------------------------
 * 防的是一次**真实存在过的事故**：
 *
 *   js/music-bundle.js 的 favKey() 给官方歌曲用的 key 是 "o:" + s.path，
 *   而 path 里**带着完整域名**。2026-09-24 网关宿主从
 *   sakura-music-api.pages.dev 换成 zhaokening.ccwu.cc 时，如果只改
 *   MUSIC_BASE 而不迁移 localStorage，老用户存下的
 *       "o:https://sakura-music-api.pages.dev/music/x.mp3"
 *   就永远匹配不上新生成的
 *       "o:https://zhaokening.ccwu.cc/music/x.mp3"
 *   —— 表现为「收藏整体消失」，而且刷新也不会恢复（key 会重新算成新的）。
 *
 * 所以 music-bundle.js 里有一段 migrateLegacyMusicHost() 做旧域名改写。
 * 这个测试**把那段代码原文从源文件里抠出来跑**，而不是另抄一份逻辑 ——
 * 抄一份的话，源文件改了测试还是绿的，等于没测。
 *
 * 用法：node tools/test-music-migration.js
 * 退出码非 0 表示迁移逻辑坏了，不要发布。
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.dirname(__dirname);
const BUNDLE = path.join(ROOT, 'js', 'music-bundle.js');
const SRC = fs.readFileSync(BUNDLE, 'utf8');

/* ---- 抠出迁移代码 ---- */
const start = SRC.indexOf('const MUSIC_HOST');
const marker = SRC.indexOf('migrateLegacyMusicHost');
const end = SRC.indexOf('})();', marker) + 5;
if (start < 0 || marker < 0 || end < 5) {
  console.error('❌ 没找到 migrateLegacyMusicHost，js/music-bundle.js 结构变了');
  process.exit(1);
}
const snippet = SRC.slice(start, end);

/* ---- 域名从源文件读，不写死：以后再换域名，这个测试自动跟着走 ---- */
const grab = (name) => {
  const m = new RegExp("const " + name + "\\s*=\\s*'([^']+)'").exec(SRC);
  if (!m) { console.error('❌ 读不到 ' + name); process.exit(1); }
  return m[1];
};
const NEW = grab('MUSIC_HOST');
const OLD = grab('LEGACY_MUSIC_HOST');
if (NEW === OLD) {
  console.error('❌ MUSIC_HOST 与 LEGACY_MUSIC_HOST 相同，迁移会变成空操作');
  process.exit(1);
}

/* ---- 模拟 localStorage ---- */
function mockLS(seed) {
  const store = Object.assign({}, seed || {});
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _dump: () => store,
  };
}
const run = (ls) =>
  new Function('localStorage', snippet + '; return { MUSIC_HOST, LEGACY_MUSIC_HOST, MUSIC_BASE };')(ls);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  ' + extra : '')); }
}

console.log('源文件域名：NEW = ' + NEW + '   OLD = ' + OLD);

/* ---- 场景 1：老用户，收藏 + 自建歌单都还存着旧域名 ---- */
{
  const oldFavs = [
    'o:' + OLD + '/music/米津玄師 - Lemon.mp3',
    'o:' + OLD + '/music/AIscream.mp3',
    'p:netease:18214',
    'u:' + OLD + '/some/uploaded.mp3',   // 不是我们的路径，必须原样保留
  ];
  const oldList = [
    { name: 'Lemon', artist: '米津玄師', path: OLD + '/music/米津玄師 - Lemon.mp3' },
    { name: '本地歌', artist: '', path: 'file:///storage/emulated/0/x.mp3' },
  ];
  const ls = mockLS({
    sakuraFavs: JSON.stringify(oldFavs),
    sakuraUserPlaylist: JSON.stringify(oldList),
  });
  const exp = run(ls);
  const d = ls._dump();
  const favs = JSON.parse(d.sakuraFavs);
  const list = JSON.parse(d.sakuraUserPlaylist);

  console.log('\n---- 场景 1：老用户数据迁移 ----');
  check('MUSIC_BASE 指向新域名', exp.MUSIC_BASE === NEW + '/music/', exp.MUSIC_BASE);
  check('官方收藏 1 已改写', favs[0] === 'o:' + NEW + '/music/米津玄師 - Lemon.mp3', favs[0]);
  check('官方收藏 2 已改写', favs[1] === 'o:' + NEW + '/music/AIscream.mp3', favs[1]);
  check('在线收藏未被动', favs[2] === 'p:netease:18214', favs[2]);
  check('非本域名的条目未被动', favs[3].indexOf(OLD) >= 0, favs[3]);
  check('自建歌单 path 已改写', list[0].path === NEW + '/music/米津玄師 - Lemon.mp3', list[0].path);
  check('自建歌单本地 path 未被动', list[1].path.indexOf('file:///') === 0, list[1].path);
  check('官方收藏里的旧域名已消失', !favs[0].includes(OLD) && !favs[1].includes(OLD));

  /* 最要紧的一条：迁移后的 key 必须等于新代码算出来的 favKey。
     这一条不过，就是「用户收藏全没了」。 */
  const newKey = 'o:' + exp.MUSIC_HOST + '/music/米津玄師 - Lemon.mp3';
  check('迁移后的收藏 key == 新代码算出的 favKey', favs[0] === newKey, favs[0] + ' vs ' + newKey);
}

/* ---- 场景 2：全新用户，不该凭空写数据 ---- */
{
  const ls = mockLS();
  run(ls);
  const d = ls._dump();
  console.log('\n---- 场景 2：全新用户 ----');
  check('不凭空写入 sakuraFavs', d.sakuraFavs === undefined);
  check('不凭空写入歌单', d.sakuraUserPlaylist === undefined);
}

/* ---- 场景 3：已经迁移过的用户，再跑必须幂等 ---- */
{
  const ls = mockLS({ sakuraFavs: JSON.stringify(['o:' + NEW + '/music/AIscream.mp3']) });
  run(ls); run(ls);
  console.log('\n---- 场景 3：幂等性 ----');
  check('新域名不被二次改写',
    JSON.parse(ls._dump().sakuraFavs)[0] === 'o:' + NEW + '/music/AIscream.mp3');
}

/* ---- 场景 4：localStorage 里是坏 JSON，不能把页面搞崩 ---- */
{
  const ls = mockLS({ sakuraFavs: '{不是合法 JSON', sakuraUserPlaylist: '[]]' });
  let threw = null;
  try { run(ls); } catch (e) { threw = e; }
  console.log('\n---- 场景 4：坏数据容错 ----');
  check('坏 JSON 不抛异常', threw === null, threw ? String(threw) : '');
}

console.log('\n================ 汇总 ================');
console.log('通过 ' + pass + ' / 失败 ' + fail);
if (fail) {
  console.log('\n迁移逻辑有问题，**不要发布** —— 老用户的收藏会整体消失。');
  process.exit(1);
}
console.log('全部通过。');
