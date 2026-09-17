/* ============================================================
 * 工具页 App 化 (tools-app.js) —— 仅手机端
 * ------------------------------------------------------------
 * 现状：53 个 .tool-tab 按钮靠 flex-wrap 铺开，手机上是「一堵墙」；
 *      每个工具又都堆在同一页里，切换没有层级感。
 * 改法：标签墙 → 工具网格入口，点一个工具 = 进它的全屏二级页。
 * 三条约束：
 *   1) 网格完全由现有 .tool-tab 生成，不硬编码工具清单（加工具不用动这里）
 *   2) 点网格项先 btn.click()，复用 Tools.js 原有的 .active 切换逻辑，
 *      不复制第二份显隐代码（以后改切换逻辑不会两边不一致）
 *   3) 面板用「搬移」而不是克隆：里面有 canvas / input / 已算好的结果，
 *      克隆会丢状态也丢监听器
 * 桌面端一行都不碰（narrow() 为假直接 return）。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }
  function byId(id) { return document.getElementById(id); }
  function q(sel, root) { return (root || document).querySelector(sel); }

  /* 图标表：只影响观感，取不到就退回通用扳手。键 = data-tool */
  var ICONS = {
    converter: 'fa-exchange-alt', random: 'fa-dice', countdown: 'fa-hourglass-half',
    password: 'fa-key', lottery: 'fa-ticket-alt', color: 'fa-palette',
    counter: 'fa-font', base64: 'fa-code', urlcode: 'fa-link',
    ts: 'fa-clock', uuid: 'fa-fingerprint', textstat: 'fa-chart-bar',
    case: 'fa-text-height', jsonfmt: 'fa-code', hash: 'fa-hashtag',
    colorconv: 'fa-eye-dropper', passgen: 'fa-shield-alt', regex: 'fa-asterisk',
    baseconv: 'fa-calculator', unit: 'fa-ruler', caesar: 'fa-lock',
    datediff: 'fa-calendar-alt', pct: 'fa-percent', morse: 'fa-ellipsis-h',
    diff: 'fa-code-branch', rev: 'fa-exchange-alt', dice: 'fa-dice',
    prime: 'fa-divide', bmi: 'fa-weight', discount: 'fa-tags',
    zodiac: 'fa-paw', rmb: 'fa-coins', sort: 'fa-sort-alpha-down',
    urlparse: 'fa-globe', namegen: 'fa-user', timecalc: 'fa-clock',
    ascii: 'fa-keyboard', aes: 'fa-lock', strength: 'fa-shield-alt',
    hex: 'fa-hashtag', unicode: 'fa-globe', idcard: 'fa-id-card',
    luhn: 'fa-credit-card', translate: 'fa-language', qrcode: 'fa-qrcode',
    exchange: 'fa-money-bill-wave', iplookup: 'fa-map-marker-alt', ocr: 'fa-image',
    weather: 'fa-cloud-sun', air: 'fa-wind', pet: 'fa-cat',
    imgzip: 'fa-compress', imgresize: 'fa-crop-simple', token: 'fa-robot',
    age: 'fa-cake-candles', tdee: 'fa-fire', apr: 'fa-file-invoice-dollar', zhconv: 'fa-language',
    dict: 'fa-book', poem: 'fa-feather-alt'
  };

  function buildGrid(tabs) {
    var wrap = document.createElement('div');
    wrap.className = 'mgrid-wrap';
    var head = document.createElement('div');
    head.className = 'mgrid-head';
    var grid = document.createElement('div');
    grid.className = 'mgrid';

    var n = 0;
    Array.prototype.forEach.call(tabs, function (btn) {
      var id = btn.getAttribute('data-tool');
      if (!id || !byId('tool-' + id)) return;      /* 没有对应面板的跳过 */
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'mgrid-item';
      item.setAttribute('data-tool', id);

      var icon = document.createElement('i');
      icon.className = 'fas ' + (ICONS[id] || 'fa-wrench');
      var name = document.createElement('span');
      name.className = 'mg-name';
      name.textContent = (btn.textContent || '').trim() || id;
      var arrow = document.createElement('i');
      arrow.className = 'fas fa-chevron-right mg-arrow';

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(arrow);
      grid.appendChild(item);
      n++;
    });

    head.textContent = '全部工具 · ' + n;
    wrap.appendChild(head);
    wrap.appendChild(grid);
    return wrap;
  }

  function openTool(id, label) {
    if (!narrow()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    if (window.AppShell.detailOpen()) return;
    var panel = byId('tool-' + id);
    if (!panel) return;

    /* 记下进来之前是哪个工具，出去时要还原回去 */
    var prevTab = document.querySelector('.tool-tab.active');

    /* 先点原标签按钮：面板要拿到 .active 才可见，也保证状态与原有逻辑一致 */
    var tab = document.querySelector('.tool-tab[data-tool="' + id + '"]');
    if (tab) tab.click();

    var wrap = document.createElement('div');
    wrap.className = 'tool-detail';
    window.AppShell.openDetail({
      title: label || '工具',
      content: wrap,
      /* 还原「当前工具」。原来关掉二级页只把面板搬回原位、不动 .active，
         于是刚看过的那个面板返回列表后仍然是 .active，会继续显示在页面下方
         —— 看起来就像二级页的内容没退干净。 */
      onClose: function () {
        Array.prototype.forEach.call(document.querySelectorAll('.tool-panel'), function (x) {
          x.classList.remove('active');
        });
        if (prevTab) prevTab.click();
      },
    });
    window.AppShell.adopt(panel, wrap);
  }

  function init() {
    if (!narrow()) return;
    var tabs = document.querySelectorAll('.tool-tab');
    var row = q('.tools-tabs');
    if (!tabs.length || !row || q('.mgrid')) return;

    /* 开关挂在 html 上：脚本没跑到就整块不生效，页面退回原来的标签墙 */
    document.documentElement.classList.add('tool-grid');
    row.parentNode.insertBefore(buildGrid(tabs), row);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.detail-view')) return;   /* 二级页里的点击不重复开卡 */
      var item = t.closest('.mgrid-item');
      if (!item) return;
      var name = q('.mg-name', item);
      openTool(item.getAttribute('data-tool'), name ? name.textContent : '工具');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) { if (isNarrow) init(); });
  }
})();
