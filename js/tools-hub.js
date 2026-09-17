/* ============================================================
 * 工具页入口网格 (js/tools-hub.js)  —— 仅桌面端
 * ------------------------------------------------------------
 * 现状：53 个 .tool-tab 按钮铺成一堵墙。这里在墙上加一层
 * 「分类胶囊 + 卡片网格」，点卡片仍然去 click() 原来的 .tool-tab，
 * 复用 Tools.js 既有的 .active 切换逻辑，不复制第二份显隐代码。
 * 手机端一行都不碰（> 768px 才生效，窄屏交给 tools-app.js 的网格）。
 * 图标与 tools-app.js 的 ICONS 保持一致，改了记得两边同步。
 * ============================================================ */
(function () {
  'use strict';

  var META = {
  "converter":["dev","转换器","中文 ⇄ 二进制互转，也能把图片转成二进制再还原","fa-exchange-alt"],"base64":["dev","Base64","文本与 Base64 相互转换","fa-code"],"urlcode":["dev","URL 编解码","网址和参数的编码与解码","fa-link"],"ts":["dev","时间戳","时间戳与日期时间互转","fa-clock"],"uuid":["dev","UUID","批量生成 UUID v4","fa-fingerprint"],"jsonfmt":["dev","JSON 格式化","格式化、压缩、校验 JSON","fa-code"],"hash":["dev","Hash 摘要","计算 MD5 / SHA 系列摘要","fa-hashtag"],"regex":["dev","正则测试","实时测试正则匹配与分组","fa-asterisk"],"baseconv":["dev","进制转换","2 / 8 / 10 / 16 进制互转","fa-calculator"],"caesar":["dev","凯撒密码","按位移加密解密文本","fa-lock"],"morse":["dev","摩斯电码","文本与摩斯电码互转","fa-ellipsis-h"],"ascii":["dev","ASCII 码表","字符与 ASCII 码对照","fa-keyboard"],"aes":["dev","AES 加解密","对称加密，支持自定义密钥","fa-lock"],"hex":["dev","Hex 编解码","文本与十六进制互转","fa-hashtag"],"unicode":["dev","Unicode 转义","文本与 \\uXXXX 转义互转","fa-globe"],"counter":["text","字符统计","边打字边统计字数、词数与行数","fa-font"],"textstat":["text","文本统计","统计中英文、数字、行数与段落","fa-chart-bar"],"case":["text","大小写转换","一键切换大小写、首字母大写","fa-text-height"],"diff":["text","文本对比","逐行对比两段文本的差异","fa-code-branch"],"rev":["text","文本反转","反转字符顺序或逐行倒序","fa-exchange-alt"],"sort":["text","行排序去重","按行排序、去重、打乱","fa-sort-alpha-down"],"namegen":["text","姓名生成","随机生成中文姓名","fa-user"],"translate":["text","翻译","多语言互译","fa-language"],"dict":["text","词典查询","查英文单词释义","fa-book"],"poem":["text","古诗词","随机抽一句或一首古诗词","fa-feather-alt"],"unit":["calc","单位换算","长度、重量、面积、温度换算","fa-ruler"],"datediff":["calc","日期差","算两个日期相差多少天","fa-calendar-alt"],"pct":["calc","百分比","百分比增减、占比计算","fa-percent"],"prime":["calc","质数判断","判断质数并分解质因数","fa-divide"],"timecalc":["calc","时间加减","在时间点上加减时分秒天","fa-clock"],"color":["media","取色器","屏幕上取色，显示 HEX / RGB","fa-palette"],"colorconv":["media","颜色转换","HEX / RGB / HSL 互转","fa-eye-dropper"],"qrcode":["media","二维码生成","输入文字生成二维码，可下载 PNG","fa-qrcode"],"ocr":["media","图片文字识别","从图片里提取文字（浏览器本地识别）","fa-image"],"urlparse":["net","网址解析","拆解 URL 的协议、域名、参数","fa-globe"],"iplookup":["net","IP 归属查询","查 IP 的归属地与运营商","fa-map-marker-alt"],"weather":["net","天气查询","查城市实时天气与预报","fa-cloud-sun"],"air":["net","空气质量","查城市 AQI 与主要污染物","fa-wind"],"bmi":["life","BMI 计算","按身高体重算 BMI 与健康区间","fa-weight"],"discount":["life","折扣计算","打折价、满减与原价换算","fa-tags"],"zodiac":["life","生肖属相","按年份查生肖与星座","fa-paw"],"rmb":["life","金额大写","数字金额转人民币大写","fa-coins"],"idcard":["life","身份证校验","校验 18 位身份证号并解读信息","fa-id-card"],"luhn":["life","Luhn 校验","校验银行卡号等数字串","fa-credit-card"],"exchange":["life","汇率换算","按实时汇率换算货币","fa-money-bill-wave"],"pet":["life","云吸猫狗","随机来一张猫猫狗狗","fa-cat"],"password":["sec","密码生成","自定义长度与字符类型，一键复制","fa-key"],"passgen":["sec","密码强度","评估密码强度并给出建议","fa-shield-alt"],"strength":["sec","安全强度","检查密码的安全等级","fa-shield-alt"],"random":["fun","随机数","生成一个或多个不重复的随机数","fa-dice"],"countdown":["fun","倒计时","设定目标时间，实时显示剩余天时分","fa-hourglass-half"],"lottery":["fun","抽签","每行一个选项，随机抽取一个","fa-ticket-alt"],"dice":["fun","掷骰子","掷出 1~6 的随机点数","fa-dice"],
  "imgzip": ["media","图片压缩","本地压缩 JPG / PNG / WebP，可批量处理","fa-compress"],
  "imgresize": ["media","图片改尺寸","按尺寸或社交平台预设缩放并下载","fa-crop-simple"],
  "token": ["calc","AI Token 估算","粗估 prompt 的 token 数与 API 费用","fa-robot"],
  "age": ["calc","年龄计算器","算周岁虚岁、下次生日倒数与生肖","fa-cake-candles"],
  "tdee": ["life","TDEE 热量","算基础代谢与每日总消耗、减脂增肌目标","fa-fire"],
  "apr": ["life","分期 APR","把分期手续费换算成实际年化利率","fa-file-invoice-dollar"],
  "zhconv": ["text","简繁转换","简体与繁体互转（OpenCC，可降级）","fa-language"]
  };
  var CATS = [["dev","开发者","fa-code"],["text","文字工具","fa-font"],["calc","计算·换算","fa-calculator"],["media","图片·媒体","fa-image"],["net","网络·查询","fa-globe"],["life","生活·健康","fa-heart"],["sec","密码·安全","fa-shield-alt"],["fun","随机·娱乐","fa-dice"]];

  function desktop() { return window.innerWidth > 768; }
  function byId(id) { return document.getElementById(id); }

  function count(cat) {
    var n = 0;
    for (var k in META) { if (META.hasOwnProperty(k) && (cat === 'all' || META[k][0] === cat)) n++; }
    return n;
  }

  function chip(key, label, icon, n, on) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'hub-chip' + (on ? ' is-on' : '');
    b.setAttribute('data-cat', key);
    b.innerHTML = '<i class="fas ' + icon + '"></i><span>' + label + '</span><span class="hub-count">' + n + '</span>';
    return b;
  }

  function card(id) {
    var m = META[id];
    var a = document.createElement('a');
    a.className = 'hub-card';
    a.href = 'javascript:void(0)';
    a.setAttribute('data-tool', id);
    a.innerHTML = '<span class="hub-ico"><i class="fas ' + m[3] + '"></i></span>' +
      '<span class="hub-go"><i class="fas fa-chevron-right"></i></span>' +
      '<span class="hub-name"></span><span class="hub-desc"></span>';
    a.querySelector('.hub-name').textContent = m[1];
    a.querySelector('.hub-desc').textContent = m[2];
    return a;
  }

  function render(cat) {
    var grid = byId('toolsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(META).forEach(function (id) {
      if (cat !== 'all' && META[id][0] !== cat) return;
      if (!document.querySelector('.tool-tab[data-tool="' + id + '"]')) return;
      grid.appendChild(card(id));
    });
  }

/* 进桌面「二级页」之前激活的那个 tab。关闭时要还原回去 —— 否则刚看过的
   面板仍然是 .active，返回工具列表后它会继续显示在网格下方。 */
var prevTab = null;

function openTool(id, push) {
    var tab = document.querySelector('.tool-tab[data-tool="' + id + '"]');
    if (!tab) return;
    /* 只在第一次进入时记：切换工具走 hashchange，会反复调到 openTool */
    if (!document.documentElement.classList.contains('tool-open')) {
      prevTab = document.querySelector('.tool-tab.active');
    }
    tab.click();
    var meta = META[id];
    var nameEl = byId('toolsBackName');
    if (nameEl && meta) nameEl.textContent = meta[1];
    document.documentElement.classList.add('tool-open');
    if (push) { try { if (location.hash !== HASH + id) location.hash = HASH + id; } catch (e) {} }
    var back = byId('toolsBack');
    if (back && back.scrollIntoView) back.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var HASH = '#tool/';

  function closeTool(silent) {
    document.documentElement.classList.remove('tool-open');
    /* 只摘 tool-open、不动 .active 的话，刚看过的面板会赖在页面上不走 */
    if (prevTab) { prevTab.click(); prevTab = null; }
    if (!silent) {
      var bar = byId('toolsFilter');
      if (bar && bar.scrollIntoView) bar.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /* 支持 #tool/xxx 直达与浏览器返回键：哈希变了就跟着开/关 */
  function openFromHash(silent) {
    var h = String(location.hash || '');
    if (h.indexOf(HASH) === 0) {
      var id = h.slice(HASH.length);
      if (id && id.length < 40 && id.indexOf('"') < 0 && id.indexOf(']') < 0 &&
        document.querySelector('.tool-tab[data-tool="' + id + '"]')) { openTool(id, false); return; }
    }
    closeTool(silent);
  }

  function init() {
    if (!desktop()) return;
    var bar = byId('toolsFilter'), grid = byId('toolsGrid');
    if (!bar || !grid || bar.getAttribute('data-built')) return;
    bar.setAttribute('data-built', '1');
    document.documentElement.classList.add('tool-hub');

    bar.appendChild(chip('all', '全部', 'fa-border-all', count('all'), true));
    CATS.forEach(function (c) { bar.appendChild(chip(c[0], c[1], c[2], count(c[0]), false)); });
    render('all');

    bar.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('.hub-chip') : null;
      if (!b) return;
      Array.prototype.forEach.call(bar.querySelectorAll('.hub-chip'), function (x) { x.classList.toggle('is-on', x === b); });
      render(b.getAttribute('data-cat'));
    });

    var backBtn = byId('toolsBackBtn');
    if (backBtn) backBtn.addEventListener('click', function () {
      if (String(location.hash || '').indexOf(HASH) === 0 && history.length > 1) history.back();
      else closeTool(false);
    });
    window.addEventListener('hashchange', function () { openFromHash(false); });
    openFromHash(true);

    grid.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('.hub-card') : null;
      if (!a) return;
      e.preventDefault();
      openTool(a.getAttribute('data-tool'), true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) {
      var root = document.documentElement;
      if (isNarrow) {
        root.classList.remove('tool-hub');
        /* 从桌面宽屏缩到手机时，桌面那套「二级页」状态要一并收掉，
           否则面板会以 .active 的身份挂在手机网格下面 */
        closeTool(true);
      } else init();
    });
  }
})();
