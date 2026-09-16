/* ============================================================
 * 工具页新增工具 (js/tools-extra.js)
 * ------------------------------------------------------------
 * 7 个纯前端小工具（对齐 toolboxhub 的常用项）：
 *   图片压缩 / 图片改尺寸 / AI Token 估算 / 年龄计算器
 *   TDEE 热量 / 分期 APR / 简繁转换
 * 全部本地计算，不上传任何数据（简繁词库按需从 jsDelivr 拉 opencc-js，
 * 拉不到时降级为内置常用字表并明确标注）。
 * 面板标记写在 Tools.html，这里只绑逻辑。
 * ============================================================ */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function out(el, text) { if (el) el.value = text; }
  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }
  function saveBlob(blob, name) {
    var u = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 5000);
  }
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('图片读取失败')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function canvasToBlob(cv, type, q) {
    return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, type, q); });
  }

  /* ---------------- 1. 图片压缩 ---------------- */
  on(byId('izFile'), 'change', function () {
    var n = this.files ? this.files.length : 0;
    out(byId('izOut'), n ? '已选 ' + n + ' 张，点「开始压缩」' : '');
  });
  on(byId('izGo'), 'click', async function () {
    var input = byId('izFile'), list = byId('izList');
    if (!input || !input.files || !input.files.length) { out(byId('izOut'), '先选择图片'); return; }
    var q = Number((byId('izQ') || {}).value || 0.72);
    list.innerHTML = '';
    var total0 = 0, total1 = 0;
    for (var i = 0; i < input.files.length; i++) {
      var f = input.files[i];
      try {
        var img = await loadImage(f);
        var cv = document.createElement('canvas');
        cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        cv.getContext('2d').drawImage(img, 0, 0);
        var blob = await canvasToBlob(cv, 'image/jpeg', q);
        if (!blob) continue;
        total0 += f.size; total1 += blob.size;
        var row = document.createElement('div');
        row.className = 'xt-item';
        row.innerHTML = '<span class="xt-name"></span><span class="xt-size"></span>';
        row.querySelector('.xt-name').textContent = f.name;
        row.querySelector('.xt-size').textContent = fmtSize(f.size) + ' → ' + fmtSize(blob.size) +
          '（省 ' + Math.max(0, Math.round((1 - blob.size / f.size) * 100)) + '%）';
        var b = document.createElement('button');
        b.className = 'btn-primary'; b.type = 'button'; b.textContent = '下载';
        b.addEventListener('click', function (bb, blobRef, name) {
          return function () { saveBlob(blobRef, name.replace(/\.[^.]+$/, '') + '-compressed.jpg'); };
        }(b, blob, f.name));
        row.appendChild(b);
        list.appendChild(row);
      } catch (e) { /* 单张失败不影响其它 */ }
    }
    out(byId('izOut'), total0 ? '合计 ' + fmtSize(total0) + ' → ' + fmtSize(total1) + '（省 ' + Math.round((1 - total1 / total0) * 100) + '%）' : '没有可压缩的图片');
  });

  /* ---------------- 2. 图片改尺寸 ---------------- */
  on(byId('irPreset'), 'change', function () {
    var map = { ig: [1080, 1080], igs: [1080, 1350], fb: [1200, 630], tb: [800, 800], wx: [900, 500] };
    var m = map[this.value];
    if (!m) return;
    if (byId('irW')) byId('irW').value = m[0];
    if (byId('irH')) byId('irH').value = m[1];
  });
  on(byId('irGo'), 'click', async function () {
    var input = byId('irFile');
    if (!input || !input.files || !input.files.length) { out(byId('irOut'), '先选择图片'); return; }
    var f = input.files[0];
    var w = parseInt((byId('irW') || {}).value, 10) || 0;
    var h = parseInt((byId('irH') || {}).value, 10) || 0;
    try {
      var img = await loadImage(f);
      var keep = byId('irKeep') && byId('irKeep').checked;
      if (keep) { var r = img.naturalHeight / img.naturalWidth; h = Math.round((w || img.naturalWidth) * r); }
      if (!w) w = img.naturalWidth;
      if (!h) h = img.naturalHeight;
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      var png = (f.type === 'image/png');
      var blob = await canvasToBlob(cv, png ? 'image/png' : 'image/jpeg', 0.92);
      saveBlob(blob, f.name.replace(/\.[^.]+$/, '') + '-' + w + 'x' + h + (png ? '.png' : '.jpg'));
      out(byId('irOut'), '原图 ' + img.naturalWidth + '×' + img.naturalHeight + ' → 输出 ' + w + '×' + h + '（' + fmtSize(blob.size) + '）');
    } catch (e) { out(byId('irOut'), '处理失败：' + e.message); }
  });

  /* ---------------- 3. AI Token 估算 ---------------- */
  var MODELS = [
    ['gpt-4o', 'GPT-4o', 2.5, 10],
    ['gpt-4o-mini', 'GPT-4o mini', 0.15, 0.6],
    ['claude-3-5-sonnet', 'Claude 3.5 Sonnet', 3, 15],
    ['claude-3-haiku', 'Claude 3 Haiku', 0.25, 1.25],
    ['gemini-1.5-pro', 'Gemini 1.5 Pro', 1.25, 5],
    ['gemini-1.5-flash', 'Gemini 1.5 Flash', 0.075, 0.3]
  ];
  function estTokens(text) {
    if (!text) return 0;
    var cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    var punct = (text.match(/[\uff0c\u3002\uff01\uff1f\u3001\uff1b\uff1a\uff08\uff09\u300c\u300d\u201c\u201d\u2026\u2014]/g) || []).length;
    var rest = Math.max(0, text.length - cjk - punct);
    return Math.ceil(cjk * 0.8 + punct * 0.6 + rest / 4);
  }
  on(byId('tkGo'), 'click', function () {
    var text = (byId('tkIn') || {}).value || '';
    var n = estTokens(text);
    var m = MODELS.filter(function (x) { return x[0] === ((byId('tkModel') || {}).value || 'gpt-4o'); })[0] || MODELS[0];
    out(byId('tkOut'),
      '字符数：' + text.length + '（汉字 ' + ((text.match(/[\u3400-\u9fff]/g) || []).length) + '）\n' +
      '估算 token：约 ' + n + ' 个\n' +
      m[1] + ' 价格（每 100 万 token）：输入 $' + m[2] + ' / 输出 $' + m[3] + '\n' +
      '按纯输入估：$' + (n / 1e6 * m[2]).toFixed(5) + '；若含等量输出：$' + (n / 1e6 * (m[2] + m[3])).toFixed(5) + '\n\n' +
      '说明：这是按「汉字 0.8 token/字、英文 4 字符/token」的粗估，误差约 ±20%；价格会变，以各家官网为准。');
  });

  /* ---------------- 4. 年龄计算器 ---------------- */
  on(byId('agGo'), 'click', function () {
    var v = (byId('agDate') || {}).value;
    if (!v) { out(byId('agOut'), '先选出生日期'); return; }
    var b = new Date(v + 'T00:00:00');
    var now = new Date();
    if (b > now) { out(byId('agOut'), '出生日期不能是未来'); return; }
    var age = now.getFullYear() - b.getFullYear();
    var mdiff = now.getMonth() - b.getMonth();
    if (mdiff < 0 || (mdiff === 0 && now.getDate() < b.getDate())) age--;
    var months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
    if (now.getDate() < b.getDate()) months--;
    var next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
    if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next.setFullYear(now.getFullYear() + 1);
    var days = Math.ceil((next - now) / 86400000);
    var totalDays = Math.floor((now - b) / 86400000);
    var zodiac = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'][(b.getFullYear() - 4) % 12];
    var stars = [[1, 20, '摩羯'], [2, 19, '水瓶'], [3, 21, '双鱼'], [4, 20, '白羊'], [5, 21, '金牛'], [6, 22, '双子'], [7, 23, '巨蟹'], [8, 23, '狮子'], [9, 23, '处女'], [10, 24, '天秤'], [11, 23, '天蝎'], [12, 22, '射手'], [13, 1, '摩羯']];
    var star = '摩羯';
    for (var i = 0; i < stars.length - 1; i++) { if (b.getMonth() + 1 === stars[i][0] && b.getDate() >= stars[i][1]) star = stars[i][2]; }
    if (b.getMonth() + 1 === 1 && b.getDate() < 20) star = '摩羯';
    out(byId('agOut'),
      '周岁：' + age + ' 岁\n' +
      '虚岁：' + (age + 1) + ' 岁（传统说法）\n' +
      '合计：' + months + ' 个月 / ' + totalDays + ' 天\n' +
      '下一次生日：' + next.getFullYear() + '-' + (next.getMonth() + 1) + '-' + next.getDate() + '，还有 ' + days + ' 天\n' +
      '生肖：' + zodiac + '　星座：' + star);
  });

  /* ---------------- 5. TDEE 热量 ---------------- */
  on(byId('tdGo'), 'click', function () {
    var sex = (byId('tdSex') || {}).value || 'm';
    var age = parseFloat((byId('tdAge') || {}).value);
    var h = parseFloat((byId('tdH') || {}).value);
    var w = parseFloat((byId('tdW') || {}).value);
    var act = parseFloat((byId('tdAct') || {}).value || 1.375);
    if (!age || !h || !w) { out(byId('tdOut'), '把年龄、身高、体重都填上'); return; }
    var bmr = 10 * w + 6.25 * h - 5 * age + (sex === 'm' ? 5 : -161);
    var tdee = bmr * act;
    out(byId('tdOut'),
      '基础代谢 BMR：' + Math.round(bmr) + ' kcal/天\n' +
      '每日总消耗 TDEE：' + Math.round(tdee) + ' kcal/天（活动系数 ' + act + '）\n\n' +
      '减脂（约 -20%）：' + Math.round(tdee * 0.8) + ' kcal/天\n' +
      '维持：' + Math.round(tdee) + ' kcal/天\n' +
      '增肌（约 +12%）：' + Math.round(tdee * 1.12) + ' kcal/天\n\n' +
      '公式：Mifflin-St Jeor；结果为估算值，仅供参考。');
  });

  /* ---------------- 6. 分期 APR ---------------- */
  on(byId('apGo'), 'click', function () {
    var P = parseFloat((byId('apP') || {}).value);
    var n = parseInt((byId('apN') || {}).value, 10);
    var per = parseFloat((byId('apPer') || {}).value || 0);   /* 每期手续费率 % */
    var once = parseFloat((byId('apOnce') || {}).value || 0); /* 一次性手续费率 % */
    if (!P || !n) { out(byId('apOut'), '填上分期金额和期数'); return; }
    var net = P * (1 - once / 100);
    var feeEach = P * per / 100;
    var pay = P / n + feeEach;
    var total = pay * n + P * once / 100;
    function npv(i) { var s = 0; for (var k = 1; k <= n; k++) s += pay / Math.pow(1 + i, k); return s - net; }
    var apr = 0;
    if (npv(0) > 0) {
      var lo = 0, hi = 1;
      for (var it = 0; it < 200; it++) { var mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; }
      apr = (lo + hi) / 2 * 12 * 100;
    }
    out(byId('apOut'),
      '每期还款：' + pay.toFixed(2) + ' 元（本金 ' + (P / n).toFixed(2) + ' + 手续费 ' + feeEach.toFixed(2) + '）\n' +
      '还款总额：' + total.toFixed(2) + ' 元\n' +
      '总手续费：' + (total - P).toFixed(2) + ' 元\n' +
      '名义年化（费率×12）：' + (per * 12).toFixed(2) + '%\n' +
      '实际年化 IRR（APR）：约 ' + apr.toFixed(2) + '%\n\n' +
      '为什么差这么多：手续费按全额本金收，但你的本金是逐月还掉的。');
  });

  /* ---------------- 7. 简繁转换 ---------------- */
  var S = '国学术体们发后里说时门问间关开会头长见现电车东马鸟鱼龙贝页风飞气书读写记认让话请谢这幺样儿广厂场单买卖货贵钱银军农业产团园远运达过进连边还无万与丰为义乐习乡争于亏云亚亲亿从仅仓仪价众优伟传伤汉语词语课谁英语词典';
  var T = '國學術體們發後裡說時門問間關開會頭長見現電車東馬鳥魚龍貝頁風飛氣書讀寫記認讓話請謝這麼樣兒廣廠場單買賣貨貴錢銀軍農業產團園遠運達過進連邊還無萬與豐為義樂習鄉爭於虧雲亞親億從僅倉儀價眾優偉傳傷漢語詞語課誰英語詞典';
  var CONV = null, CONV_TRIED = false;
  function builtinConv(text, toTrad) {
    var a = toTrad ? S : T, b = toTrad ? T : S, n = Math.min(a.length, b.length), map = {};
    for (var i = 0; i < n; i++) map[a[i]] = b[i];
    return text.replace(/[\s\S]/g, function (ch) { return map[ch] || ch; });
  }
  function withConverter(fn) {
    if (window.OpenCC) { fn(window.OpenCC.Converter({ from: 'cn', to: 'tw' })); return; }
    if (CONV_TRIED) { fn(null); return; }
    CONV_TRIED = true;
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/opencc-js@1.0.5/dist/umd/full.js';
    s.onload = function () {
      try { CONV = window.OpenCC.Converter({ from: 'cn', to: 'tw' }); } catch (e) { CONV = null; }
      fn(CONV);
    };
    s.onerror = function () { fn(null); };
    document.head.appendChild(s);
  }
  function doConv(toTrad) {
    var text = (byId('zhIn') || {}).value || '';
    if (!text) { out(byId('zhOut'), '先输入要转换的文字'); return; }
    withConverter(function () {
      out(byId('zhOut'), builtinConv(text, toTrad) + '\n\n—— 注：以上为内置常用字表结果（首字库加载中或不可用），个别词可能不准。');
    });
  }
  on(byId('zhT2S'), 'click', function () {
    var text = (byId('zhIn') || {}).value || '';
    if (!text) { out(byId('zhOut'), '先输入要转换的文字'); return; }
    withConverter(function (conv) {
      if (!conv) { out(byId('zhOut'), builtinConv(text, false) + '\n\n—— 注：内置常用字表结果，个别词可能不准。'); return; }
      var r;
      try { r = window.OpenCC.Converter({ from: 'tw', to: 'cn' })(text); } catch (e) { r = builtinConv(text, false); }
      out(byId('zhOut'), r);
    });
  });
  on(byId('zhS2T'), 'click', function () {
    var text = (byId('zhIn') || {}).value || '';
    if (!text) { out(byId('zhOut'), '先输入要转换的文字'); return; }
    withConverter(function (conv) {
      if (!conv) { out(byId('zhOut'), builtinConv(text, true) + '\n\n—— 注：内置常用字表结果，个别词可能不准。'); return; }
      out(byId('zhOut'), conv(text));
    });
  });
  on(byId('zhCopy'), 'click', function () {
    var el = byId('zhOut');
    if (!el || !el.value) return;
    if (navigator.clipboard) navigator.clipboard.writeText(el.value);
    el.select();
  });
})();
