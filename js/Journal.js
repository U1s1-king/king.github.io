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
const res = await fetch('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(word) + '&langpair=en|zh-CN');
const data = await res.json();
const translated = data.responseData && data.responseData.translatedText;
if (!translated) throw new Error('no word');
defEl.textContent = '[释义] ' + translated + '（每日一词，明天再来解锁新的～）';
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