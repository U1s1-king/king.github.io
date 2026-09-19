/* ============================================================
 * 工具页 App 化 (js/tools-app.js) —— 仅手机端
 * ------------------------------------------------------------
 * 现状：60 个 .tool-tab 按钮靠 flex-wrap 铺开，手机上是「一堵墙」；
 *      每个工具又都堆在同一页里，切换没有层级感。
 *
 * 改法：把手机端做成真正的三级结构 ——
 *   一级页  分类折叠面板（手风琴，默认全收起）—— 只有分类，没有工具
 *   二级页  某个分类下的工具列表（点分类进）
 *   三级页  工具本体（点工具进，AppShell 全屏详情层）
 *   首页底部的 60 个 .tool-panel 与 .info-box 整体移出，一级页不再出现。
 *
 * 四条约束：
 *   1) 分类与图标取自 js/tools-hub.js 的 HUB_META（若存在），工具清单
 *      完全由现有 .tool-tab 生成 —— 加工具不用动这里，加分类改 tools-hub.js
 *   2) 点网格项先 btn.click()，复用 Tools.js 原有的 .active 切换逻辑，
 *      不复制第二份显隐代码（以后改切换逻辑不会两边不一致）
 *   3) 面板用「搬移」而不是克隆：里面有 canvas / input / 已算好的结果，
 *      克隆会丢状态也丢监听器
 *   4) 桌面端一行都不碰（narrow() 为假直接 return，且不注入任何节点）
 *
 * 展开状态记在 localStorage（键 tools-cat-open），刷新/返回后保留。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }
  function byId(id) { return document.getElementById(id); }
  function q(sel, root) { return (root || document).querySelector(sel); }

  var OPEN_KEY = 'tools-cat-open';

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

  /* 兜底分类：tools-hub.js 没加载（或没暴露 HUB_META）时按关键字粗分，
     保证任何工具都有归属，不会掉出分类。加工具时若忘了登记分类，
     会落进「其它」而不是凭空消失。 */
  var FALLBACK = {
    dev: ['converter', 'base64', 'urlcode', 'ts', 'uuid', 'jsonfmt', 'hash', 'regex',
      'baseconv', 'caesar', 'morse', 'ascii', 'aes', 'hex', 'unicode'],
    text: ['counter', 'textstat', 'case', 'diff', 'rev', 'sort', 'namegen', 'translate',
      'dict', 'poem', 'zhconv'],
    calc: ['unit', 'datediff', 'pct', 'prime', 'timecalc', 'token', 'age'],
    media: ['color', 'colorconv', 'qrcode', 'ocr', 'imgzip', 'imgresize'],
    net: ['urlparse', 'iplookup', 'weather', 'air'],
    life: ['bmi', 'discount', 'zodiac', 'rmb', 'idcard', 'luhn', 'exchange', 'pet', 'tdee', 'apr'],
    sec: ['password', 'passgen', 'strength'],
    fun: ['random', 'countdown', 'lottery', 'dice']
  };
  var FALLBACK_LABEL = {
    dev: ['开发者', 'fa-code'], text: ['文字工具', 'fa-font'],
    calc: ['计算·换算', 'fa-calculator'], media: ['图片·媒体', 'fa-image'],
    net: ['网络·查询', 'fa-globe'], life: ['生活·健康', 'fa-heart'],
    sec: ['密码·安全', 'fa-shield-alt'], fun: ['随机·娱乐', 'fa-dice'],
    other: ['其它工具', 'fa-wrench']
  };

  /* 分类表：优先用 tools-hub.js 暴露的 HUB_META（桌面/手机共用一份，
     两边不会因为各写一张表而分叉）。 */
  function catalog() {
    var meta = window.HUB_META;
    if (meta && typeof meta === 'object') return meta;
    var out = {};
    for (var cat in FALLBACK) {
      if (!FALLBACK.hasOwnProperty(cat)) continue;
      FALLBACK[cat].forEach(function (id) { out[id] = [cat]; });
    }
    return out;
  }

  function catLabel(cat) {
    var list = window.HUB_CATS;
    if (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i][0] === cat) return [list[i][1], list[i][2]];
      }
    }
    return FALLBACK_LABEL[cat] || FALLBACK_LABEL.other;
  }

  /* ---------- 展开状态 ---------- */
  function readOpen() {
    try {
      var raw = JSON.parse(localStorage.getItem(OPEN_KEY) || '{}');
      return raw && typeof raw === 'object' && !(raw instanceof Array) ? raw : {};
    } catch (e) { return {}; }
  }
  function writeOpen(map) {
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(map)); } catch (e) {}
  }

  /* ---------- 构建一级页：分类折叠面板 ---------- */
  /* 收集当前页面上真实存在的工具（有 .tool-tab 且对应面板存在），
     按分类归组；没登记的落进 other。 */
  function collect() {
    var meta = catalog();
    var groups = [];
    var index = {};
    Array.prototype.forEach.call(document.querySelectorAll('.tool-tab'), function (btn) {
      var id = btn.getAttribute('data-tool');
      if (!id || !byId('tool-' + id)) return;
      var m = meta[id];
      var cat = (m && m[0]) || 'other';
      if (!index[cat]) { index[cat] = { cat: cat, items: [] }; groups.push(index[cat]); }
      index[cat].items.push({ id: id, label: (btn.textContent || '').trim() || id });
    });
    return groups;
  }

  function buildAccordion(groups, openMap) {
    var wrap = document.createElement('div');
    wrap.className = 'tcat-wrap';

    var head = document.createElement('div');
    head.className = 'tcat-head';
    var total = groups.reduce(function (n, g) { return n + g.items.length; }, 0);
    head.textContent = '工具分类 · ' + groups.length + ' 类 / ' + total + ' 个';
    wrap.appendChild(head);

    groups.forEach(function (g) {
      var lab = catLabel(g.cat);
      var open = !!openMap[g.cat];

      var sec = document.createElement('section');
      sec.className = 'tcat' + (open ? ' is-open' : '');
      sec.setAttribute('data-cat', g.cat);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tcat-btn';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML =
        '<span class="tcat-ico"><i class="fas ' + lab[1] + '"></i></span>' +
        '<span class="tcat-name">' + lab[0] + '</span>' +
        '<span class="tcat-count">' + g.items.length + '</span>' +
        '<i class="fas fa-chevron-down tcat-arrow"></i>';

      var body = document.createElement('div');
      body.className = 'tcat-body';
      var inner = document.createElement('div');
      inner.className = 'tcat-inner';
      body.appendChild(inner);

      /* 收起时用 display:none 而不是 max-height 动画：60 个工具的网格
         在低端机上做高度过渡会掉帧，且 max-height 需要一个猜的魔法值。 */
      if (!open) body.style.display = 'none';

      btn.addEventListener('click', function () {
        var isOpen = sec.classList.toggle('is-open');
        body.style.display = isOpen ? '' : 'none';
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        /* 懒构建必须放在这里：只在「构建时就已经展开」的分组上调
           fillGroup 的话，点开一个收起的分类会展开出一个空壳
           —— 高度只有分隔线那么高，看起来像没反应。 */
        if (isOpen) fillGroup(inner, g);
        var map = readOpen();
        if (isOpen) map[g.cat] = 1; else delete map[g.cat];
        writeOpen(map);
      });

      sec.appendChild(btn);
      sec.appendChild(body);
      wrap.appendChild(sec);

      /* 二级页内容懒构建：分类没展开过就不建 60 个网格项 */
      if (open) fillGroup(inner, g);
    });

    return wrap;
  }

  function fillGroup(inner, g) {
    if (inner.getAttribute('data-built')) return;
    inner.setAttribute('data-built', '1');
    g.items.forEach(function (it) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'tcat-item';
      item.setAttribute('data-tool', it.id);
      item.innerHTML =
        '<i class="fas ' + (ICONS[it.id] || 'fa-wrench') + '"></i>' +
        '<span class="tc-name"></span>' +
        '<i class="fas fa-chevron-right tc-arrow"></i>';
      item.querySelector('.tc-name').textContent = it.label;
      inner.appendChild(item);
    });
  }

  /* ---------- 二级页 = 展开的分类；三级页 = 工具本体（搬移，不克隆） ----------
     分类展开后就是该分类的工具列表，它本身就是「二级页」的形态，
     所以不再另建一个中间页 —— 展开动作已经完成了「进二级页」这一步。
     点工具项直接开三级页。 */
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

  /* ---------- 一级页把面板整体移出 ---------- */
  /* 60 个 .tool-panel 与 .info-box 直接躺在 .main-card 里。桌面端靠
     html.tool-open 折叠，手机端没有那套规则，于是「没打开工具」时它们
     照样参与文档流（只是 display:none 而已，一旦 .active 就露出来）。
     用户要求一级页只留分类外壳，所以这里把整块搬到一个隐藏容器里，
     开三级页时再 adopt 进详情层。搬移而非删除：监听器与已算结果都在。

     搬家必须可逆：视口变宽时 clearNarrowOnly 只会删掉窄屏注入的节点，
     删不到「被搬走的桌面节点」，面板就永远回不去 .main-card 了
     —— 桌面端会整个空掉。所以这里记下每块的原始父节点与后继兄弟，
     unStashPanels() 按原样放回去（顺序也一致）。 */
  var STASHED = [];

  function stashPanels(mainCard) {
    if (STASHED.length) return;            /* 已经搬过了，别重复搬 */
    var host = byId('toolsStash');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toolsStash';
      host.className = 'tools-stash';
      host.setAttribute('aria-hidden', 'true');
      document.body.appendChild(host);
    }
    ['tool-panel', 'info-box'].forEach(function (cls) {
      Array.prototype.forEach.call(mainCard.querySelectorAll('.' + cls), function (el) {
        STASHED.push({ n: el, p: el.parentNode, s: el.nextSibling });
        host.appendChild(el);
      });
    });
  }

  /* 放回原位。变宽时调用，让桌面端拿到与改动前完全一样的 DOM。 */
  function unStashPanels() {
    for (var i = 0; i < STASHED.length; i++) {
      var it = STASHED[i];
      try {
        if (it.s && it.s.parentNode === it.p) it.p.insertBefore(it.n, it.s);
        else it.p.appendChild(it.n);
      } catch (e) {}
    }
    STASHED = [];
    var host = byId('toolsStash');
    if (host && host.parentNode) host.parentNode.removeChild(host);
  }

  function init() {
    if (!narrow()) return;
    var tabs = document.querySelectorAll('.tool-tab');
    var row = q('.tools-tabs');
    var main = q('.main-card');
    if (!tabs.length || !row || !main || q('.tcat-wrap')) return;

    /* 开关挂在 html 上：脚本没跑到就整块不生效，页面退回原来的标签墙 */
    document.documentElement.classList.add('tool-cats');

    var groups = collect();
    if (!groups.length) return;

    /* 面板移出：一级页只留分类入口。必须在 collect() 之后做 —— collect
       要靠 .tool-tab 找面板，而 .tool-tab 不在 .main-card 之外。 */
    stashPanels(main);

    row.parentNode.insertBefore(buildAccordion(groups, readOpen()), row);

    /* 事件委托：分类按钮 / 二级页里的工具项，一个监听器全管。
       分类按钮的展开收起是各自绑的（要拿闭包里的 groups 与 sec），
       这里只处理「点工具进三级页」。 */
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.detail-view')) return;   /* 详情层里的点击不重复开卡 */

      var item = t.closest('.tcat-item');
      if (!item) return;
      var nm = q('.tc-name', item);
      openTool(item.getAttribute('data-tool'), nm ? nm.textContent : '工具');
    });
  }

  /* ---------- #tool/xxx 直达（手机端） ---------- */
  /* tools-hub.js 只在宽屏干活，桌面那套 hash 路由在手机上完全没跑，
     于是手机点开 #tool/xxx 的链接会停在分类页 —— 看起来像链接失效。
     这里补一条窄屏专用的：直接开三级页。
     只处理「刚进页面」和 hashchange 两种，不抢 detailOpen 的栈。 */
  var HASH = '#tool/';
  function openFromHash() {
    if (!narrow()) return;
    var h = String(location.hash || '');
    if (h.indexOf(HASH) !== 0) return;
    var id = h.slice(HASH.length);
    if (!id || id.length > 40 || id.indexOf('"') >= 0 || id.indexOf(']') >= 0) return;
    if (!document.querySelector('.tool-tab[data-tool="' + id + '"]')) return;
    if (window.AppShell && window.AppShell.detailOpen && window.AppShell.detailOpen()) return;
    var tab = document.querySelector('.tool-tab[data-tool="' + id + '"]');
    var nm = tab ? (tab.textContent || '').trim() : id;
    /* 标题优先用分类表里的中文名，取不到就退回 tab 上的文字 */
    var meta = catalog()[id];
    var label = (meta && meta[1]) || nm;
    /* 顶栏标题要在详情层压栈之后再写一次：openDetail 里 setBarDetail
       会把 baseTitle 记成「栈空时的标题」，而本次导航带着 hash 时
       顶栏可能刚被重建，早写会被随后的 setBarDetail 覆盖掉。 */
    openTool(id, label);
    setTimeout(function () {
      if (window.AppShell && window.AppShell.detailDepth &&
          window.AppShell.detailDepth() > 0) {
        window.AppShell.setBarDetail(true, label);
      }
    }, 60);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('hashchange', function () { openFromHash(); });
  /* init() 之后才有 .tool-tab 可用，所以直达放在这一拍 */
  setTimeout(openFromHash, 0);

  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) {
      if (isNarrow) init();
      /* 变宽：把搬走的面板原样放回 .main-card，否则桌面端会整页空掉。
         必须在 clearNarrowOnly 之后跑（onMode 回调按注册顺序触发，
         app-shell 内部先清再广播），此时 .tcat-* 已被删掉。 */
      else unStashPanels();
    });
  }
})();
