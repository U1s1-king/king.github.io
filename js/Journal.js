(function () {
const textEl = document.getElementById('poemText');
if (!textEl) return;
/* 一言 API（替代已失效的 jinrishici 今日诗词）；c=d 取文学向句子 */
fetch('https://v1.hitokoto.cn/?c=d&c=i')
.then(r => r.json())
.then(d => {
textEl.textContent = '「' + d.hitokoto + '」';
const fromEl = document.getElementById('poemFrom');
if (fromEl) fromEl.textContent = '—— ' + (d.from_who || '佚名') + ' · ' + (d.from || '一言');
})
.catch(() => { textEl.textContent = '🌸 诗和远方，都在心里'; });
})();
(function () {
const tempEl = document.getElementById('jwTemp');
if (!tempEl) return;
const descEl = document.getElementById('jwDesc');
const iconEl = document.getElementById('jwIcon');
const adviceEl = document.getElementById('jwAdvice');
fetch('https://api.open-meteo.com/v1/forecast?latitude=48.137154&longitude=11.576124&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=Europe%2FBerlin')
.then(r => r.json())
.then(d => {
const cur = d.current;
const w = (window.__WMO_WEATHER || {})[cur.weather_code];
const info = w ? [w.icon, w.desc, w.tip] : ['🌸', '天气', '祝你好心情'];
iconEl.textContent = info[0];
tempEl.textContent = cur.temperature_2m + '°C';
descEl.textContent = info[1] + ' · 最高 ' + d.daily.temperature_2m_max[0] + '°C / 最低 ' + d.daily.temperature_2m_min[0] + '°C';
adviceEl.textContent = info[2];
})
.catch(() => { tempEl.textContent = '获取失败'; descEl.textContent = '🌸 天气服务暂时走丢了'; });
})();
(function () {
const btns = document.querySelectorAll('.mood-btn');
if (!btns.length) return;
const logEl = document.getElementById('moodLog');
const streakEl = document.getElementById('moodStreak');
const KEY = 'moodRecords';
function todayKey() {
const d = new Date();
return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function load() {
try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function calcStreak(records) {
let streak = 0;
const d = new Date();
for (let i = 0; i < 365; i++) {
const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
if (records[key]) { streak++; d.setDate(d.getDate() - 1); }
else break;
}
return streak;
}
const records = load();
const tKey = todayKey();
if (records[tKey]) {
btns.forEach(b => {
if (b.dataset.mood === records[tKey]) b.classList.add('active');
});
logEl.textContent = '🌸 今天的心情是 ' + records[tKey] + '，要好好照顾自己呀';
}
const streak = calcStreak(records);
streakEl.textContent = streak > 0 ? ('已连续打卡 ' + streak + ' 天') : '🌸 今天还没打卡';
btns.forEach(btn => {
btn.addEventListener('click', () => {
const mood = btn.dataset.mood;
records[tKey] = mood;
localStorage.setItem(KEY, JSON.stringify(records));
btns.forEach(b => b.classList.toggle('active', b.dataset.mood === mood));
logEl.textContent = '🌸 今天的心情是 ' + mood + '，要好好照顾自己呀';
const s = calcStreak(records);
streakEl.textContent = s > 0 ? ('已连续打卡 ' + s + ' 天') : '🌸 打卡成功！';
});
});
})();
(function () {
const dateEl = document.getElementById('lunarDate');
if (!dateEl || typeof Solar === 'undefined') return;
try {
const solar = Solar.fromDate(new Date());
const lunar = solar.getLunar();
const infoEl = document.getElementById('lunarInfo');
const yjEl = document.getElementById('lunarYiJi');
dateEl.textContent = lunar.getYearInChinese() + '年 ' + lunar.getMonthInChinese() + '月 ' + lunar.getDayInChinese();
const jieqi = lunar.getJieQi();
let info = '生肖 ' + lunar.getYearShengXiao() + ' · ' + lunar.getYearInGanZhi() + '年';
if (jieqi) info += ' · ' + jieqi;
infoEl.textContent = info;
const yi = lunar.getDayYi();
const ji = lunar.getDayJi();
if (yi && yi.length) {
yjEl.innerHTML = '<div class="yj-yi">🌸 宜 ' + yi.slice(0, 4).join('、') + '</div>';
}
if (ji && ji.length) {
yjEl.innerHTML += '<div class="yj-ji"> 忌 ' + ji.slice(0, 4).join('、') + '</div>';
}
} catch (e) {
dateEl.textContent = '🌸 农历加载失败';
}
})();
(function () {
const el = document.getElementById('cdNum');
if (!el) return;
function update() {
const now = new Date();
const target = new Date(2027, 0, 1, 0, 0, 0);
const diff = target - now;
if (diff <= 0) { el.textContent = '新年快乐喵！'; return; }
const days = Math.floor(diff / 86400000);
const hours = Math.floor((diff % 86400000) / 3600000);
const mins = Math.floor((diff % 3600000) / 60000);
const secs = Math.floor((diff % 60000) / 1000);
el.textContent = days + ' 天 ' + hours + ' 时 ' + mins + ' 分 ' + secs + ' 秒';
}
update();
setInterval(update, 1000);
})();
(function () {
const enEl = document.getElementById('wordEn');
const phEl = document.getElementById('wordPhonetic');
const defEl = document.getElementById('wordDef');
const exEl = document.getElementById('wordExample');
const refreshBtn = document.getElementById('wordRefreshBtn');
if (!enEl) return;
async function loadWord() {
enEl.textContent = '🌸 寻找单词中...';
defEl.textContent = '';
exEl.textContent = '';
phEl.textContent = '';
try {
/* 词表内置（random-word-api.herokuapp 已随 Heroku 免费层下线），释义用 MyMemory 翻译 API（dictionaryapi.dev 亦已不可达） */
const WORDS = ['sakura','blossom','melody','breeze','twilight','harbor','voyage','lantern','serene','wander','ember','velvet','meadow','cascade','aurora','dawn','dusk','rain','snow','cloud','star','moon','ocean','river','forest','garden','journey','memory','dream','hope','smile','gentle','cozy','petal','feather','crystal','amber','coral','azure','golden','silver','spring','summer','autumn','winter','morning','evening','whisper','echo','rhythm'];
const word = WORDS[Math.floor(new Date().setHours(0,0,0,0) / 86400000) % WORDS.length];
enEl.textContent = word;
/* 实测 2026-09-19：MyMemory 对本站出口 IP 持续返回 429 Too Many Requests
   （换了单词、换了语言对、连着 5 次都失败 —— 是配额/IP 级限流，不是参数问题）。
   原来的写法把「限流」和「单词不存在」混成同一句"单词加载失败"，用户看不出该等
   还是该换。这里分开：先带超时重试一次，仍失败就明确说是服务繁忙、稍后再来，
   并且不再把已经显示的单词清掉（单词来自本地词表，本来就一定是好的）。 */
const DEF_CACHE_KEY = 'jrnWordDefCache';
function cachedDef(w) {
try { var m = JSON.parse(localStorage.getItem(DEF_CACHE_KEY) || '{}'); return m[w] || ''; } catch (e) { return ''; }
}
function cacheDef(w, d) {
try {
var m = JSON.parse(localStorage.getItem(DEF_CACHE_KEY) || '{}');
m[w] = d;
localStorage.setItem(DEF_CACHE_KEY, JSON.stringify(m));
} catch (e) {}
}
async function fetchDef(w, ms) {
var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
var to = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
try {
var res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(w) + '&langpair=en|zh-CN', ctl ? { signal: ctl.signal } : undefined);
if (res.status === 429) { var e429 = new Error('rate'); e429.rate = true; throw e429; }
if (!res.ok) throw new Error('http ' + res.status);
var data = await res.json();
var t = data.responseData && data.responseData.translatedText;
if (!t) throw new Error('empty');
return t;
} finally { clearTimeout(to); }
}
/* 有缓存就先上缓存：限流期间也能看到上次查到的释义 */
var hit = cachedDef(word);
if (hit) defEl.textContent = '[释义] ' + hit + '（上次查到的）';
try {
var translated;
try { translated = await fetchDef(word, 8000); }
catch (e1) { translated = await fetchDef(word, 8000); }   /* 重试一次 */
defEl.textContent = '[释义] ' + translated + '（每日一词，明天再来解锁新的～）';
cacheDef(word, translated);
} catch (e) {
if (e && e.rate) {
defEl.textContent = '[释义] 🌸 词典服务今天太忙了（限流），稍后再点「换一个」试试';
} else if (!defEl.textContent) {
defEl.textContent = '[释义] 🌸 暂时查不到，点「换一个」重试';
}
}
} catch (e) {
enEl.textContent = '🌸 单词加载失败，点「换一个」重试';
}
}
loadWord();
if (refreshBtn) refreshBtn.addEventListener('click', loadWord);
})();
(function () {
const strip = document.getElementById('weekStrip');
if (!strip) return;
const KEY = 'moodRecords';
let records = {};
try { records = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
const days = [];
const now = new Date();
const monday = new Date(now);
const dow = (now.getDay() + 6) % 7;
monday.setDate(now.getDate() - dow);
for (let i = 0; i < 7; i++) {
const d = new Date(monday);
d.setDate(monday.getDate() + i);
const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
const mood = records[key];
const isToday = key === (now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate());
const cell = document.createElement('div');
cell.className = 'week-cell' + (mood ? ' has-mood' : '') + (isToday ? ' today' : '');
cell.innerHTML = '<div class="week-day">' + '一二三四五六日'[i] + '</div><div class="week-mood">' + (mood || '·') + '</div>';
strip.appendChild(cell);
}
})();
(function () {
const strip = document.getElementById('wwStrip');
if (!strip) return;
fetch('https://api.open-meteo.com/v1/forecast?latitude=48.137154&longitude=11.576124&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=Europe%2FBerlin')
.then(r => r.json())
.then(d => {
strip.innerHTML = '';
const days = ['日', '一', '二', '三', '四', '五', '六'];
d.daily.time.forEach((date, i) => {
const dObj = new Date(date);
const cell = document.createElement('div');
cell.className = 'ww-cell';
const isToday = i === 0;
cell.innerHTML =
'<div class="ww-day">' + (isToday ? '今天' : '周' + days[dObj.getDay()]) + '</div>' +
'<div class="ww-icon">' + (((window.__WMO_WEATHER || {})[d.daily.weather_code[i]] || {}).icon || '🌸') + '</div>' +
'<div class="ww-temp">' + d.daily.temperature_2m_max[i] + '°/' + d.daily.temperature_2m_min[i] + '°</div>';
strip.appendChild(cell);
});
})
.catch(() => { strip.innerHTML = '<div class="status-message">🌸 天气加载失败</div>'; });
})();
(function () {
const timeEl = document.getElementById('pomoTime');
if (!timeEl) return;
const startBtn = document.getElementById('pomoStartBtn');
const resetBtn = document.getElementById('pomoResetBtn');
const statusEl = document.getElementById('pomoStatus');
const TOTAL = 25 * 60;
let remaining = TOTAL;
let timer = null;
let running = false;
function render() {
const m = Math.floor(remaining / 60);
const s = remaining % 60;
timeEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
function tick() {
remaining--;
if (remaining <= 0) {
clearInterval(timer);
timer = null;
running = false;
remaining = TOTAL;
render();
statusEl.textContent = '🌸 时间到！休息一下吧';
startBtn.innerHTML = '<i class="fas fa-play"></i> 开始';
return;
}
render();
}
startBtn.addEventListener('click', () => {
if (running) {
clearInterval(timer);
timer = null;
running = false;
statusEl.textContent = '🌸 已暂停，随时可以继续';
startBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
} else {
running = true;
timer = setInterval(tick, 1000);
statusEl.textContent = '🌸 专注中，加油喵！';
startBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
}
});
resetBtn.addEventListener('click', () => {
clearInterval(timer);
timer = null;
running = false;
remaining = TOTAL;
render();
statusEl.textContent = '🌸 已重置，准备好就开始吧';
startBtn.innerHTML = '<i class="fas fa-play"></i> 开始';
});
render();
})();