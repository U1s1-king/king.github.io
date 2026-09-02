function copyToClipboard(text, msg) {
navigator.clipboard.writeText(text).then(() => {
if (typeof window.showFloatingTip === 'function') window.showFloatingTip(msg);
}).catch(() => {
alert("手动复制吧：" + text);
});
}
/* GitHub 仓库卡片渲染（"我的仓库"与"星标仓库"共用；外部 API 数据一律转义，防 XSS） */
function renderRepoCard(repo) {
const card = document.createElement('div');
card.className = 'media-card';
const name = escapeHtml(repo.name || '未知');
const url = escapeHtml(repo.html_url || '#');
const desc = escapeHtml(repo.description || '🌸 暂无描述');
const lang = escapeHtml(repo.language || '未知');
const stars = escapeHtml(String(repo.stargazers_count || 0));
const updated = escapeHtml(new Date(repo.updated_at || Date.now()).toLocaleDateString());
card.innerHTML =
'<div class="card-info">' +
'<div class="card-title"><a href="' + url + '" target="_blank" rel="noopener noreferrer">' + name + '</a> <span class="type-badge">★ ' + stars + '</span></div>' +
'<div class="card-desc">' + desc + '</div>' +
'<div class="card-desc"><i class="fas fa-code-branch"></i> ' + lang + ' · ' + updated + ' 更新</div>' +
'</div>';
return card;
}
document.querySelectorAll('.copy-drive-btn').forEach(btn => {
btn.addEventListener('click', function() {
let targetId = this.getAttribute('data-clip');
let elem = document.getElementById(targetId);
if (elem) {
let text = elem.innerText;
if (text === '# (请填写网盘链接)' || text === '#') {
copyToClipboard('', '网盘链接未填写，请先在HTML中填入链接');
} else {
copyToClipboard(text, '网盘链接已复制');
}
}
});
});
(function () {
const box = document.getElementById('github-repos');
if (!box) return;
fetch('https://api.github.com/users/U1s1-king/repos?sort=updated&per_page=8')
.then(r => r.json())
.then(repos => {
if (!Array.isArray(repos)) throw new Error('bad');
box.innerHTML = '';
repos.forEach(repo => {
box.appendChild(renderRepoCard(repo));
});
})
.catch(() => { box.innerHTML = '<div class="status-message">🌸 GitHub 仓库加载失败，稍后再试喵</div>'; });
})();
(function () {
const box = document.getElementById('biliStats');
if (!box) return;
fetch('data/bili/stats.json?v=' + Date.now())
.then(r => r.json())
.then(d => {
const rel = d.relation || {};
const online = (d.online && d.online.total) || 0;
box.innerHTML =
'<div class="stat-item"><span class="stat-num">' + (typeof rel.follower === 'number' ? rel.follower : '-') + '</span><span class="stat-label">🌸 粉丝</span></div>' +
'<div class="stat-item"><span class="stat-num">' + (typeof rel.following === 'number' ? rel.following : '-') + '</span><span class="stat-label">🌸 关注</span></div>' +
'<div class="stat-item"><span class="stat-num">' + (online ? (online / 10000).toFixed(1) + '万' : '-') + '</span><span class="stat-label">🌸 在线</span></div>';
if (d.updated_at) {
  const st = new Date(d.updated_at);
  if (!isNaN(st.getTime())) {
    const sync = document.createElement('div');
    sync.style.cssText = 'font-size:80%;opacity:.6;margin-top:8px;text-align:center';
    sync.textContent = '数据更新于 ' + (st.getMonth() + 1) + '月' + st.getDate() + '日 ' + st.toTimeString().slice(0, 5);
    box.appendChild(sync);
  }
}
})
.catch(() => { box.innerHTML = '<div class="status-message">🌸 数据稍后同步喵</div>'; });
})();
(function () {
/* Archives 视频卡片数据：按 data-bvid 匹配填充播放/点赞/投币/收藏 */
const cards = document.querySelectorAll('.card-stats[data-bvid]');
if (!cards.length) return;
fetch('data/bili/stats.json?v=' + Date.now())
.then(r => r.json())
.then(d => {
const vids = d.videos || [];
if (!vids.length) return;
const f = n => (n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n || 0));
vids.forEach(v => {
cards.forEach(c => {
if (c.getAttribute('data-bvid') === v.bvid) {
c.innerHTML = ' ' + f(v.view) + ' ·  ' + f(v.like) + ' ·  ' + f(v.coin) + ' ·  ' + f(v.favorite);
}
});
});
})
.catch(() => {});
})();
(function () {
const btn = document.getElementById('randomImgBtn');
const img = document.getElementById('randomImg');
if (!btn || !img) return;
btn.addEventListener('click', () => {
img.style.opacity = '0.4';
img.src = 'https://www.loliapi.com/acg/?' + Date.now();
img.onload = () => { img.style.opacity = '1'; };
});
})();
(function () {
const img = document.getElementById('ghChartImg');
const tip = document.getElementById('ghChartTip');
if (!img || !tip) return;
img.addEventListener('error', () => {
tip.style.display = 'block';
});
tip.addEventListener('click', () => {
img.src = 'https://ghchart.rshah.org/U1s1-king?t=' + Date.now();
tip.style.display = 'none';
});
tip.style.display = 'none';
})();
(function () {
const el = document.getElementById('tmDays');
if (!el) return;
const start = new Date('2026-05-10T00:00:00+08:00');
const days = Math.floor((Date.now() - start.getTime()) / 86400000);
el.textContent = days + ' 天';
})();
(function () {
const box = document.getElementById('ghStarred');
if (!box) return;
fetch('https://api.github.com/users/U1s1-king/starred?sort=updated&per_page=6')
.then(r => r.json())
.then(repos => {
if (!Array.isArray(repos)) throw new Error('bad');
box.innerHTML = '';
repos.forEach(repo => {
box.appendChild(renderRepoCard(repo));
});
})
.catch(() => { box.innerHTML = '<div class="status-message">🌸 星标加载失败，稍后再试喵</div>'; });
})();
(function () {
const box = document.getElementById('ghEvents');
if (!box) return;
const TYPE_MAP = {
PushEvent: '推送了代码',
CreateEvent: '创建了仓库/分支',
WatchEvent: '收藏了项目',
ForkEvent: 'Fork 了项目',
IssuesEvent: '更新了 Issue',
PullRequestEvent: '提交了 PR',
ReleaseEvent: '发布了版本',
DeleteEvent: '删除了分支'
};
fetch('https://api.github.com/users/U1s1-king/events/public?per_page=8')
.then(r => r.json())
.then(events => {
if (!Array.isArray(events)) throw new Error('bad');
box.innerHTML = '';
const seen = new Set();
let count = 0;
events.forEach(ev => {
if (count >= 6) return;
if (seen.has(ev.repo.name)) return;
seen.add(ev.repo.name);
count++;
const label = TYPE_MAP[ev.type] || ev.type;
const time = new Date(ev.created_at).toLocaleString();
const item = document.createElement('div');
item.className = 'gh-event';
item.innerHTML = '<span class="ev-text">' + escapeHtml(label) + ' · <b>' + escapeHtml(ev.repo.name) + '</b></span>' +
'<span class="ev-time">' + escapeHtml(time) + '</span>';
box.appendChild(item);
});
if (!count) box.innerHTML = '<div class="status-message">🌸 最近没有公开动态</div>';
})
.catch(() => { box.innerHTML = '<div class="status-message">🌸 动态加载失败喵</div>'; });
})();
(function () {
const textEl = document.getElementById('adviceText');
const btn = document.getElementById('adviceRefreshBtn');
if (!textEl) return;
function load() {
textEl.textContent = '🌸 思考中...';
fetch('https://api.adviceslip.com/advice')
.then(r => r.json())
.then(d => {
textEl.textContent = ' ' + d.slip.advice;
})
.catch(() => { textEl.textContent = '🌸 建议暂时迷路了'; });
}
load();
if (btn) btn.addEventListener('click', load);
})();
(function () {
const btn = document.getElementById('confettiBtn');
if (!btn || typeof confetti !== 'function') return;
btn.addEventListener('click', () => {
const end = Date.now() + 1200;
(function frame() {
confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 } });
confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 } });
if (Date.now() < end) requestAnimationFrame(frame);
})();
});
})();
(function () {
const zones = { 'Beijing': 'Asia/Shanghai', 'Tokyo': 'Asia/Tokyo', 'Munich': 'Europe/Berlin', 'NewYork': 'America/New_York' };
const keys = Object.keys(zones);
let first = true;
function update() {
const now = new Date();
keys.forEach(k => {
const el = document.getElementById('clock-' + k);
if (!el) return;
const time = now.toLocaleTimeString('zh-CN', { timeZone: zones[k], hour12: false });
el.textContent = time;
});
}
update();
setInterval(update, 1000);
})();
(function () {
const btn = document.getElementById('randomImgDownload');
const img = document.getElementById('randomImg');
if (!btn || !img) return;
btn.addEventListener('click', (e) => {
if (img.src) btn.href = img.src;
});
})();