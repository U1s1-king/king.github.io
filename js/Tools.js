const savedBg = localStorage.getItem('customBg');
if (savedBg && savedBg !== 'undefined') {
document.body.style.background = `url(${savedBg}) no-repeat center center fixed`;
document.body.style.backgroundSize = 'cover';
}
document.getElementById('defaultBgBtn').onclick = () => {
document.body.style.background = "linear-gradient(145deg, #fff9f7 0%, #ffeef4 100%)";
localStorage.removeItem('customBg');
showToast('已恢复默认背景');
};
document.getElementById('clearBgBtn').onclick = () => {
document.body.style.background = "";
localStorage.removeItem('customBg');
showToast('背景已清除');
};
document.getElementById('uploadBgBtn').onclick = () => document.getElementById('bgImageUpload').click();
document.getElementById('bgImageUpload').onchange = (e) => {
if(e.target.files.length) {
const reader = new FileReader();
reader.onload = (ev) => {
document.body.style.background = `url(${ev.target.result}) no-repeat center center fixed`;
document.body.style.backgroundSize = 'cover';
localStorage.setItem('customBg', String(ev.target.result));
showToast('背景更新成功');
};
reader.readAsDataURL(e.target.files[0]);
}
};
function showToast(msg) {
let t = document.getElementById('toastMsg');
if(!t) {
t = document.createElement('div');
t.id = 'toastMsg';
t.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translatex(-50%); background:#e27e9be0; backdrop-filter:blur(8px); padding:8px 20px; border-radius:60px; font-size:0.8rem; z-index:1100; color:white;';
document.body.appendChild(t);
}
t.textContent = msg;
t.style.display = 'block';
setTimeout(() => t.style.display = 'none', 2000);
}
const tabs = document.querySelectorAll('.tool-tab');
const panels = document.querySelectorAll('.tool-panel');
tabs.forEach(btn => {
btn.addEventListener('click', () => {
const toolId = btn.dataset.tool;
tabs.forEach(b => b.classList.remove('active'));
btn.classList.add('active');
panels.forEach(p => p.classList.remove('active'));
document.getElementById(`tool-${toolId}`).classList.add('active');
});
});
function copyText(text, onSuccess) {
navigator.clipboard.writeText(text).then(() => { showToast('✓ 复制成功喵'); if(onSuccess) onSuccess(); }).catch(() => showToast('复制失败'));
}
const converter = {
currentBinary: '',
updateProgress(percent) {
const container = document.getElementById('progressContainer');
const bar = document.getElementById('progressBar');
if (!container) return;
if (percent === 0) container.style.display = 'block';
bar.style.width = percent + '%';
if (percent >= 100) setTimeout(() => container.style.display = 'none', 800);
},
toBinary() {
const input = document.getElementById('converterInput').value;
if (!input.trim()) { showToast('请输入内容'); return; }
try {
const bytes = new TextEncoder().encode(input);
let binary = '';
for (let i = 0; i < bytes.length; i++) {
binary += bytes[i].toString(2).padStart(8, '0') + ' ';
if (i % 500 === 0) this.updateProgress((i / bytes.length) * 100);
}
document.getElementById('converterOutput').innerText = binary.trim();
this.currentBinary = binary.trim();
this.updateProgress(100);
} catch(e) { showToast('转换失败'); }
},
toText() {
let input = document.getElementById('converterInput').value;
const clean = input.replace(/[^01]/g, '');
if (clean.length === 0 || clean.length % 8 !== 0) { showToast('二进制格式不对，需要8位一组'); return; }
try {
const bytes = [];
for (let i = 0; i < clean.length; i += 8) bytes.push(parseInt(clean.substr(i, 8), 2));
document.getElementById('converterOutput').innerText = new TextDecoder().decode(new Uint8Array(bytes));
} catch(e) { showToast('解码失败'); }
},
async handleImageUpload(file) {
if (!file || !file.type.startsWith('image/')) return;
document.getElementById('imageFileInfo').innerHTML = `<i class="fas fa-camera"></i> ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
document.getElementById('imageFileInfo').style.display = 'block';
const preview = document.getElementById('imagePreview');
preview.style.display = 'block';
preview.src = URL.createObjectURL(file);
this.updateProgress(0);
const buffer = await file.arrayBuffer();
const bytes = new Uint8Array(buffer);
let binary = '';
for (let i = 0; i < bytes.length; i++) {
binary += bytes[i].toString(2).padStart(8, '0') + ' ';
if (i % 500 === 0) this.updateProgress((i / bytes.length) * 100);
}
this.currentBinary = binary.trim();
document.getElementById('converterOutput').innerText = `图片转二进制完成 (共${bytes.length}字节)\n预览:\n${binary.slice(0, 200)}...`;
this.updateProgress(100);
},
binaryToImage() {
const input = document.getElementById('converterInput').value;
const clean = input.replace(/[^01]/g, '');
if (clean.length === 0 || clean.length % 8 !== 0) { showToast('请输入有效的二进制'); return; }
try {
const bytes = [];
for (let i = 0; i < clean.length; i += 8) bytes.push(parseInt(clean.substr(i, 8), 2));
const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
const url = URL.createObjectURL(blob);
const preview = document.getElementById('imagePreview');
preview.src = url;
preview.style.display = 'block';
document.getElementById('converterOutput').innerText = '二进制已还原为图片，预览如上~';
} catch(e) { showToast('还原失败'); }
},
downloadBinary() {
const output = this.currentBinary;
if (!output || output.length === 0) { showToast('没有可下载的二进制数据，请先生成喵~'); return; }
const blob = new Blob([output], { type: 'text/plain' });
const link = document.createElement('a');
link.href = URL.createObjectURL(blob);
link.download = '二进制.bin';
link.click();
URL.revokeObjectURL(link.href);
}
};
document.getElementById('toBinaryBtn').onclick = () => converter.toBinary();
document.getElementById('toTextBtn').onclick = () => converter.toText();
document.getElementById('clearConverterBtn').onclick = () => { document.getElementById('converterInput').value = ''; document.getElementById('converterOutput').innerText = '🌸 等待转换 ...'; document.getElementById('imagePreview').style.display = 'none'; document.getElementById('imageFileInfo').style.display = 'none'; converter.currentBinary = ''; };
document.getElementById('uploadImageBtn').onclick = () => document.getElementById('imageToBinaryUpload').click();
document.getElementById('imageToBinaryUpload').onchange = (e) => { if(e.target.files.length) converter.handleImageUpload(e.target.files[0]); };
document.getElementById('binaryToImageBtn').onclick = () => converter.binaryToImage();
document.getElementById('downloadBinaryBtn').onclick = () => converter.downloadBinary();
document.getElementById('copyConverterBtn').onclick = () => copyText(document.getElementById('converterOutput').innerText);
document.getElementById('generateRandomBtn').onclick = () => {
let min = parseInt(document.getElementById('randomMin').value);
let max = parseInt(document.getElementById('randomMax').value);
let count = parseInt(document.getElementById('randomCount').value);
if (isNaN(min) || isNaN(max) || isNaN(count)) return;
if (min > max) [min, max] = [max, min];
const results = new Set();
if (count > max - min + 1) count = max - min + 1;
while (results.size < count) {
results.add(Math.floor(Math.random() * (max - min + 1)) + min);
}
const output = Array.from(results).join(', ');
document.getElementById('randomOutput').innerText = output || '无结果';
};
document.getElementById('copyRandomBtn').onclick = () => copyText(document.getElementById('randomOutput').innerText);
let countdownInterval = null;
function updateCountdown() {
const target = new Date(document.getElementById('targetDate').value);
if (isNaN(target.getTime())) { document.getElementById('countdownOutput').innerHTML = '请设置目标日期'; return; }
const now = new Date();
const diff = target - now;
if (diff <= 0) { document.getElementById('countdownOutput').innerHTML = '时间到啦！'; if(countdownInterval) clearInterval(countdownInterval); return; }
const days = Math.floor(diff / (1000 * 60 * 60 * 24));
const hours = Math.floor((diff % (86400000)) / 3600000);
const minutes = Math.floor((diff % 3600000) / 60000);
const seconds = Math.floor((diff % 60000) / 1000);
document.getElementById('countdownOutput').innerHTML = `<span style="font-size:1rem;">${days}天 ${hours}小时 ${minutes}分 ${seconds}秒</span>`;
}
document.getElementById('startCountdownBtn').onclick = () => {
if (countdownInterval) clearInterval(countdownInterval);
updateCountdown();
countdownInterval = setInterval(updateCountdown, 1000);
};
document.getElementById('stopCountdownBtn').onclick = () => { if(countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } };
document.getElementById('podLength').oninput = () => { document.getElementById('podLengthVal').innerText = document.getElementById('podLength').value; };
document.getElementById('generatePwdBtn').onclick = () => {
const len = parseInt(document.getElementById('podLength').value);
const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const lower = 'abcdefghijkmnpqrstuvwxyz';
const numbers = '23456789';
const symbols = '!@#$%^&*()_+[]{}<>?';
let chars = '';
if (document.getElementById('podUppercase').checked) chars += upper;
if (document.getElementById('podLowercase').checked) chars += lower;
if (document.getElementById('podNumbers').checked) chars += numbers;
if (document.getElementById('podSymbols').checked) chars += symbols;
if (chars === '') { showToast('至少选择一种字符类型'); return; }
let pwd = '';
/* 加密安全的随机数（crypto.getRandomValues），避免弱随机的密码生成 */
const randArr = new Uint32Array(len);
crypto.getRandomValues(randArr);
for (let i = 0; i < len; i++) pwd += chars[Math.floor((randArr[i] / 4294967296) * chars.length)];
document.getElementById('podOutput').innerText = pwd;
};
document.getElementById('copyPodBtn').onclick = () => copyText(document.getElementById('podOutput').innerText);
document.getElementById('drawBtn').onclick = () => {
const text = document.getElementById('lotteryItems').value;
const items = text.split(/\n/).filter(s => s.trim().length > 0);
if (items.length === 0) { showToast('请填写抽签选项'); return; }
const result = items[Math.floor(Math.random() * items.length)];
document.getElementById('lotteryOutput').innerHTML = ` ${result} `;
};
document.getElementById('clearLotteryBtn').onclick = () => { document.getElementById('lotteryItems').value = ''; document.getElementById('lotteryOutput').innerHTML = '——'; };
function updateColorInfo(hex) {
const r = parseInt(hex.slice(1,3), 16);
const g = parseInt(hex.slice(3,5), 16);
const b = parseInt(hex.slice(5,7), 16);
document.getElementById('hexValue').innerText = hex;
document.getElementById('rgbValue').innerText = `rgb(${r}, ${g}, ${b})`;
document.getElementById('colorPreview').style.background = hex;
}
document.getElementById('colorPicker').oninput = () => updateColorInfo(document.getElementById('colorPicker').value);
document.getElementById('applyColorBtn').onclick = () => updateColorInfo(document.getElementById('colorPicker').value);
document.getElementById('randomColorBtn').onclick = () => {
const randomHex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
document.getElementById('colorPicker').value = randomHex;
updateColorInfo(randomHex);
};
updateColorInfo('#e57397');
function updateCounter() {
const text = document.getElementById('counterInput').value;
document.getElementById('charCount').innerText = String(text.length);
document.getElementById('chineseCount').innerText = String((text.match(/[\u4e00-\u9fa5]/g) || []).length);
document.getElementById('letterCount').innerText = String((text.match(/[a-zA-Z]/g) || []).length);
document.getElementById('digitCount').innerText = String((text.match(/[0-9]/g) || []).length);
document.getElementById('lineCount').innerText = text === '' ? '0' : String(text.split(/\n/).length);
}
document.getElementById('counterInput').oninput = updateCounter;
updateCounter();
document.getElementById('b64Encode').onclick = () => {
document.getElementById('b64Out').value = btoa(unescape(encodeURIComponent(document.getElementById('b64In').value)));
};
document.getElementById('b64Decode').onclick = () => {
try { document.getElementById('b64Out').value = decodeURIComponent(escape(atob(document.getElementById('b64In').value.trim()))); }
catch (e) { document.getElementById('b64Out').value = '解码失败: ' + e.message; }
};
document.getElementById('urlEncode').onclick = () => {
document.getElementById('urlOut').value = encodeURIComponent(document.getElementById('urlIn').value);
};
document.getElementById('urlDecode').onclick = () => {
try { document.getElementById('urlOut').value = decodeURIComponent(document.getElementById('urlIn').value); }
catch (e) { document.getElementById('urlOut').value = '解码失败: ' + e.message; }
};
document.getElementById('tsConvert').onclick = () => {
const v = document.getElementById('tsIn').value.trim();
const out = document.getElementById('tsOut');
if (!v) { out.value = '请输入内容'; return; }
if (/^\d+$/.test(v)) {
let ms = parseInt(v, 10);
if (ms < 1e12) ms *= 1000;
const d = new Date(ms);
out.value = '日期: ' + d.toLocaleString('zh-CN') + String.fromCharCode(10) + '秒: ' + Math.floor(ms / 1000) + String.fromCharCode(10) + '毫秒: ' + ms;
} else {
const t = new Date(v.replace(/-/g, '/')).getTime();
if (isNaN(t)) { out.value = '日期格式无效'; return; }
out.value = '秒: ' + Math.floor(t / 1000) + String.fromCharCode(10) + '毫秒: ' + t;
}
};
document.getElementById('uuidGen').onclick = () => {
const u = crypto.randomUUID ? crypto.randomUUID() : (() => {
const b = new Uint8Array(16);
crypto.getRandomValues(b);
b[6] = (b[6] & 0x0f) | 0x40;
b[8] = (b[8] & 0x3f) | 0x80;
const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
})();
const out = document.getElementById('uuidOut');
out.value = u + String.fromCharCode(10) + u.replace(/-/g, '') + String.fromCharCode(10) + u.toUpperCase();
};
document.getElementById('tstatBtn').onclick = () => {
const t = document.getElementById('tstatIn').value;
const cn = (t.match(/[\u4e00-\u9fa5]/g) || []).length;
const words = t.trim() ? t.trim().split(/\s+/).length : 0;
document.getElementById('tstatOut').value =
'总字符: ' + t.length + String.fromCharCode(10) + '中文字数: ' + cn + String.fromCharCode(10) + '英文单词: ' + words + String.fromCharCode(10) + '行数: ' + (t ? t.split(String.fromCharCode(10)).length : 0) + String.fromCharCode(10) + '段落: ' + (t ? t.split(/\r?\n\s*\r?\n/).filter(p => p.trim()).length : 0);
};
document.getElementById('caseUpper').onclick = () => { document.getElementById('caseOut').value = document.getElementById('caseIn').value.toUpperCase(); };
document.getElementById('caseLower').onclick = () => { document.getElementById('caseOut').value = document.getElementById('caseIn').value.toLowerCase(); };
document.getElementById('caseTitle').onclick = () => {
document.getElementById('caseOut').value = document.getElementById('caseIn').value.replace(/\b\w/g, c => c.toUpperCase());
};
document.getElementById('jsonFmt').onclick = () => {
try { document.getElementById('jsonOut').value = JSON.stringify(JSON.parse(document.getElementById('jsonIn').value), null, 2); }
catch (e) { document.getElementById('jsonOut').value = ' ' + e.message; }
};
document.getElementById('jsonMin').onclick = () => {
try { document.getElementById('jsonOut').value = JSON.stringify(JSON.parse(document.getElementById('jsonIn').value)); }
catch (e) { document.getElementById('jsonOut').value = ' ' + e.message; }
};
document.getElementById('jsonValidate').onclick = () => {
try { JSON.parse(document.getElementById('jsonIn').value); document.getElementById('jsonOut').value = '合法 JSON'; }
catch (e) { document.getElementById('jsonOut').value = ' ' + e.message; }
};
const doHash = (algo) => {
crypto.subtle.digest(algo, new TextEncoder().encode(document.getElementById('hashIn').value)).then(buf => {
document.getElementById('hashOut').value = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}).catch(e => { document.getElementById('hashOut').value = ' ' + e.message; });
};
document.getElementById('hash256').onclick = () => doHash('SHA-256');
document.getElementById('hash512').onclick = () => doHash('SHA-512');
document.getElementById('hash1').onclick = () => doHash('SHA-1');
const rgbToHsl = (r, g, b) => {
r /= 255; g /= 255; b /= 255;
const max = Math.max(r, g, b), min = Math.min(r, g, b);
let h = 0, s = 0;
const l = (max + min) / 2;
if (max !== min) {
const d = max - min;
s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
else if (max === g) h = (b - r) / d + 2;
else h = (r - g) / d + 4;
h /= 6;
}
return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
};
document.getElementById('colorConv').onclick = () => {
const v = document.getElementById('colorIn').value.trim();
const out = document.getElementById('colorOut');
let r, g, b;
const m = v.match(/^#?([0-9a-f]{6})$/i);
if (m) { const n = parseInt(m[1], 16); r = n >> 16 & 255; g = n >> 8 & 255; b = n & 255; }
else {
const m2 = v.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i);
if (m2) { r = +m2[1]; g = +m2[2]; b = +m2[3]; }
else { out.value = '支持 HEX 或 rgb(r,g,b)'; return; }
}
const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
const hsl = rgbToHsl(r, g, b);
out.value = 'HEX: ' + hex + String.fromCharCode(10) + 'RGB: rgb(' + r + ',' + g + ',' + b + ')' + String.fromCharCode(10) + 'HSL: hsl(' + hsl[0] + ',' + hsl[1] + '%,' + hsl[2] + '%)';
};
document.getElementById('passGenBtn').onclick = () => {
const len = Math.min(64, Math.max(4, parseInt(document.getElementById('passLen').value) || 16));
const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
const arr = new Uint32Array(len);
crypto.getRandomValues(arr);
let p = '';
for (let i = 0; i < len; i++) p += chars[arr[i] % chars.length];
document.getElementById('passOut').value = p;
};
document.getElementById('regexTest').onclick = () => {
try {
const re = new RegExp(document.getElementById('regexPat').value, 'g');
const t = document.getElementById('regexIn').value;
const ms = t.match(re);
const out = document.getElementById('regexOut');
if (!ms || ms.length === 0) { out.value = '无匹配'; return; }
out.value = '共 ' + ms.length + '个匹配' + String.fromCharCode(10) + ms.join(String.fromCharCode(10));
} catch (e) { document.getElementById('regexOut').value = '正则错误: ' + e.message; }
};
document.getElementById('numConv').onclick = () => {
const v = document.getElementById('numIn').value.trim();
const out = document.getElementById('numOut');
let n;
if (/^0x[0-9a-f]+$/i.test(v)) n = parseInt(v, 16);
else if (/^0b[01]+$/i.test(v)) n = parseInt(v.slice(2), 2);
else if (/^[0-9]+$/.test(v)) n = parseInt(v, 10);
else { out.value = '支持十进制、0x十六进制、0b二进制'; return; }
if (isNaN(n)) { out.value = '无效数字'; return; }
out.value = '2进制: ' + n.toString(2) + String.fromCharCode(10) + '8进制: ' + n.toString(8) + String.fromCharCode(10) + '10进制: ' + n + String.fromCharCode(10) + '16进制: 0x' + n.toString(16).toUpperCase();
};
document.getElementById('unitConv').onclick = () => {
const v = parseFloat(document.getElementById('unitVal').value);
const t = document.getElementById('unitType').value;
const out = document.getElementById('unitOut');
if (isNaN(v)) { out.value = '请输入数字'; return; }
if (t === 'temp') {
out.value = '摄氏: ' + v + '°C' + String.fromCharCode(10) + '华氏: ' + (v * 9 / 5 + 32).toFixed(2) + '°F' + String.fromCharCode(10) + '开尔文: ' + (v + 273.15).toFixed(2) + 'K';
return;
}
const tables = {
len: [['毫米', 0.001], ['厘米', 0.01], ['米', 1], ['千米', 1000], ['英寸', 0.0254], ['英尺', 0.3048], ['英里', 1609.344]],
weight: [['克', 0.001], ['千克', 1], ['吨', 1000], ['磅', 0.45359237], ['盎司', 0.0283495]],
data: [['B', 1], ['KB', 1024], ['MB', 1048576], ['GB', 1073741824], ['TB', 1099511627776]]
};
out.value = '输入: ' + v + String.fromCharCode(10) + tables[t].map(r => { const n = v / r[1]; return r[0] + ': ' + (Math.abs(n) >= 100000 || (Math.abs(n) < 0.0001 && n !== 0) ? n.toExponential(4) : (Number.isInteger(n) ? n : Math.round(n * 10000) / 10000)); }).join(String.fromCharCode(10));
};
const caesarShift = (text, n) => text.split('').map(ch => {
const c = ch.charCodeAt(0);
if (c >= 65 && c <= 90) return String.fromCharCode((c - 65 + n) % 26 + 65);
if (c >= 97 && c <= 122) return String.fromCharCode((c - 97 + n) % 26 + 97);
return ch;
}).join('');
document.getElementById('caesarEnc').onclick = () => {
const n = (parseInt(document.getElementById('caesarShift').value) || 3) % 26;
document.getElementById('caesarOut').value = caesarShift(document.getElementById('caesarIn').value, n);
};
document.getElementById('caesarDec').onclick = () => {
const n = (parseInt(document.getElementById('caesarShift').value) || 3) % 26;
document.getElementById('caesarOut').value = caesarShift(document.getElementById('caesarIn').value, 26 - n);
};
document.getElementById('dateDiffBtn').onclick = () => {
const a = new Date(document.getElementById('dateA').value.replace(/-/g, '/'));
const b = new Date(document.getElementById('dateB').value.replace(/-/g, '/'));
if (isNaN(a) || isNaN(b)) { document.getElementById('dateDiffOut').value = '日期格式无效'; return; }
const ms = Math.abs(a - b);
const days = Math.floor(ms / 86400000);
document.getElementById('dateDiffOut').value = '相差: ' + days + ' 天' + String.fromCharCode(10) + '约 ' + Math.floor(days / 365) + '年 / ' + Math.floor(days / 30.44) + '个月' + String.fromCharCode(10) + '相差: ' + (ms / 3600000).toFixed(1) + '小时';
};
document.getElementById('pctBtn').onclick = () => {
const a = parseFloat(document.getElementById('pctA').value);
const b = parseFloat(document.getElementById('pctB').value);
if (isNaN(a) || isNaN(b) || b === 0) { document.getElementById('pctOut').value = '请输入有效数字(B≠0)'; return; }
document.getElementById('pctOut').value = 'A 是 B 的 ' + (a / b * 100).toFixed(2) + '%' + String.fromCharCode(10) + 'B 的 ' + a + '% = ' + (b * a / 100).toFixed(4) + String.fromCharCode(10) + 'A 比 B 多 ' + ((a - b) / Math.abs(b) * 100).toFixed(2) + '%';
};
const MORSE = { 'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.' };
const MORSE_REV = {};
Object.keys(MORSE).forEach(k => { MORSE_REV[MORSE[k]] = k; });
document.getElementById('morseEnc').onclick = () => {
document.getElementById('morseOut').value = document.getElementById('morseIn').value.toUpperCase().split('').map(c => MORSE[c] || (c === ' ' ? '/' : '')).join(' ').trim();
};
document.getElementById('morseDec').onclick = () => {
document.getElementById('morseOut').value = document.getElementById('morseIn').value.trim().split(/\s+/).map(c => c === '/' ? ' ' : (MORSE_REV[c] || '?')).join('');
};
document.getElementById('diffBtn').onclick = () => {
const a = document.getElementById('diffA').value.split(String.fromCharCode(10));
const b = document.getElementById('diffB').value.split(String.fromCharCode(10));
const max = Math.max(a.length, b.length);
let same = 0, s = '';
for (let i = 0; i < max; i++) {
if (a[i] === b[i]) same++;
else s += String.fromCharCode(10) + 'L' + (i + 1) + ': A="' + (a[i] || '') + '" B="' + (b[i] || '') + '"';
}
document.getElementById('diffOut').value = '文本A: ' + a.length + '行 | 文本B: ' + b.length + ' 行' + String.fromCharCode(10) + '相同: ' + same + ' | 不同: ' + (max - same) + s;
};
document.getElementById('revBtn').onclick = () => {
document.getElementById('revOut').value = document.getElementById('revIn').value.split('').reverse().join('');
};
document.getElementById('revWordBtn').onclick = () => {
document.getElementById('revOut').value = document.getElementById('revIn').value.trim().split(/\s+/).reverse().join(' ');
};
document.getElementById('diceBtn').onclick = () => {
const a = Math.ceil(parseFloat(document.getElementById('diceMin').value) || 1);
const b = Math.floor(parseFloat(document.getElementById('diceMax').value) || 100);
if (a > b) { document.getElementById('diceOut').value = '最小值不能大于最大值'; return; }
const n = Math.floor(Math.random() * (b - a + 1)) + a;
document.getElementById('diceOut').value = ' ' + n + '（范围 ' + a + ' ~ ' + b + '）';
};
const isPrime = (n) => {
if (n < 2) return false;
if (n === 2 || n === 3) return true;
if (n % 2 === 0 || n % 3 === 0) return false;
for (let i = 5; i * i <= n; i += 6) {
if (n % i === 0 || n % (i + 2) === 0) return false;
}
return true;
};
document.getElementById('primeBtn').onclick = () => {
const n = parseInt(document.getElementById('primeIn').value);
const out = document.getElementById('primeOut');
if (isNaN(n) || n < 0) { out.value = '请输入正整数'; return; }
out.value = n + (isPrime(n) ? '是质数！' : '不是质数') + String.fromCharCode(10) + '因式分解: ' + (n < 2 ? n : factorize(n).join(' × '));
};
const factorize = (n) => {
const f = [];
let x = n;
for (let d = 2; d * d <= x; d++) {
while (x % d === 0) { f.push(d); x /= d; }
}
if (x > 1) f.push(x);
return f;
};
document.getElementById('bmiBtn').onclick = () => {
const h = parseFloat(document.getElementById('bmiH').value) / 100;
const w = parseFloat(document.getElementById('bmiW').value);
const out = document.getElementById('bmiOut');
if (isNaN(h) || isNaN(w) || h <= 0 || w <= 0) { out.value = '请输入身高(cm)和体重(kg)'; return; }
const bmi = w / (h * h);
let level = '';
if (bmi < 18.5) level = '偏瘦';
else if (bmi < 24) level = '正常';
else if (bmi < 28) level = '偏胖';
else level = '肥胖';
out.value = 'BMI: ' + bmi.toFixed(1) + String.fromCharCode(10) + '状态: ' + level;
};
document.getElementById('discBtn').onclick = () => {
const p = parseFloat(document.getElementById('discPrice').value);
const o = parseFloat(document.getElementById('discOff').value);
const out = document.getElementById('discOut');
if (isNaN(p) || isNaN(o)) { out.value = '请输入原价和折扣'; return; }
const pay = p * o / 100;
out.value = '折后价: ' + pay.toFixed(2) + String.fromCharCode(10) + '省了: ' + (p - pay).toFixed(2);
};
document.getElementById('zodiacBtn').onclick = () => {
const d = new Date(document.getElementById('zodiacIn').value.replace(/-/g, '/'));
const out = document.getElementById('zodiacOut');
if (isNaN(d)) { out.value = '日期格式无效'; return; }
const animals = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const y = d.getFullYear();
const zodiac = animals[(y - 4) % 12];
const signs = [['水瓶座', 1, 20, 2, 18], ['双鱼座', 2, 19, 3, 20], ['白羊座', 3, 21, 4, 19], ['金牛座', 4, 20, 5, 20], ['双子座', 5, 21, 6, 21], ['巨蟹座', 6, 22, 7, 22], ['狮子座', 7, 23, 8, 22], ['处女座', 8, 23, 9, 22], ['天秤座', 9, 23, 10, 23], ['天蝎座', 10, 24, 11, 22], ['射手座', 11, 23, 12, 21], ['摩羯座', 12, 22, 1, 19]];
let sign = '摩羯座';
for (const s of signs) {
if ((d.getMonth() + 1 === s[1] && d.getDate() >= s[2]) || (d.getMonth() + 1 === s[3] && d.getDate() <= s[4])) { sign = s[0]; break; }
}
out.value = '生肖: ' + zodiac + String.fromCharCode(10) + '星座: ' + sign;
};
const numToChinese = (n) => {
const units = ['', '拾', '佰', '仟', '万', '拾', '佰', '仟', '亿'];
const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
let s = '', zero = false;
const str = String(Math.floor(Math.abs(n)));
for (let i = 0; i < str.length; i++) {
const d = +str[i];
const pos = str.length - 1 - i;
if (d === 0) { zero = true; }
else {
if (zero && s) s += '零';
zero = false;
s += digits[d] + (units[pos] || '');
}
}
return (n < 0 ? '负' : '') + (s || '零');
};
document.getElementById('rmbBtn').onclick = () => {
const n = parseFloat(document.getElementById('rmbIn').value);
const out = document.getElementById('rmbOut');
if (isNaN(n)) { out.value = '请输入金额'; return; }
const int = Math.floor(Math.abs(n));
const dec = Math.round((Math.abs(n) - int) * 100);
let s = (n < 0 ? '负' : '') + numToChinese(int) + '元';
if (dec === 0) s += '整';
else s += (dec >= 10 ? numToChinese(Math.floor(dec / 10)) + '角' : '零') + (dec % 10 ? numToChinese(dec % 10) + '分' : '');
out.value = s;
};
document.getElementById('sortAsc').onclick = () => {
document.getElementById('sortOut').value = document.getElementById('sortIn').value.split(String.fromCharCode(10)).filter(l => l.trim()).sort().join(String.fromCharCode(10));
};
document.getElementById('sortDesc').onclick = () => {
document.getElementById('sortOut').value = document.getElementById('sortIn').value.split(String.fromCharCode(10)).filter(l => l.trim()).sort().reverse().join(String.fromCharCode(10));
};
document.getElementById('sortDedup').onclick = () => {
const seen = {};
document.getElementById('sortOut').value = document.getElementById('sortIn').value.split(String.fromCharCode(10)).filter(l => { if (l.trim() && !seen[l]) { seen[l] = 1; return true; } return false; }).join(String.fromCharCode(10));
};
document.getElementById('upBtn').onclick = () => {
const u = document.getElementById('upIn').value.trim();
const out = document.getElementById('upOut');
try {
const p = new URL(u);
out.value = '协议: ' + p.protocol + String.fromCharCode(10) + '主机: ' + p.host + String.fromCharCode(10) + '路径: ' + p.pathname + String.fromCharCode(10) + '查询: ' + (p.search || '(无)') + String.fromCharCode(10) + '哈希: ' + (p.hash || '(无)');
} catch (e) { out.value = '网址格式无效'; }
};
const NAME_SUR = ['王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗'];
const NAME_GIVEN = ['伟', '芳', '娜', '敏', '静', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚', '梓涵', '子轩', '雨欣', '浩然', '欣怡', '宇轩', '诗涵', '俊杰', '嘉怡', '一诺'];
document.getElementById('nameGen').onclick = () => {
document.getElementById('nameOut').value = NAME_SUR[Math.floor(Math.random() * NAME_SUR.length)] + NAME_GIVEN[Math.floor(Math.random() * NAME_GIVEN.length)];
};
document.getElementById('nameGen5').onclick = () => {
let out = '';
for (let i = 0; i < 5; i++) out += NAME_SUR[Math.floor(Math.random() * NAME_SUR.length)] + NAME_GIVEN[Math.floor(Math.random() * NAME_GIVEN.length)] + String.fromCharCode(10);
document.getElementById('nameOut').value = out.trim();
};
document.getElementById('nowBtn').onclick = () => {
const d = new Date();
const off = -(d.getTimezoneOffset() / 60);
document.getElementById('timeOut').value = '本地时间: ' + d.toLocaleString('zh-CN') + String.fromCharCode(10) + 'UTC: ' + d.toUTCString() + String.fromCharCode(10) + '时间戳(秒): ' + Math.floor(d.getTime() / 1000) + String.fromCharCode(10) + '时间戳(毫秒): ' + d.getTime() + String.fromCharCode(10) + '时区: UTC' + (off >= 0 ? '+' : '') + off;
};
document.getElementById('asciiBtn').onclick = () => {
const v = document.getElementById('asciiIn').value.trim();
const out = document.getElementById('asciiOut');
if (/^\d+$/.test(v)) {
const n = parseInt(v, 10);
if (n < 0 || n > 127) { out.value = '仅支持 0-127'; return; }
out.value = 'ASCII ' + n + ' = "' + (n === 32 ? '(空格)' : n === 9 ? '(Tab)' : n === 10 ? '(换行)' : String.fromCharCode(n)) + '"';
} else if (v.length === 1) {
out.value = '"' + v + '" = ASCII ' + v.charCodeAt(0);
} else {
out.value = v.split('').map(c => c + '=' + c.charCodeAt(0)).join(' ');
}
};
const aesKeyFromPass = async (pass) => {
if (!pass) throw new Error('请输入口令');
const enc = new TextEncoder().encode(pass);
const key = await crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc, iterations: 10000, hash: 'SHA-256' }, key, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
document.getElementById('aesEnc').onclick = async () => {
try {
const key = await aesKeyFromPass(document.getElementById('aesKey').value);
const iv = crypto.getRandomValues(new Uint8Array(12));
const data = new TextEncoder().encode(document.getElementById('aesIn').value);
const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
const all = new Uint8Array(iv.length + ct.byteLength);
all.set(iv); all.set(new Uint8Array(ct), iv.length);
let bin = '';
for (let i = 0; i < all.length; i++) bin += String.fromCharCode(all[i]);
document.getElementById('aesOut').value = btoa(bin);
} catch (e) { document.getElementById('aesOut').value = ' ' + e.message; }
};
document.getElementById('aesDec').onclick = async () => {
try {
const key = await aesKeyFromPass(document.getElementById('aesKey').value);
const raw = atob(document.getElementById('aesIn').value.trim());
const all = new Uint8Array(raw.length);
for (let i = 0; i < raw.length; i++) all[i] = raw.charCodeAt(i);
const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12));
document.getElementById('aesOut').value = new TextDecoder().decode(pt);
} catch (e) { document.getElementById('aesOut').value = ' ' + (e.message || '解密失败（密码错误或数据损坏）'); }
};
document.getElementById('pwBtn').onclick = () => {
const p = document.getElementById('pwIn').value;
const out = document.getElementById('pwOut');
let score = 0;
if (p.length >= 8) score++;
if (p.length >= 12) score++;
if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
if (/\d/.test(p)) score++;
if (/[^a-zA-Z0-9]/.test(p)) score++;
const levels = ['极弱', '弱', '中', '较强', '强', '极强'];
const bits = p.length ? p.length * Math.log2(94) : 0;
out.value = '强度: ' + levels[score] + ' (' + score + '/5)' + String.fromCharCode(10) + '长度: ' + p.length + '字符' + String.fromCharCode(10) + '估算熵: ' + bits.toFixed(1) + 'bits' + String.fromCharCode(10) + '建议: ' + (score >= 4 ? '优秀！' : score >= 3 ? '还不错，再复杂点更好' : '太弱了，快换一个！');
};
document.getElementById('hexEnc').onclick = () => {
document.getElementById('hexOut').value = Array.from(new TextEncoder().encode(document.getElementById('hexIn').value)).map(b => b.toString(16).padStart(2, '0')).join(' ');
};
document.getElementById('hexDec').onclick = () => {
const h = document.getElementById('hexIn').value.replace(/[\s,]/g, '');
if (!/^[0-9a-f]*$/i.test(h) || h.length % 2) { document.getElementById('hexOut').value = 'Hex格式无效'; return; }
const bytes = new Uint8Array(h.length / 2);
for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
document.getElementById('hexOut').value = new TextDecoder().decode(bytes);
};
document.getElementById('uniEnc').onclick = () => {
document.getElementById('uniOut').value = Array.from(document.getElementById('uniIn').value).map(c => {
const cp = c.codePointAt(0);
return cp > 0xFFFF ? '\\u{' + cp.toString(16) + '}' : '\\u' + cp.toString(16).padStart(4, '0');
}).join('');
};
document.getElementById('uniDec').onclick = () => {
const v = document.getElementById('uniIn').value;
document.getElementById('uniOut').value = v.replace(/\\u\{([0-9a-f]+)\}/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-f]{4})/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)));
};
document.getElementById('idBtn').onclick = () => {
const id = document.getElementById('idIn').value.trim();
const out = document.getElementById('idOut');
if (!/^\d{17}[\dXx]$/.test(id)) { out.value = '格式错误，需18位'; return; }
const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const ck = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
let sum = 0;
for (let i = 0; i < 17; i++) sum += +id[i] * w[i];
const expect = ck[sum % 11];
const birth = id.slice(6, 14);
out.value = (expect === id[17].toUpperCase() ? '校验位正确' : '校验位应为 ' + expect) + String.fromCharCode(10) + '出生日期: ' + birth.slice(0, 4) + '-' + birth.slice(4, 6) + '-' + birth.slice(6, 8) + String.fromCharCode(10) + '性别: ' + ((+id[16] % 2) ? '男' : '女');
};
document.getElementById('luhnBtn').onclick = () => {
const v = document.getElementById('luhnIn').value.replace(/\s/g, '');
if (!/^\d+$/.test(v) || v.length < 2) { document.getElementById('luhnOut').value = '请输入数字卡号'; return; }
let sum = 0, dbl = false;
for (let i = v.length - 1; i >= 0; i--) {
let d = +v[i];
if (dbl) { d *= 2; if (d > 9) d -= 9; }
sum += d;
dbl = !dbl;
}
document.getElementById('luhnOut').value = (sum % 10 === 0 ? '校验通过' : '校验失败') + '（Luhn算法）';
};
(function () {
const inEl = document.getElementById('transIn');
const outEl = document.getElementById('transOut');
const statusEl = document.getElementById('transStatus');
const btn = document.getElementById('transBtn');
const clearBtn = document.getElementById('transClearBtn');
if (!btn) return;
btn.addEventListener('click', async () => {
const text = inEl.value.trim();
if (!text) { statusEl.textContent = '注意：先输入要翻译的内容呀'; return; }
const from = document.getElementById('transFrom').value;
const to = document.getElementById('transTo').value;
statusEl.textContent = '注意：正在翻译...';
try {
/* MyMemory 翻译 API（CORS 友好，替代已失效的 Google translate 免费接口）；auto 时按字符集粗判中英 */
const src = from === 'auto' ? (/[\u4e00-\u9fa5]/.test(text) ? 'zh-CN' : 'en') : from;
const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent(src + '|' + to);
const res = await fetch(url);
if (!res.ok) throw new Error('bad status');
const data = await res.json();
const translated = data.responseData && data.responseData.translatedText;
if (!translated) throw new Error('empty');
outEl.textContent = translated;
statusEl.textContent = '注意：翻译完成！';
} catch (e) {
statusEl.textContent = '注意：翻译失败，请检查网络';
}
});
if (clearBtn) clearBtn.addEventListener('click', () => { inEl.value = ''; outEl.textContent = '注意：等待翻译 ...'; statusEl.textContent = ''; });
})();
(function () {
const btn = document.getElementById('qrBtn');
if (!btn) return;
btn.addEventListener('click', () => {
const text = document.getElementById('qrText').value.trim();
const statusEl = document.getElementById('qrStatus');
if (!text) { statusEl.textContent = '注意：请输入文本或链接'; return; }
const size = document.getElementById('qrSize').value;
const box = document.getElementById('qrPreview');
box.innerHTML = '';
const img = document.createElement('img');
img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text);
img.alt = '二维码';
img.width = parseInt(size, 10);
img.height = parseInt(size, 10);
img.style.borderRadius = '8px';
img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
box.appendChild(img);
statusEl.textContent = '注意：二维码已生成，长按图片可保存';
});
})();
(function () {
const btn = document.getElementById('exBtn');
if (!btn) return;
const outEl = document.getElementById('exOut');
const statusEl = document.getElementById('exStatus');
btn.addEventListener('click', async () => {
const amount = parseFloat(document.getElementById('exAmount').value) || 1;
const from = document.getElementById('exFrom').value;
const to = document.getElementById('exTo').value;
if (from === to) {
outEl.value = amount + ' ' + from + ' = ' + amount + ' ' + to;
return;
}
statusEl.textContent = '注意：获取汇率中...';
try {
const res = await fetch('https://api.frankfurter.app/latest?from=' + from + '&to=' + to);
if (!res.ok) throw new Error('bad');
const data = await res.json();
const rate = data.rates[to];
const result = amount * rate;
outEl.value = amount + ' ' + from + ' = ' + result.toFixed(4) + ' ' + to + '\n（汇率 ' + rate + '）';
statusEl.textContent = '注意：更新于 ' + data.date;
} catch (e) {
statusEl.textContent = '注意：汇率获取失败，请稍后再试';
}
});
const swapBtn = document.getElementById('exSwapBtn');
if (swapBtn) swapBtn.addEventListener('click', () => {
const f = document.getElementById('exFrom'), t = document.getElementById('exTo');
const tmp = f.value; f.value = t.value; t.value = tmp;
});
})();
(function () {
const btn = document.getElementById('ipBtn');
if (!btn) return;
const outEl = document.getElementById('ipOut');
const statusEl = document.getElementById('ipStatus');
btn.addEventListener('click', async () => {
const ip = document.getElementById('ipInput').value.trim();
statusEl.textContent = '注意：查询中...';
try {
/* ipwho.is（CORS 友好，替代已失效的 ip.useragentinfo.com） */
const url = 'https://ipwho.is/' + (ip ? '?ip=' + encodeURIComponent(ip) : '');
const res = await fetch(url);
if (!res.ok) throw new Error('bad');
const d = await res.json();
if (d.success !== false) {
const parts = [d.country, d.region, d.city].filter(Boolean);
outEl.value = 'IP 地址：' + d.ip + '\n归属地：' + (parts.join(' · ') || '?') + '\n运营商：' + ((d.connection && d.connection.isp) || '?') + '\n时区：' + ((d.timezone && d.timezone.id) || '?');
statusEl.textContent = '注意：查询成功！';
} else {
throw new Error(d.message || '查询失败');
}
} catch (e) {
statusEl.textContent = '注意：' + e.message;
}
});
})();
(function () {
const btn = document.getElementById('ocrBtn');
if (!btn) return;
const outEl = document.getElementById('ocrOut');
const statusEl = document.getElementById('ocrStatus');
btn.addEventListener('click', async () => {
const file = document.getElementById('ocrFile').files[0];
if (!file) { statusEl.textContent = '注意：请先选择一张图片'; return; }
if (typeof Tesseract === 'undefined') { statusEl.textContent = '注意：OCR 引擎未加载，请刷新重试'; return; }
statusEl.textContent = '注意：正在识别（首次需下载语言包，请耐心等待）...';
outEl.value = '';
try {
const worker = await Tesseract.createWorker('chi_sim+eng');
const { data } = await worker.recognize(file);
outEl.value = data.text;
await worker.terminate();
statusEl.textContent = data.text.trim() ? '注意：识别完成！' : '注意：未识别到文字';
} catch (e) {
statusEl.textContent = '注意：识别失败：' + e.message;
}
});
})();
(function () {
const btn = document.getElementById('weatherBtn');
if (!btn) return;
const outEl = document.getElementById('weatherOut');
const statusEl = document.getElementById('weatherStatus');
btn.addEventListener('click', async () => {
const city = document.getElementById('weatherCity').value.trim();
if (!city) { statusEl.textContent = '🌸 先输入城市名呀'; return; }
statusEl.textContent = '🌸 正在查询...';
outEl.textContent = '查询中...';
try {
const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1&language=zh');
const geo = await geoRes.json();
if (!geo.results || !geo.results.length) { statusEl.textContent = '🌸 没找到这个城市喵'; return; }
const place = geo.results[0];
const wRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude + '&longitude=' + place.longitude + '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto');
const w = await wRes.json();
const cur = w.current;
const wmo = (window.__WMO_WEATHER || {})[cur.weather_code];
const desc = (wmo && wmo.desc) || ('代码' + cur.weather_code);
const today = w.daily;
const cityName = escapeHtml(place.name + (place.admin1 ? '（' + place.admin1 + '）' : '') + (place.country ? ' · ' + place.country : ''));
outEl.innerHTML =
'<b>' + cityName + '</b><br>' +
'🌸 现在：' + escapeHtml(desc) + ' ' + cur.temperature_2m + '°C（体感 ' + cur.apparent_temperature + '°C）<br>' +
'风速：' + cur.wind_speed_10m + 'km/h<br>' +
'今日：最高 ' + today.temperature_2m_max[0] + '°C / 最低 ' + today.temperature_2m_min[0] + '°C';
statusEl.textContent = '🌸 更新于 ' + new Date().toLocaleTimeString();
} catch (e) {
statusEl.textContent = '🌸 查询失败，请检查网络';
}
});
})();
(function () {
const btn = document.getElementById('dictBtn');
if (!btn) return;
const outEl = document.getElementById('dictOut');
const statusEl = document.getElementById('dictStatus');
btn.addEventListener('click', async () => {
const word = document.getElementById('dictWord').value.trim();
if (!word) { statusEl.textContent = '🌸 先输入单词呀'; return; }
statusEl.textContent = '🌸 查询中...';
try {
const res = await fetch('https://dict.youdao.com/jsonapi?q=' + encodeURIComponent(word));
const d = await res.json();
let html = '<b>' + escapeHtml(word) + '</b>';
let found = false;
if (d.ec && d.ec.word && d.ec.word[0]) {
const w = d.ec.word[0];
if (w.phone) html += ' <span style="color:#b5768c">/' + escapeHtml(w.phone) + '/</span>';
if (w.trs) {
const trs = w.trs.map(t => t.tr && t.tr[0] && t.tr[0].l && t.tr[0].l.i ? t.tr[0].l.i.join('；') : '').filter(Boolean);
if (trs.length) { html += '<br>🌸 释义：' + trs.map(escapeHtml).join('<br>　'); found = true; }
}
}
if (d.simple && d.simple.word && d.simple.word[0] && d.simple.word[0].trs) {
const trs = d.simple.word[0].trs.map(t => t.tr && t.tr[0] && t.tr[0].l && t.tr[0].l.i ? t.tr[0].l.i.join('；') : '').filter(Boolean);
if (trs.length) { html += '<br>🌸 释义：' + trs.map(escapeHtml).join('<br>　'); found = true; }
}
if (!found) html += '<br>🌸 没查到这个词的解释';
outEl.innerHTML = html;
statusEl.textContent = '🌸 查询完成！';
} catch (e) {
statusEl.textContent = '🌸 查询失败，请检查网络';
}
});
})();
(function () {
const btn = document.getElementById('poemBtn');
if (!btn) return;
const outEl = document.getElementById('poemOut');
const statusEl = document.getElementById('poemStatus');
btn.addEventListener('click', async () => {
statusEl.textContent = '🌸 正在寻诗...';
try {
/* 一言 API（CORS 友好，替代已失效的 jinrishici 今日诗词）；c=d 取文学向句子 */
const res = await fetch('https://v1.hitokoto.cn/?c=d&c=i');
const d = await res.json();
outEl.innerHTML = '「' + d.hitokoto + '」<br><span style="color:#b5768c; font-size:0.82rem;">—— ' + (d.from_who || '佚名') + ' · ' + (d.from || '一言') + '</span>';
statusEl.textContent = '🌸 诗成！';
} catch (e) {
statusEl.textContent = '🌸 寻诗失败，稍后再试喵';
}
});
const copyBtn = document.getElementById('poemCopyBtn');
if (copyBtn) copyBtn.addEventListener('click', () => {
const text = outEl.textContent.replace(/——/g, '——').trim();
if (!text || text.indexOf('点击') !== -1) { statusEl.textContent = '🌸 先获取一首诗再复制呀'; return; }
navigator.clipboard.writeText(text).then(() => {
statusEl.textContent = '🌸 已复制到剪贴板！';
}).catch(() => { statusEl.textContent = '🌸 复制失败，请手动复制'; });
});
})();
/* ==================== 空气质量查询（Open-Meteo Geocoding + Air Quality API，均 CORS 友好） ==================== */
(function () {
const btn = document.getElementById('airBtn');
if (!btn) return;
const outEl = document.getElementById('airOut');
const statusEl = document.getElementById('airStatus');
const AQI_LEVEL = [[0, '优', '#4caf50'], [51, '良', '#8bc34a'], [101, '轻度污染', '#ff9800'], [151, '中度污染', '#ff5722'], [201, '重度污染', '#e91e63'], [301, '严重污染', '#9c27b0']];
const aqiLevel = function (v) {
let r = AQI_LEVEL[0];
for (const l of AQI_LEVEL) { if (v >= l[0]) r = l; }
return r;
};
btn.addEventListener('click', async () => {
const city = document.getElementById('airCity').value.trim();
if (!city) { statusEl.textContent = '🌸 先输入城市名呀'; return; }
statusEl.textContent = '🌸 查询中...';
try {
const gr = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&name=' + encodeURIComponent(city));
const gd = await gr.json();
if (!gd.results || !gd.results.length) throw new Error('找不到该城市');
const g = gd.results[0];
const ar = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?current=us_aqi,pm10,pm2_5&latitude=' + g.latitude + '&longitude=' + g.longitude + '&timezone=auto');
const ad = await ar.json();
const c = ad.current;
const lv = aqiLevel(c.us_aqi);
outEl.innerHTML = '<div style="font-size:1.4rem; font-weight:700; color:' + lv[2] + ';">' + lv[1] + '（AQI ' + c.us_aqi + '）</div>' +
'<div style="color:#805c6b; font-size:0.88rem; margin-top:6px;"> ' + g.name + (g.country ? ' · ' + g.country : '') + '</div>' +
'<div style="color:#805c6b; font-size:0.88rem;">PM2.5：' + c.pm2_5 + ' μg/m³ ｜ PM10：' + c.pm10 + ' μg/m³</div>' +
'<div style="color:#b5768c; font-size:0.82rem; margin-top:4px;">' + (c.us_aqi <= 100 ? '空气不错，适合出门喵～' : '空气一般，敏感人群注意防护喵') + '</div>';
statusEl.textContent = '🌸 查询成功！';
} catch (e) {
statusEl.textContent = '🌸 ' + (e.message || '查询失败，请稍后再试');
}
});
})();/* ==================== 云吸猫狗（TheCatAPI / dog.ceo，均 CORS 友好） ==================== */
(function () {
const catBtn = document.getElementById('petCatBtn');
const dogBtn = document.getElementById('petDogBtn');
if (!catBtn && !dogBtn) return;
const img = document.getElementById('petImg');
const statusEl = document.getElementById('petStatus');
const show = function (src) {
img.style.display = 'none';
img.onload = function () { img.style.display = 'inline-block'; statusEl.textContent = '🌸 来啦来啦～'; };
img.onerror = function () { statusEl.textContent = '🌸 加载失败，再点一次试试喵'; };
img.src = src;
};
if (catBtn) catBtn.addEventListener('click', function () {
statusEl.textContent = '🌸 正在找猫猫...';
fetch('https://api.thecatapi.com/v1/images/search').then(function (r) { return r.json(); }).then(function (d) {
if (!d || !d[0] || !d[0].url) throw new Error('bad');
show(d[0].url);
}).catch(function () { statusEl.textContent = '🌸 加载失败，再点一次试试喵'; });
});
if (dogBtn) dogBtn.addEventListener('click', function () {
statusEl.textContent = '🌸 正在找狗狗...';
fetch('https://dog.ceo/api/breeds/image/random').then(function (r) { return r.json(); }).then(function (d) {
if (!d || d.status !== 'success') throw new Error('bad');
show(d.message);
}).catch(function () { statusEl.textContent = '🌸 加载失败，再点一次试试喵'; });
});
})();
