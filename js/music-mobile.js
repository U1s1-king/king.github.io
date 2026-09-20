/* ============================================================
 * 音乐页移动端布局层  js/music-mobile.js
 * ------------------------------------------------------------
 * 只被 music.html 引用，且只在移动端（≤768px）动手。桌面端一行 DOM 都不碰。
 *
 * 阶段二 T2.1/T2.2 的三件事：
 *   1. 把「我的歌单」搬上首屏
 *      抽屉里的 #plViews（官方推荐 / 我的歌单 / 收藏）与 .playlist-scroll 是
 *      **真实节点**。搬进 #mmListHost 之后，music-bundle.js 的播放引擎、
 *      setView() 过滤、.track-item 点击播歌全部照旧 —— 因为事件是绑在节点上的，
 *      换父节点不会丢。宽屏时再原样搬回抽屉，位置用搬走前记下的 parent/nextSibling。
 *   2. 「官方推荐」横向卡片行
 *      数据不重新请求，直接读 #playlistContainer 已经渲染好的 .track-item，
 *      点击时转交给对应的真实节点（item.click()）—— 不复制播放逻辑。
 *   3. 页内迷你播放条
 *      状态从 #nativeAudio / #trackName / #trackArtist / #coverImg 读，
 *      与 shell（index.html）里那条 #app-mini-player 是同一套思路。
 *
 * 不做的事：
 *   · 不改 music-bundle.js（573KB 打包产物）
 *   · 不新增任何 !important
 *   · 桌面端不隐藏/搬动任何东西
 * ============================================================ */
(function () {
  'use strict';

  var MQ = window.matchMedia('(max-width: 768px)');
  function byId(id) { return document.getElementById(id); }
  function q(sel, root) { return (root || document).querySelector(sel); }

  var home = byId('mmHome');
  var listHost = byId('mmListHost');
  var row = byId('mmRecommendRow');
  var mini = byId('mmMini');
  if (!home || !listHost || !mini) return;   /* 只在 music.html 上存在 */

  /* ============================================================
     1. 我的歌单：搬进 / 搬回
     ============================================================ */
  var moved = null;   /* { views:{node,parent,next}, scroll:{node,parent,next} } */

  function remember(node) {
    return { node: node, parent: node.parentNode, next: node.nextSibling };
  }
  function restore(rec) {
    if (!rec || !rec.parent) return;
    if (rec.next && rec.next.parentNode === rec.parent) rec.parent.insertBefore(rec.node, rec.next);
    else rec.parent.appendChild(rec.node);
  }

  function moveIntoHome() {
    if (moved) return;
    var views = byId('plViews');
    var scroll = q('.playlist-scroll');
    if (!views || !scroll) return;
    moved = { views: remember(views), scroll: remember(scroll) };
    listHost.appendChild(views);
    listHost.appendChild(scroll);
    home.classList.add('mm-moved');
  }
  function moveBackToDrawer() {
    if (!moved) return;
    restore(moved.views);
    restore(moved.scroll);
    moved = null;
    home.classList.remove('mm-moved');
  }

  function syncLayout() {
    if (MQ.matches) moveIntoHome();
    else moveBackToDrawer();
  }
  if (MQ.addEventListener) MQ.addEventListener('change', syncLayout);
  else if (MQ.addListener) MQ.addListener(syncLayout);

  /* ============================================================
     2. 官方推荐横向卡片行
     ------------------------------------------------------------
     数据源是 #playlistContainer 里已经渲染好的 .track-item。
     只在「官方推荐」这个视图下重建（切到收藏/我的歌单时保留上一组）。
     ============================================================ */
  var THEMES = [
    ['#ffd9e6', '#ffb0ca'], ['#dbe9ff', '#b6d2ff'], ['#e8dcff', '#c9b6ff'],
    ['#d9f5e8', '#a9e8cd'], ['#fff0d6', '#ffd79b'], ['#ffe2e2', '#ffbcbc']
  ];
  function themeFor(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 9973;
    return THEMES[h % THEMES.length];
  }

  function buildRecommendRow() {
    if (!row) return;
    var box = byId('playlistContainer');
    if (!box) return;
    var view = 'official';
    try { view = localStorage.getItem('sakuraPlView') || 'official'; } catch (e) {}
    if (view !== 'official') return;          /* 非官方推荐视图时不重建 */
    var items = box.querySelectorAll('.track-item');
    if (!items.length) return;
    /* 已经建过同一批就跳过，避免 MutationObserver 自激 */
    if (row.dataset.built === String(items.length) && row.children.length) return;

    var frag = document.createDocumentFragment();
    for (var i = 0; i < items.length && i < 12; i++) {
      (function (item) {
        var info = q('.track-info', item);
        var name = info ? (info.textContent || '').replace(/^\s+/, '').trim() : '';
        if (!name) return;
        var th = themeFor(name);
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mm-card';
        var art = document.createElement('span');
        art.className = 'mm-card-art';
        art.style.background = 'linear-gradient(140deg,' + th[0] + ',' + th[1] + ')';
        var ic = document.createElement('i');
        ic.className = 'fas fa-music';
        art.appendChild(ic);
        var nm = document.createElement('span');
        nm.className = 'mm-card-name';
        nm.textContent = name;
        b.appendChild(art);
        b.appendChild(nm);
        b.addEventListener('click', function () { item.click(); });
        frag.appendChild(b);
      })(items[i]);
    }
    row.innerHTML = '';
    row.appendChild(frag);
    row.dataset.built = String(items.length);
  }

  var plBox = byId('playlistContainer');
  if (plBox && window.MutationObserver) {
    new MutationObserver(function () { buildRecommendRow(); })
      .observe(plBox, { childList: true });
  }

  /* 「全部」→ 切回官方推荐视图并把列表滚进视野 */
  var more = byId('mmRecommendMore');
  if (more) more.addEventListener('click', function () {
    var btn = document.querySelector('#plViews .pl-view[data-view="official"]');
    if (btn) btn.click();
    var host = byId('mmMineSection');
    if (host) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* 「上传」→ 复用抽屉里的上传入口（它绑着打开上传弹窗的逻辑） */
  var up = byId('mmUploadBtn');
  if (up) up.addEventListener('click', function () {
    var t = byId('uploadTrigger');
    if (t) t.click();
  });

  /* ============================================================
     3. 页内迷你播放条
     ============================================================ */
  var audio = byId('nativeAudio');
  function fmt(t) {
    if (!isFinite(t) || t <= 0) return '';
    var m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function syncMini() {
    if (!audio) return;
    var started = !!(audio.currentSrc || audio.getAttribute('src'));
    var open = document.body.classList.contains('detail-open');
    var show = started && !open && MQ.matches;
    mini.hidden = !show;
    mini.classList.toggle('show', show);
    if (!show) return;

    var nameEl = byId('trackName'), artistEl = byId('trackArtist'), coverEl = byId('coverImg');
    var t = byId('mmMiniTitle'), a = byId('mmMiniArtist'), c = byId('mmMiniCover');
    var txt = nameEl ? (nameEl.textContent || '').trim() : '';
    if (t) t.textContent = txt || '未在播放';
    if (a) a.textContent = artistEl ? (artistEl.textContent || '').trim() : '';
    if (c && coverEl && coverEl.src) c.src = coverEl.src;
    var pb = byId('mmMiniPlay');
    if (pb) pb.innerHTML = '<i class="fas ' + (audio.paused ? 'fa-play' : 'fa-pause') + '"></i>';
    var bar = byId('mmMiniProgress');
    if (bar) {
      var d = audio.duration;
      bar.style.width = (isFinite(d) && d > 0 ? (audio.currentTime / d) * 100 : 0) + '%';
      mini.title = fmt(audio.currentTime) + (isFinite(d) && d > 0 ? ' / ' + fmt(d) : '');
    }
  }

  /* 点条身 → 全屏播放页。全屏页是 music-app.js 绑在 #coverInner 上的那条路径，
     这里不重写 openFull()，只触发同一个入口，避免两套逻辑漂移。 */
  mini.addEventListener('click', function () {
    var disc = byId('coverInner');
    if (disc) disc.click();
  });
  var mp = byId('mmMiniPlay');
  if (mp) mp.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = byId('playPauseBtn'); if (b) b.click();
    setTimeout(syncMini, 120);
  });
  var mn = byId('mmMiniNext');
  if (mn) mn.addEventListener('click', function (e) {
    e.stopPropagation();
    var b = byId('nextBtn'); if (b) b.click();
    setTimeout(syncMini, 120);
  });

  if (audio) {
    ['play', 'pause', 'ended', 'loadedmetadata', 'timeupdate', 'durationchange'].forEach(function (ev) {
      audio.addEventListener(ev, syncMini);
    });
  }

  /* ============================================================
     4. 「最近播放」上移（阶段二收尾）
     ------------------------------------------------------------
     music-plus.js 把 #mpRecentStrip 插在 .player-card **之后**。
     移动端 .player-card 已经隐藏（退出首屏），于是那条横向行会落到
     「我的歌单」列表下面 —— 那是页面最底部，等于没有。
     这里在移动端把它搬到「官方推荐」之前，形成
       [最近播放] [官方推荐] [我的歌单]
     与 Spotify 首页的区块顺序一致。桌面端保持 music-plus.js 的原位。
     ============================================================ */
  function liftRecentStrip() {
    if (!MQ.matches || !home) return;
    var strip = byId('mpRecentStrip');
    if (!strip || strip.parentNode === home) return;
    var anchor = byId('mmRecommendSection');
    if (anchor && anchor.parentNode === home) home.insertBefore(strip, anchor);
    else home.insertBefore(strip, home.firstChild);
  }

  /* ============================================================
     5. 全屏播放页里的「歌单」chip 改成「收起播放页 · 回到歌单」
     ------------------------------------------------------------
     阶段二把歌单搬上首屏后，移动端的抽屉已经空掉，整块 display:none。
     而 music-app.js 的 .fs-list 与这条 chip 都还是去点 #plDrawerOpen
     （那个内联脚本会打开抽屉）—— 不拦的话用户点了一颗没有任何反应的按钮。
     这里在捕获阶段截住：收起二级页，然后滚到「我的歌单」区块。
     ============================================================ */
  document.addEventListener('click', function (e) {
    if (!MQ.matches) return;
    var t = e.target && e.target.closest ? e.target.closest('#plDrawerOpen') : null;
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    if (window.AppShell && window.AppShell.closeDetail) window.AppShell.closeDetail();
    setTimeout(function () {
      var host = byId('mmMineSection');
      if (host) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 280);
  }, true);

  /* ============================================================
     6. 歌词空状态
     ------------------------------------------------------------
     没有歌词时 LyricHelper 只往 #lyricBox 里写一句话，而 .fs-lyrics 是
     flex:1 —— 结果是 300 多像素的大色块中央飘着一行字。
     这里给 .fs-wrap 挂一个 mm-no-lyric：没有 .lyr-line 子节点就算空。
     空的时候把歌词区收成一条提示，省下的高度全部让给封面。
     ============================================================ */
  function syncLyricState() {
    var wrap = document.querySelector('.fs-wrap');
    if (!wrap) return;
    var box = byId('lyricBox');
    var empty = !box || !box.querySelector('.lyr-line');
    wrap.classList.toggle('mm-no-lyric', empty);
  }

  /* ============================================================
     7. 启动
     ============================================================ */
  function boot() {
    syncLayout();
    buildRecommendRow();
    syncMini();
    liftRecentStrip();
    syncLyricState();
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 300);
  else window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 300); });

  /* 播放状态、视图、最近播放行都可能被别处改动，低频兜底同步 */
  setInterval(function () {
    syncMini();
    buildRecommendRow();
    liftRecentStrip();
    syncLyricState();
  }, 1000);

  /* 全屏播放页开关时，迷你条要跟着让位 */
  if (window.MutationObserver) {
    new MutationObserver(syncMini).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
})();
