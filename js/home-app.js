/* ============================================================
 * 首页移动端重构 (home-app.js) —— 仅窄屏（<=768px）
 * ------------------------------------------------------------
 * 目标：移动端【页面级不可滑动】，溢出的内容改用「伪二级页」承载。
 *
 * 为什么是「伪」二级页：站点是 GitHub Pages 静态多页，且首页被装在外壳
 * （index.html）的 iframe 里。真建一套路由等于把内容拆两遍、还要和外壳的
 * 历史记录打架。这里直接复用 js/app-shell.js 已有的 openDetail()：
 *   · 全屏覆盖 + 从右滑入      .detail-view / .in
 *   · 顶栏切成「← + 标题」      setBarDetail()
 *   · 硬件返回键先关层          pushState({apDetail:1}) + popstate
 *   · 下滑 >110px 关闭          bindGestures({close:true})
 *   · 详情层打开时锁 body 滚动   body.detail-open{overflow:hidden}
 * 这套机制已被 journal / archives / music / tools / tv / guestbook 六个页面
 * 验证过，首页是最后一个还没用的。这里只做「装配」，不新增动画或手势。
 *
 * 桌面端（>=769px）一行 DOM 都不碰：
 *   · 本脚本所有分支都以 narrow() 开头
 *   · openDetail 自己还有一道 !isNarrow() 闸门
 *   · 样式全部写在 css/home-app.css 的 @media (max-width:768px) 里
 * 三重保险，保证桌面端像素不变。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }
  function shell() { return window.AppShell; }

  /* 二级页内容在窄屏才装配；宽屏时这些节点必须拆掉，否则会留下
     「没有样式定义的残骸」——各页样式都写在 @media(max-width:768px) 里，
     宽屏下它们就是裸露的无样式 DOM。app-shell.js 的 onMode 就是为这个存在的。 */
  var NARROW_ONLY_SEL = '.ha-grid, .ha-grid-title, .ha-preview';

  /* 记录被我们隐藏掉的原生区块，宽屏时要还原 */
  var hidden = [];

  function hideForGrid() {
    /* P1 只做骨架：先把「将来要搬进二级页」的区块在窄屏隐藏，
       证明结构与滚动锁成立。P2 再把它们真正搬进二级页。 */
    var sels = [
      '.info-grid',        /* -> 我的数据 */
      '.st-d01d8085',      /* -> 纪念册 */
      '.social-links',     /* -> 社交媒体 */
      '.st-c2f5961e'       /* -> 联络与寄语 */
    ];
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (el.dataset.haHidden === '1') continue;
        el.dataset.haHidden = '1';
        el.dataset.haPrevDisplay = el.style.display || '';
        el.style.display = 'none';
        hidden.push(el);
      }
    }
  }
  function unhideAll() {
    for (var i = 0; i < hidden.length; i++) {
      var el = hidden[i];
      el.style.display = el.dataset.haPrevDisplay || '';
      delete el.dataset.haHidden;
      delete el.dataset.haPrevDisplay;
    }
    hidden = [];
  }

  /* ---------- 4 个宫格入口 ---------- */
  var ENTRIES = [
    { key: 'data',    icon: 'fa-chart-simple',      title: '我的数据',   sub: '所在地 · 职业 · 在听 · 天气' },
    { key: 'album',   icon: 'fa-images',            title: '纪念册',     sub: '三张想留住的瞬间' },
    { key: 'social',  icon: 'fa-share-nodes',       title: '社交媒体',   sub: 'B站 · YouTube · X · GitHub' },
    { key: 'contact', icon: 'fa-envelope-open-text',title: '联络与寄语', sub: '想跟本喵说点什么' }
  ];

  function buildGrid() {
    if (document.querySelector('.ha-grid')) return;
    var grid = document.createElement('div');
    grid.className = 'ha-grid';
    grid.setAttribute('role', 'navigation');
    grid.setAttribute('aria-label', '首页快捷入口');

    for (var i = 0; i < ENTRIES.length; i++) {
      var e = ENTRIES[i];
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'ha-card';
      a.setAttribute('data-ha', e.key);
      a.innerHTML =
        '<i class="fas ' + e.icon + ' ha-card-icon"></i>' +
        '<span class="ha-card-title"></span>' +
        '<span class="ha-card-sub"></span>';
      a.querySelector('.ha-card-title').textContent = e.title;
      a.querySelector('.ha-card-sub').textContent = e.sub;
      grid.appendChild(a);
    }
    grid.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.ha-card') : null;
      if (!btn) return;
      ev.preventDefault();
      openEntry(btn.getAttribute('data-ha'));
    });

    /* 放在 bio 之后、纪念册之前 */
    var anchor = document.querySelector('.bio-text');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(grid, anchor.nextSibling);
    } else {
      var main = document.querySelector('.about-container') || document.body;
      main.appendChild(grid);
    }
  }

  /* ---------- 二级页内容 ----------
     P2：真正把首屏溢出的内容搬进来。
     一言（诗词）在窄屏被 CSS 隐藏，这里【克隆】一份进二级页 ——
     用 cloneNode 而不是 adopt：原节点仍在首屏 DOM 里（只是 display:none），
     宽屏要还原，搬走了就回不去。 */
  function detailShell(title) {
    var box = document.createElement('div');
    box.className = 'ha-detail';
    var h = document.createElement('div');
    h.className = 'ha-detail-title';
    h.textContent = title;
    box.appendChild(h);
    return box;
  }

  /* 克隆一份节点用于二级页。
     必须先清掉「为首屏隐藏而加的内联 display:none」——
     hideForGrid() 给这些区块设了内联样式，cloneNode 会把内联样式一起复制，
     结果二级页里拿到的是个看不见的壳（实测「纪念册」整页空白）。
     注意是克隆而不是搬移：原节点还要留给宽屏还原，不能动。 */
  /* 还要清掉 reveal 动画类：
     .reveal-init 是 opacity:0!important（style.css:258），靠 common.js 的
     IntersectionObserver 加上 .reveal-in 才显形。但二级页是 fixed 覆盖层，
     观察器不会为它触发 —— 结果 DOM 有内容、高度也对，就是【全透明看不见】
     （「纪念册」空白就是这么来的）。直接跳过入场动画，进二级页即最终态。 */
  function stripReveal(root) {
    var nodes = root.classList && root.classList.contains('reveal-init')
      ? [root].concat(Array.prototype.slice.call(root.querySelectorAll('.reveal-init')))
      : Array.prototype.slice.call(root.querySelectorAll('.reveal-init'));
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('reveal-init');
      nodes[i].classList.add('reveal-in');   /* 直接给终态，不要入场动画 */
    }
    return root;
  }

  function cloneForDetail(sel) {
    var src = document.querySelector(sel);
    if (!src) return null;
    var c = src.cloneNode(true);
    c.style.display = '';
    stripReveal(c);
    delete c.dataset.haHidden;
    delete c.dataset.haPrevDisplay;
    /* 后代里也可能带着隐藏标记（info-item 等），一并清掉 */
    var marked = c.querySelectorAll('[data-ha-hidden]');
    for (var i = 0; i < marked.length; i++) {
      marked[i].style.display = '';
      delete marked[i].dataset.haHidden;
      delete marked[i].dataset.haPrevDisplay;
    }
    var imgs = c.querySelectorAll('img');
    for (var k = 0; k < imgs.length; k++) {
      imgs[k].loading = 'eager';       /* 二级页里要立刻显示，别等懒加载 */
      imgs[k].removeAttribute('loading');
    }
    return c;
  }

  function sectionCard(label) {
    var s = document.createElement('div');
    s.className = 'ha-section';
    if (label) {
      var l = document.createElement('div');
      l.className = 'ha-section-label';
      l.textContent = label;
      s.appendChild(l);
    }
    return s;
  }

  /* 我的数据：7 个 info-item + 被隐藏的一言 */
  function buildData() {
    var box = detailShell('我的数据');
    var grid = document.querySelector('.info-grid');
    if (grid) {
      var sec = sectionCard('关于本喵');
      var wrap = document.createElement('div');
      wrap.className = 'ha-info-list';
      var items = grid.querySelectorAll('.info-item');
      for (var i = 0; i < items.length; i++) {
        wrap.appendChild(items[i].cloneNode(true));
      }
      sec.appendChild(wrap);
      box.appendChild(sec);
    }
    var hk = document.querySelector('.hitokoto-box');
    if (hk) {
      var s2 = sectionCard('今日一言');
      s2.appendChild(hk.cloneNode(true));
      box.appendChild(s2);
    }
    return box;
  }

  function buildAlbum() {
    var box = detailShell('纪念册');
    var album = cloneForDetail('.st-d01d8085');
    if (album) box.appendChild(album);
    return box;
  }

  function buildSocial() {
    var box = detailShell('社交媒体');
    var soc = cloneForDetail('.social-links');
    if (soc) box.appendChild(soc);
    return box;
  }

  function buildContact() {
    var box = detailShell('联络与寄语');
    var c = cloneForDetail('.st-c2f5961e');
    if (c) box.appendChild(c);
    return box;
  }

  function buildContent(key) {
    if (key === 'data') return buildData();
    if (key === 'album') return buildAlbum();
    if (key === 'social') return buildSocial();
    if (key === 'contact') return buildContact();
    return detailShell('详情');
  }

  function openEntry(key) {
    var api = shell();
    if (!api || !api.openDetail) return;
    if (!narrow()) return;
    if (api.detailOpen && api.detailOpen()) return;

    var meta = null;
    for (var i = 0; i < ENTRIES.length; i++) if (ENTRIES[i].key === key) meta = ENTRIES[i];
    if (!meta) return;

    api.openDetail({
      title: meta.title,
      content: buildContent(key),
      swipeClose: true
    });
  }

  /* ---------- 滚动锁 ---------- */
  /* 只锁窄屏：让 documentElement.scrollHeight == clientHeight。
     P1 阶段内容还没搬走，所以先靠 hideForGrid 把大块藏起来；
     P3 会再配合 CSS 把首屏收紧到一屏内。 */
  function lockScroll() {
    var r = document.documentElement;
    r.classList.add('ha-narrow');
  }
  function unlockScroll() {
    var r = document.documentElement;
    r.classList.remove('ha-narrow');
  }

  /* ---------- 装配 / 拆装 ---------- */
  function mount() {
    lockScroll();
    buildGrid();
    hideForGrid();
  }
  function unmount() {
    unlockScroll();
    unhideAll();
    var nodes = document.querySelectorAll(NARROW_ONLY_SEL);
    for (var i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
  }

  function apply() {
    if (narrow()) mount();
    else unmount();
  }

  function init() {
    apply();
    var api = shell();
    /* 跨越 768px 时拆装：不订阅的话，宽屏会留下窄屏注入的无样式节点 */
    if (api && api.onMode) api.onMode(function (n) { if (n) mount(); else unmount(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();