(function () {
const textEl = document.getElementById('hitokoto-text');
if (!textEl) return;
fetch('https://v1.hitokoto.cn/?c=a&c=b&c=c&c=d&c=i&c=k&c=j')
.then(r => r.json())
.then(d => {
textEl.textContent = '「' + d.hitokoto + '」';
const fromEl = document.getElementById('hitokoto-from');
if (fromEl && d.from) fromEl.textContent = '—— ' + d.from;
})
.catch(() => { textEl.textContent = '🌸 愿每一天都有你相伴'; });
})();
(function () {
const el = document.getElementById('weatherInfo');
if (!el) return;
fetch('https://api.open-meteo.com/v1/forecast?latitude=48.137154&longitude=11.576124&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=Europe%2FBerlin')
.then(r => r.json())
.then(d => {
const cur = d.current;
const w = (window.__WMO_WEATHER || {})[cur.weather_code];
const desc = (w && w.desc) || ('代码' + cur.weather_code);
el.textContent = desc + ' ' + cur.temperature_2m + '°C（体感' + cur.apparent_temperature + '°C）';
})
.catch(() => { el.textContent = '🌸 天气加载失败'; });
})();
(function () {
const el = document.getElementById('biliFans');
if (!el) return;
/* B站数据统一走 GitHub Actions 同步的 data/bili/stats.json（bilibili API 无 CORS 头，浏览器直连会被拦截） */
fetch('data/bili/stats.json?v=' + Date.now())
.then(r => r.json())
.then(d => {
const rel = d.relation || {};
if (typeof rel.follower === 'number') el.textContent = rel.follower >= 10000 ? (rel.follower / 10000).toFixed(2) + ' 万' : String(rel.follower);
/* B站资料卡：昵称 + LV + 头像 + 全站在线 */
const card = d.card || {};
const nm = document.getElementById('biliName');
if (nm && card.name) nm.textContent = card.name + (card.level ? ' · LV' + card.level : '');
const av = document.getElementById('biliAvatar');
if (av && card.face) {
av.src = card.face;
av.onload = function () { av.style.display = 'inline-block'; };
}
const ol = document.getElementById('biliOnline');
if (ol && d.online && typeof d.online.total === 'number') {
ol.textContent = d.online.total >= 10000 ? ('B站全站 ' + (d.online.total / 10000).toFixed(1) + ' 万人在线') : ('B站全站 ' + d.online.total + ' 人在线');
}
/* B站数据时效标注（打包/同步快照透明化） */
const sc = document.getElementById('biliSync');
if (sc && d.updated_at) {
  const t = new Date(d.updated_at);
  if (!isNaN(t.getTime())) {
    sc.textContent = '数据更新于 ' + (t.getMonth() + 1) + '月' + t.getDate() + '日 ' + (t.getHours() < 10 ? '0' : '') + t.getHours() + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
  }
}
})
.catch(() => { el.textContent = '🌸 数据稍后同步'; });
})();
(function () {
/* loliapi 随机二次元图作背景（Bing HPImageArchive 不带 CORS 头，浏览器端无法使用，已替换） */
const url = 'https://www.loliapi.com/acg/?t=' + Date.now();
const img = new Image();
img.onload = function () {
document.body.style.backgroundImage = 'linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.82)), url("' + url + '")';
document.body.style.backgroundSize = 'cover';
document.body.style.backgroundPosition = 'center';
document.body.style.backgroundAttachment = 'fixed';
};
img.src = url;
})();
(function () {
const el = document.getElementById('gitHubInfo');
if (!el) return;
fetch('https://api.github.com/users/U1s1-king')
.then(r => r.json())
.then(d => {
if (d.public_repos === undefined) throw new Error('bad');
el.textContent = d.public_repos + ' 个仓库 · ' + d.followers + ' 粉丝';
})
.catch(() => { el.textContent = '🌸 加载失败'; });
})();