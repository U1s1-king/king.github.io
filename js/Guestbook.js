/* 留言板后端（Cloudflare Worker）。
 * 说明：Worker 的端点 URL 本身就是公开的（浏览器必须能访问它），所以这里直接写明文；
 * 真正的安全由服务端保障：X-Admin-Key 鉴权、CORS 来源限制、IP 限流、输入校验与可选人机验证。
 * 如更换后端，请同步更新此处与 Worker 配置。 */
const WORKER_URL = "https://orange-limit-3254.kaneking114.workers.dev/";
let turnstileToken = null; // 启用 Turnstile 后由 widget 回调写入，提交时随请求发送
/* Turnstile 人机验证：共享渲染函数，兼容 api.js 先/后加载两种顺序 */
function renderTurnstileWidget() {
  if (!window.turnstile) return false;
  const el = document.getElementById('turnstile-widget');
  if (!el) return false;
  if (el.childElementCount > 0) return true; /* 已渲染 */
  window.turnstile.render(el, {
    sitekey: '0x4AAAAAAElKq8iUGSgVV9mS',
    callback: function (token) { window.__turnstileToken = token; turnstileToken = token; },
    'error-callback': function () { window.__turnstileToken = null; turnstileToken = null; },
    'expired-callback': function () { window.__turnstileToken = null; turnstileToken = null; }
  });
  return true;
}
if (typeof window.onloadTurnstileCallback !== 'function') {
  /* HTML 未预注册（例如被其他脚本覆盖）时，本文件兜底注册 */
  window.onloadTurnstileCallback = function () {
    (function loop(n) {
      if (renderTurnstileWidget()) return;
      if (n < 50) setTimeout(function () { loop(n + 1); }, 200);
    })(0);
  };
} else if (window.turnstile) {
  /* api.js 已先加载完成：立即补渲染 */
  renderTurnstileWidget();
}
function resetTurnstile() {
  if (window.turnstile) {
    const el = document.getElementById('turnstile-widget');
    if (el) { try { window.turnstile.reset(el); } catch (e) {} }
  }
  turnstileToken = null;
  window.__turnstileToken = null;
}
let messages = [];
async function loadMessages() {
try {
const res = await fetch(WORKER_URL, {
headers: { 'Accept': 'application/json' }
});
if (!res.ok) throw new Error('云端读取失败');
const data = await res.json();
messages = Array.isArray(data.posts) ? data.posts : [];
} catch (e) {
console.error(e);
showFloatingTip('云端读取失败，请稍后刷新');
messages = [];
}
renderMessages();
}
async function addMessage(name, content) {
if (!name.trim()) {
showFloatingTip('请留下你的昵称吧');
return false;
}
if (!content.trim()) {
showFloatingTip('🌸 写点什么再飘落呀～');
return false;
}
if (name.trim().length > 30) {
showFloatingTip('昵称过长，不超过30字哦');
return false;
}
if (content.trim().length > 300) {
showFloatingTip('留言最多300字，精简一点更有味道');
return false;
}
try {
const body = { name: name.trim(), content: content.trim() };
if (window.turnstile) { const tok = window.__turnstileToken || turnstileToken; if (tok) body.turnstileToken = tok; }
const res = await fetch(WORKER_URL, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(body)
});
if (!res.ok) {
const errData = await res.json().catch(() => ({}));
throw new Error(errData.error || '添加失败');
}
const data = await res.json();
if (data.success) {
messages.push(data.post);
renderMessages();
if (typeof confetti === 'function') {
confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
}
resetTurnstile();
return true;
}
throw new Error('添加失败');
} catch (e) {
console.error(e);
showFloatingTip(e.message || '添加失败，请重试');
resetTurnstile();
return false;
}
}
async function deleteMessageById(id) {
const adminKey = prompt('请输入删除口令：');
if (adminKey === null || adminKey.trim() === '') {
showFloatingTip('已取消删除');
return;
}
try {
const res = await fetch(`${WORKER_URL}?id=${encodeURIComponent(id)}`, {
method: 'DELETE',
headers: {
'X-Admin-Key': adminKey.trim()
}
});
if (!res.ok) {
let errMsg = '删除失败了喵';
try {
const errData = await res.json();
errMsg = errData.error || errMsg;
} catch {}
throw new Error(errMsg);
}
const data = await res.json();
if (data.success) {
messages = messages.filter(msg => String(msg.id) !== String(id));
renderMessages();
showFloatingTip('🌸 留言已随花瓣飘走');
} else {
throw new Error(data.error || '删除失败喵');
}
} catch (e) {
console.error(e);
showFloatingTip(e.message || '删除失败喵，请重试喵');
}
}
function renderMessages() {
const container = document.getElementById('messagesList');
const countSpan = document.getElementById('messageCount');
if (!container) return;
if (messages.length === 0) {
container.innerHTML = `
<div class="empty-message">
<i class="fas fa-cherry-blossom" style="font-size: 1.8rem; opacity: 0.6;"></i>
<p style="margin-top: 8px;"> 还没有留言喵，来做第一个留言的喵吧 </p>
</div>
`;
if (countSpan) countSpan.innerText = `0 则留言`;
return;
}
const sorted = (window.__sortMode && window.__sortMode() === 'old') ? [...messages] : [...messages].reverse();
let html = '';
for (let msg of sorted) {
html += `
<div class="message-card" data-id="${msg.id}">
<div class="message-header">
<div class="message-name">
<img class="message-avatar" src="https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(msg.name)}" alt="avatar">
<span class="reply-name">${escapeHtml(msg.name)}</span>
</div>
<div class="message-date">
<i class="far fa-calendar-alt"></i> ${escapeHtml(msg.date)}
<button class="copy-msg-btn" title="复制留言"><i class="fas fa-copy"></i></button>
</div>
</div>
<div class="message-content">
${escapeHtml(msg.content).replace(/\n/g, '<br>')}
</div>
<div class="message-footer">
<button class="delete-btn" data-id="${msg.id}" title="删除留言" style="display:none">
<i class="fas fa-trash-alt"></i> 删除
</button>
</div>
</div>
`;
}
container.innerHTML = html;
if (countSpan) countSpan.innerText = `${messages.length} 则留言`;
document.querySelectorAll('.delete-btn').forEach(btn => {
btn.addEventListener('click', (e) => {
e.stopPropagation();
const id = btn.getAttribute('data-id');
deleteMessageById(id);
});
});
}
document.addEventListener('DOMContentLoaded', () => {
loadMessages();
const submitBtn = document.getElementById('submitBtn');
const nameInput = document.getElementById('nameInput');
const msgInput = document.getElementById('msgInput');
if (submitBtn) {
submitBtn.addEventListener('click', async () => {
const nameVal = nameInput ? nameInput.value : '';
const msgVal = msgInput ? msgInput.value : '';
const success = await addMessage(nameVal, msgVal);
if (success) {
if (nameInput) nameInput.value = '';
if (msgInput) msgInput.value = '';
showFloatingTip('留言飘落成功，感谢陪伴');
}
});
}
if (msgInput) {
msgInput.addEventListener('keydown', (e) => {
if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
e.preventDefault();
submitBtn.click();
}
});
}
/* F3: 管理员入口——连续点击底部小花 5 次，开启删除功能（按钮默认隐藏） */
(function () {
const trigger = document.getElementById('sakuraAdminTrigger');
if (!trigger) return;
trigger.style.cursor = 'pointer';
/* fa-cherry-blossom 无字体码点，注入样式让触发图标显示为文字花 */
const st = document.createElement('style');
st.textContent = '#sakuraAdminTrigger{font-family:inherit !important}#sakuraAdminTrigger:before{content:"🌸" !important;font-style:normal}';
document.head.appendChild(st);
let count = 0;
trigger.addEventListener('click', () => {
count++;
if (count >= 5) {
count = 0;
document.querySelectorAll('#messagesList .delete-btn').forEach(b => { b.style.display = ''; });
if (typeof window.showFloatingTip === 'function') window.showFloatingTip('🌸 管理员模式已开启喵');
}
});
})();
});
(function () {
const el = document.getElementById('visitorLocText');
if (!el) return;
const ua = navigator.userAgent;
let device = '电脑';
if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) device = '手机';
else if (/iPad|Tablet/i.test(ua)) device = '平板';
const suffix = ' · ' + device + '访问喵';
/* ipwho.is（CORS 友好，替代已失效的 ip.useragentinfo.com） */
fetch('https://ipwho.is/')
.then(r => r.json())
.then(d => {
if (d.success !== false) {
const parts = [d.country, d.region, d.city].filter(Boolean);
el.textContent = '你来自 ' + (parts.join('·') || '神秘星球') + ' 喵' + suffix;
} else {
el.textContent = '🌸 定位失败，保持神秘';
}
})
.catch(() => { el.textContent = '🌸 定位失败，保持神秘'; });
})();
(function () {
const el = document.getElementById('guestQuoteText');
if (!el) return;
fetch('https://v1.hitokoto.cn/?c=a&c=c&c=d&c=i&c=j')
.then(r => r.json())
.then(d => {
el.textContent = '「' + d.hitokoto + '」' + (d.from ? ' —— ' + d.from : '');
})
.catch(() => { el.textContent = '🌸 愿留言都温柔以待'; });
})();
(function () {
const row = document.getElementById('emojiRow');
const input = document.getElementById('msgInput');
if (!row || !input) return;
row.querySelectorAll('.emoji-item').forEach(item => {
item.addEventListener('click', () => {
const emoji = item.dataset.emoji;
const start = input.selectionStart || input.value.length;
const end = input.selectionEnd || input.value.length;
input.value = input.value.slice(0, start) + emoji + input.value.slice(end);
input.focus();
input.selectionStart = input.selectionEnd = start + emoji.length;
input.dispatchEvent(new Event('input'));
});
});
})();
(function () {
const refreshBtn = document.getElementById('guestQuoteRefresh');
const textEl = document.getElementById('guestQuoteText');
if (!refreshBtn || !textEl) return;
function loadQuote() {
fetch('https://v1.hitokoto.cn/?c=a&c=c&c=d&c=i&c=j')
.then(r => r.json())
.then(d => {
textEl.textContent = '「' + d.hitokoto + '」' + (d.from ? ' —— ' + d.from : '');
})
.catch(() => { textEl.textContent = '🌸 愿留言都温柔以待'; });
}
refreshBtn.addEventListener('click', loadQuote);
})();
(function () {
function relTime(dateStr) {
const d = new Date(dateStr);
if (isNaN(d.getTime())) return dateStr;
const diff = Date.now() - d.getTime();
const min = 60000, hour = 3600000, day = 86400000;
if (diff < min) return '刚刚';
if (diff < hour) return Math.floor(diff / min) + ' 分钟前';
if (diff < day) return Math.floor(diff / hour) + ' 小时前';
if (diff < 7 * day) return Math.floor(diff / day) + ' 天前';
return d.toLocaleDateString();
}
const messagesListEl = document.getElementById('messagesList');
const observer = new MutationObserver(() => {
document.querySelectorAll('.message-date').forEach(el => {
if (!el.dataset.rel) {
el.dataset.rel = '1';
el.textContent = relTime(el.textContent.trim());
}
});
});
if (messagesListEl) observer.observe(messagesListEl, { childList: true, subtree: true });
})();
(function () {
const input = document.getElementById('msgInput');
const counter = document.getElementById('charCount');
if (!input || !counter) return;
input.addEventListener('input', () => {
counter.textContent = input.value.length;
});
})();
(function () {
const toggle = document.getElementById('sortToggle');
if (!toggle) return;
let mode = 'new';
toggle.addEventListener('click', () => {
mode = (mode === 'new') ? 'old' : 'new';
toggle.textContent = mode === 'new' ? '🌸 最新在前' : '🌸 最早在前';
toggle.classList.toggle('active', mode === 'new');
if (typeof renderMessages === 'function') renderMessages();
});
window.__sortMode = () => mode;
})();
(function () {
const list = document.getElementById('messagesList');
const input = document.getElementById('msgInput');
if (!list) return;
list.addEventListener('click', (e) => {
const nameEl = e.target.closest('.reply-name');
if (nameEl && input) {
const name = nameEl.textContent.trim();
input.value = '@' + name + ' ' + input.value;
input.focus();
}
const copyBtn = e.target.closest('.copy-msg-btn');
if (copyBtn) {
const card = copyBtn.closest('.message-card');
const content = card && card.querySelector('.message-content');
if (content) {
navigator.clipboard.writeText(content.textContent.trim()).then(() => {
const old = copyBtn.innerHTML;
copyBtn.innerHTML = '';
setTimeout(() => { copyBtn.innerHTML = old; }, 1200);
});
}
}
});
})();