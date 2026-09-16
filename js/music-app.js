/* ============================================================
 * 音乐页 App 化 (music-app.js) —— 只在手机端接管
 * ------------------------------------------------------------
 * 全屏播放页为什么不复制一份 DOM：
 *   music-bundle.js 第 162 行 const lyricBox = document.getElementById('lyricBox')
 *   把歌词容器用闭包抓住了，LyricHelper.show(lrc, audio, box) 也绑定到那一个节点。
 *   想在别处再渲染一套歌词 = 必须改那个 548KB 的 bundle。
 *   所以这里改成「把真实节点搬进全屏页、关闭时原样搬回」：
 *     歌词高亮 / 自动滚动、进度条、转盘旋转(.cover-inner.playing)、
 *     播放状态 —— 全部零同步成本，bundle 一行不改。
 *
 * 桌面端：narrow() 为假，直接 return，页面一个字节都不动。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }
  function byId(id) { return document.getElementById(id); }
  function q(sel, root) { return (root || document).querySelector(sel); }

  /* 被搬走的节点 + 它们的原位，关闭时按记录逆序搬回 */
  var moved = [];

  function take(node, into) {
    if (!node || !into || !node.parentNode) return;
    moved.push({ n: node, p: node.parentNode, s: node.nextSibling });
    into.appendChild(node);
  }
  function putBack() {
    for (var i = moved.length - 1; i >= 0; i--) {
      var it = moved[i];
      if (!it.p) continue;
      try {
        if (it.s && it.s.parentNode === it.p) it.p.insertBefore(it.n, it.s);
        else it.p.appendChild(it.n);
      } catch (e) {}
    }
    moved = [];
  }

  function buildStage() {
    var wrap = document.createElement('div');
    wrap.className = 'fs-wrap';
    wrap.innerHTML =
      '<div class="fs-top">' +
        '<button class="fs-icon fs-collapse" type="button" aria-label="收起播放页"><i class="fas fa-chevron-down"></i></button>' +
        '<span class="fs-hint">点封面切歌词 · 下滑收起</span>' +
        '<button class="fs-icon fs-more" type="button" aria-label="更多"><i class="fas fa-ellipsis-h"></i></button>' +
        '<button class="fs-icon fs-list" type="button" aria-label="打开歌单"><i class="fas fa-list-ul"></i></button>' +
      '</div>' +
      '<div class="fs-cover"></div>' +
      '<div class="fs-meta"></div>' +
      '<div class="fs-lyrics"></div>' +
      '<div class="fs-progress"></div>' +
      '<div class="fs-controls"></div>' +
      '<div class="fs-modes"></div>';
    return wrap;
  }

  var opening = false;
  function openFull() {
    if (!narrow()) return false;
    if (!window.AppShell || !window.AppShell.openDetail) return false;
    if (window.AppShell.detailOpen()) return false;
    if (opening) return false;
    opening = true;

    var wrap = buildStage();
    var handle = window.AppShell.openDetail({
      title: '正在播放',
      content: wrap,
      swipeClose: true,
      /* 左右滑 = 上一首/下一首（走原按钮，复用 bundle 的切歌逻辑） */
      onHorizontal: function (dir) {
        var b = byId(dir > 0 ? 'nextBtn' : 'prevBtn');
        if (b) b.click();
      },
      onClose: function () { putBack(); opening = false; }
    });

    /* 按主流播放页的顺序把真实节点搬进去 */
    take(byId('coverInner'), q('.fs-cover', wrap));
    take(byId('trackName'), q('.fs-meta', wrap));
    take(byId('trackArtist'), q('.fs-meta', wrap));
    take(byId('lyricBox'), q('.fs-lyrics', wrap));
    take(q('.progress-area'), q('.fs-progress', wrap));
    take(q('.controls-row'), q('.fs-controls', wrap));
    take(q('.extra-actions .mode-strip'), q('.fs-modes', wrap));

    var collapse = q('.fs-collapse', wrap);
    if (collapse) collapse.addEventListener('click', function () { handle.close(); });
    var list = q('.fs-list', wrap);
    if (list) list.addEventListener('click', function () {
      var t = byId('plDrawerOpen');
      if (t) t.click();
    });
    var more = q('.fs-more', wrap);
    if (more) more.addEventListener('click', function () {
      if (window.MusicPlus && window.MusicPlus.menu) window.MusicPlus.menu();
    });
    opening = false;
    return true;
  }

  /* ---- 入口一：点封面转盘 / 右下角展开按钮 ---- */
  function injectOpeners() {
    /* 先绑封面：下面那道守卫只跟右下角按钮有关，不该连累封面点击 */
    var disc = byId('coverInner');
    if (disc && !disc.__fsOpen) {
      disc.__fsOpen = true;
      disc.addEventListener('click', function () { openFull(); });
    }
    var zone = q('.disc-zone');
    if (!zone || byId('fsOpenBtn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'fsOpenBtn';
    btn.className = 'fs-open-btn';
    btn.setAttribute('aria-label', '全屏播放页');
    btn.innerHTML = '<i class="fas fa-up-right-and-down-left-from-center"></i>';
    btn.addEventListener('click', function (e) { e.stopPropagation(); openFull(); });
    zone.appendChild(btn);
  }

  /* ---- 歌单 sheet：拖动把手下滑关闭 ---- */
  function bindSheetDrag() {
    var head = q('.pl-drawer-head');
    var drawer = byId('plDrawer');
    if (!head || !drawer) return;
    var y0 = 0, dy = 0, on = false;
    head.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      on = true; dy = 0; y0 = e.touches[0].clientY;
      drawer.style.transition = 'none';
    }, { passive: true });
    head.addEventListener('touchmove', function (e) {
      if (!on) return;
      dy = e.touches[0].clientY - y0;
      if (dy > 0) drawer.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    head.addEventListener('touchend', function () {
      if (!on) return;
      on = false;
      drawer.style.transition = '';
      drawer.style.transform = '';
      if (dy > 90) { var c = byId('plDrawerClose'); if (c) c.click(); }
    });
  }


  /* ============================================================
     平台分段 + 搜索二级页
     ------------------------------------------------------------
     #ns-platform 那个原生 <select> 是 bundle 读取「平台来源」的入口。
     直接把它换成按钮排，搜索链路就找不到平台了 —— 所以保留 select
     （手机端 CSS 隐藏），旁边插一排 chips 去改它的 value 并派发 change。
     搜索链路一行不改。
     ============================================================ */
  var PLATFORM_LABELS = {
    all: '全部平台', netease: '网易云', tencent: 'QQ音乐',
    kugou: '酷狗', kuwo: '酷我', migu: '咪咕', bilibili: 'B站', itunes: 'iTunes'
  };

  function buildPlatformChips() {
    var sel = byId('ns-platform');
    if (!sel || byId('nsPlatformChips')) return;
    var row = document.createElement('div');
    row.id = 'nsPlatformChips';
    row.className = 'ns-chips';
    function sync() {
      Array.prototype.forEach.call(row.children, function (c) {
        c.classList.toggle('active', c.getAttribute('data-value') === sel.value);
      });
    }
    Array.prototype.forEach.call(sel.options, function (op) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ns-chip';
      b.setAttribute('data-value', op.value);
      b.textContent = PLATFORM_LABELS[op.value] || op.textContent;
      b.addEventListener('click', function () {
        sel.value = op.value;
        try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        sync();
      });
      row.appendChild(b);
    });
    sel.addEventListener('change', sync);
    sel.parentNode.appendChild(row);   /* 用 order:-1 让它排在输入框上面一行 */
    sync();
  }

  /* ---- 搜索历史 ---- */
  var HIST_KEY = 'dsh-search-history';
  function histList() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function histPush(kw) {
    kw = String(kw || '').trim();
    if (!kw) return;
    var list = histList().filter(function (x) { return x !== kw; });
    list.unshift(kw);
    try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {}
  }

  /* ---- 搜索二级页：搜索条与结果容器都是搬真实节点 ----
     结果容器被 bundle 直接写 innerHTML，复制一份就等于搜了没结果。 */
  function openSearch(kind) {
    if (!narrow()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    if (window.AppShell.detailOpen()) return;
    var bar = q(kind === 'ns' ? '.ns-searchbar' : '.po-searchbar');
    var results = byId(kind === 'ns' ? 'ns-results' : 'po-results');
    var input = byId(kind === 'ns' ? 'ns-search' : 'po-search');
    var btn = byId(kind === 'ns' ? 'ns-btn' : 'po-btn');
    if (!bar || !results || !input) return;

    var wrap = document.createElement('div');
    wrap.className = 'ss-wrap';
    var body = document.createElement('div');
    body.className = 'ss-body';
    var hist = document.createElement('div');
    hist.className = 'ss-hist';
    wrap.appendChild(body);

    var alive = true;
    var handle = window.AppShell.openDetail({
      title: '搜索',
      content: wrap,
      onClose: function () { alive = false; putBack(); }
    });

    take(bar, body);
    take(results, body);
    body.insertBefore(hist, results);   /* 顺序：搜索条 → 历史 → 结果 */

    /* 热词：没有历史时也不至于是一片空白 */
    var HOT_WORDS = ['周杰伦', '林俊杰', '纯音乐', '日语', '钢琴', '古风', 'Lo-Fi', 'ACG'];
    function mkChip(text, onClick) {
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'ss-hist-chip';
      c.textContent = text;
      c.addEventListener('click', function () { input.value = text; if (btn) btn.click(); });
      return c;
    }
    function histTitle(text, withClear) {
      var t = document.createElement('div');
      t.className = 'ss-hist-title';
      t.textContent = text;
      if (withClear) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ss-hist-clear';
        b.textContent = '清空';
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          try { localStorage.removeItem(HIST_KEY); } catch (err) {}
          renderHist();
        });
        t.appendChild(b);
      }
      return t;
    }
    function renderHist() {
      var list = histList();
      hist.innerHTML = '';
      if (list.length) {
        hist.appendChild(histTitle('最近搜索', true));
        var row = document.createElement('div');
        row.className = 'ss-hist-row';
        list.forEach(function (kw) { row.appendChild(mkChip(kw, null)); });
        hist.appendChild(row);
      }
      hist.appendChild(histTitle('热门搜索', false));
      var hot = document.createElement('div');
      hot.className = 'ss-hist-row';
      HOT_WORDS.forEach(function (kw) { hot.appendChild(mkChip(kw, null)); });
      hist.appendChild(hot);
    }
    renderHist();

    function runSearch() {
      if (!alive) return;
      histPush(input.value);
      hist.style.display = 'none';
    }
    if (btn) btn.addEventListener('click', runSearch);
    input.addEventListener('keydown', function (e) {
      if (!alive) return;
      if (e.key === 'Enter') { e.preventDefault(); if (btn) btn.click(); }
    });
    input.addEventListener('input', function () {
      if (!alive) return;
      hist.style.display = input.value ? 'none' : '';
    });

    /* 收起键盘前的自动聚焦：键盘弹出会让底部 tab 让路，框架已经处理 */
    setTimeout(function () { if (alive) { try { input.focus(); } catch (e) {} } }, 280);
    return handle;
  }

  /* ---- 对外入口：让 music-plus.js 的历史/收藏能「按歌名再搜一次」 ---- */
  window.MusicAppSearch = function (kind, kw) {
    if (!narrow()) return;
    var el = byId(kind === 'ns' ? 'ns-search' : 'po-search');
    var btn = byId(kind === 'ns' ? 'ns-btn' : 'po-btn');
    if (!el || !btn) return;
    el.value = kw || '';
    function open() {
      if (!window.AppShell || !window.AppShell.detailOpen()) openSearch(kind);
      setTimeout(function () { try { el.focus(); } catch (e) {} btn.click(); }, 320);
    }
    /* 调用方通常是「播放历史/我的收藏」列表页——它本身就是二级页，
       直接开搜索页会被挡住，用户只看到「点了没反应」。先收起再开。 */
    if (window.AppShell && window.AppShell.detailOpen()) {
      window.AppShell.closeDetail();
      setTimeout(open, 320);
    } else open();
  };

  /* ---- 点搜索框 → 开搜索二级页（手机端不再用页面内联搜索） ---- */
  function bindSearchOpeners() {
    [['ns-search', 'ns'], ['po-search', 'po']].forEach(function (pair) {
      var el = byId(pair[0]);
      if (!el || el.__fsBound) return;
      el.__fsBound = true;
      el.addEventListener('click', function (e) {
        if (window.AppShell && window.AppShell.detailOpen()) return;
        e.preventDefault();
        try { el.blur(); } catch (err) {}
        openSearch(pair[1]);
      });
    });
  }

  function init() {
    if (!narrow()) return;
    injectOpeners();
    bindSheetDrag();
    buildPlatformChips();
    bindSearchOpeners();
  }

  /* 视口切到网页端：把「只在手机端存在」的节点拆干净 ——
     #fsOpenBtn（唱片上的全屏入口）、#nsPlatformChips（平台胶囊），
     以及可能开着的全屏播放页。它们的样式都在 max-width:768px 里，
     不拆就会以没样式的裸控件形式留在网页端。 */
  function teardown() {
    ['fsOpenBtn', 'nsPlatformChips'].forEach(function (id) {
      var el = byId(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    if (window.AppShell && window.AppShell.detailOpen && window.AppShell.detailOpen()) {
      window.AppShell.closeDetail();
    }
  }

  function applyMode(isNarrow) {
    if (isNarrow === undefined) isNarrow = narrow();
    if (isNarrow) init();
    else teardown();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyMode);
  else applyMode();
  if (window.AppShell && window.AppShell.onMode) window.AppShell.onMode(applyMode);
})();
