/* ============================================================
 * 动画库增强层（js/anim-lib.js）
 * ------------------------------------------------------------
 * 本文件**不写在 HTML 里**，由 js/anim.js 在 load 之后的空闲时段
 * 动态拉起。原因：anime.js(17KB) 与 Vivus(12.5KB) 都属于"锦上添花"，
 * 不该占用首屏关键路径 —— "首屏 JS 净增为 0" 就是靠这一条实现的。
 *
 * 两条与 css/anim.css 一致的硬约定：
 *   1) 位移用独立的 translate / scale / rotate 属性，不用 transform。
 *      style.css 的 .reveal-init/.reveal-in 把 opacity 和 transform 都标了
 *      !important，两者都会被吃掉。所以本文件只挑**不带 reveal** 的元素
 *      （即各容器内部的后代节点），并且动画结束后清掉内联样式。
 *   2) prefers-reduced-motion: reduce 时一个库都不下载。
 *
 * 失败原则：动画是附加品。任何一步失败都必须回到"静态但完整"，
 * 绝不能因为库没加载就留下不可见的内容。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ANIM_LIB__) return;
  window.__ANIM_LIB__ = true;

  /* 站点根：file:// 与 GitHub Pages 任意深度的 404 路径都要正确。
     与 js/sidebar.js / js/live2d-fix.js 同一套推导方式。 */
  var BASE = '/';
  var SCRIPT = document.currentScript;
  if (!SCRIPT) {
    var LIST = document.getElementsByTagName('script');
    for (var i = LIST.length - 1; i >= 0; i--) {
      if (LIST[i].src && /\/anim-lib\.js(\?|$)/.test(LIST[i].src)) { SCRIPT = LIST[i]; break; }
    }
  }
  if (SCRIPT && SCRIPT.src) {
    var M = SCRIPT.src.match(/^(.*\/)js\/anim-lib\.js(\?.*)?$/);
    if (M) BASE = M[1];
  }

  /* 关了动效就整层不加载，连库的字节都不花 */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ---------- 库加载：同一地址只下一次，失败静默 ---------- */
  var cache = {};
  function load(src) {
    if (cache[src]) return cache[src];
    var p = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { res(true); };
      s.onerror = function () { rej(new Error('动画库加载失败: ' + src)); };
      document.head.appendChild(s);
    });
    /* 主动吞掉 rejection：动画失败不该往控制台冒红 */
    p['catch'](function () {});
    cache[src] = p;
    return p;
  }

  /* ---------- 1. Vivus：SVG 描边自绘 ---------- */
  function drawSVG() {
    var els = document.querySelectorAll('svg[data-draw]');
    if (!els.length) return;
    load(BASE + 'js/vendor/vivus.min.js').then(function () {
      if (typeof window.Vivus !== 'function') return;
      Array.prototype.forEach.call(els, function (svg) {
        var frames = parseInt(svg.getAttribute('data-draw'), 10) || 90;
        try {
          new window.Vivus(svg, {
            type: 'oneByOne',
            duration: frames,
            animTimingFunction: window.Vivus.EASE
          });
        } catch (e) {}
        /* 交给 Vivus 之后就撤掉"待绘不可见"状态 */
        svg.classList.remove('an-draw-pending');
      });
    }, function () {});
  }

  /* ---------- 2. anime.js：进入视口时交错入场 ---------- */
  /* 只作用于容器内部的后代节点 —— 它们不带 reveal-init/reveal-in，
     所以 anime 写的 opacity / transform 不会被 !important 吃掉。 */
  function staggerIn() {
    var hosts = document.querySelectorAll('[data-stagger]');
    if (!hosts.length || !('IntersectionObserver' in window)) return;
    load(BASE + 'js/vendor/anime.min.js').then(function () {
      var anime = window.anime;
      if (typeof anime !== 'function') return;
      Array.prototype.forEach.call(hosts, function (host) {
        var sel = host.getAttribute('data-stagger') || '*';
        var items = host.querySelectorAll(sel);
        if (!items.length) return;
        var io = new IntersectionObserver(function (entries) {
          for (var k = 0; k < entries.length; k++) {
            if (!entries[k].isIntersecting || host.__anDone) continue;
            host.__anDone = true;
            io.disconnect();
            anime({
              targets: items,
              opacity: [0, 1],
              translateY: [22, 0],
              scale: [0.97, 1],
              duration: 680,
              easing: 'easeOutCubic',
              delay: anime.stagger(60),
              /* 结束后清掉内联样式，把控制权还给样式表 */
              complete: function () {
                Array.prototype.forEach.call(items, function (el) {
                  el.style.opacity = '';
                  el.style.transform = '';
                });
              }
            });
          }
        }, { threshold: 0.1 });
        io.observe(host);
      });
    }, function () {});
  }

  /* ---------- 3. 点击涟漪（B5）----------
   * 走事件委托，不逐个元素绑监听。用 position:fixed + 视口坐标画在点击点，
   * 完全不去改宿主的 position/overflow —— 给任意元素加 overflow:hidden 可能剪掉
   * 阴影或已有的溢出内容，那风险不值得冒。 */
  function ripple() {
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      var host = t && t.closest ? t.closest('a,button,.link-card,.page-tab,.mode-chip,.ctrl-btn,.media-card') : null;
      if (!host) return;
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      /* 大卡片不铺涟漪：圆会大到看不出是涟漪，反而像脏了一块 */
      if (r.width > 400 || r.height > 300) return;
      var size = Math.max(r.width, r.height) * 2.2;
      var sp = document.createElement('span');
      sp.className = 'an-ripple';
      sp.style.width = sp.style.height = size + 'px';
      sp.style.left = e.clientX + 'px';
      sp.style.top = e.clientY + 'px';
      document.body.appendChild(sp);
      setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 620);
    }, { passive: true });
  }

  /* ---------- 4. 指针跟随：卡片倾斜 + 磁吸（B3/B4）----------
   * 难点：.card/.post-card/.work-card 上挂着 cardFloat 无限动画，而动画会压过
   * 普通声明，直接写 transform 做倾斜是没反应的。所以指针进入时先把 cardFloat
   * 停掉（animation-name:none）把 transform 让出来，离开时恢复。
   * cardFloat 幅度只有 6px，恢复时最多一次 6px 相位跳变，观感上察觉不到。 */
  function pointerFX() {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (!window.matchMedia('(hover: hover)').matches) return;
    var MAX_TILT = 5, MAX_MAG = 5;
    var cards = document.querySelectorAll('.media-card,.post-card,.work-card');
    Array.prototype.forEach.call(cards, function (card) {
      var par = card.parentElement;
      if (par && !par.classList.contains('an-tilt')) par.classList.add('an-tilt');
      card.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add('an-floating-off');
        card.style.transform = 'perspective(760px) rotateY(' + (px * MAX_TILT).toFixed(2) +
          'deg) rotateX(' + (-py * MAX_TILT).toFixed(2) + 'deg) translateZ(6px)';
      }, { passive: true });
      card.addEventListener('pointerleave', function () {
        card.style.transform = '';
        card.classList.remove('an-floating-off');
      });
    });
    /* 磁吸：按钮/链接朝指针挪一点点，上限 5px；只写 translate，不动 transform */
    var mags = document.querySelectorAll('.btn,.btn-cherry,.btn-primary,.btn-secondary,.page-tab,.ctrl-btn');
    Array.prototype.forEach.call(mags, function (el) {
      el.classList.add('an-magnet');
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        var dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.translate = (dx * MAX_MAG).toFixed(1) + 'px ' + (dy * MAX_MAG).toFixed(1) + 'px';
      }, { passive: true });
      el.addEventListener('pointerleave', function () { el.style.translate = ''; });
    });
  }

  /* ---------- 5. 滚动进度条（B6）---------- */
  function scrollBar() {
    var bar = document.createElement('div');
    bar.id = 'an-scrollbar';
    document.body.appendChild(bar);
    var raf = 0;
    function paint() {
      raf = 0;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.pageYOffset / h)) : 0;
      bar.style.scale = p + ' 1';
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(paint); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint();
  }

  /* ---------- 6. 侧边栏当前项指示条（B7）---------- */
  function navIndicator() {
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    var here = location.pathname.split('/').pop() || 'index.html';
    var active = null;
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      var h = (a.getAttribute('href') || '').split(/[?#]/)[0].split('/').pop();
      if (h === here) active = a;
    });
    if (!active) return;
    var ind = document.createElement('span');
    ind.className = 'an-indicator';
    nav.appendChild(ind);
    function place() {
      var r = active.getBoundingClientRect();
      var nr = nav.getBoundingClientRect();
      ind.style.height = r.height + 'px';
      ind.style.translate = '0 ' + (r.top - nr.top + nav.scrollTop) + 'px';
      ind.style.opacity = '1';
    }
    place();
    window.addEventListener('resize', place, { passive: true });
    window.addEventListener('load', place);
  }

  /* ---------- 7. 播放态编排（B8）----------
   * 用 MutationObserver 盯 class 变化，不依赖播放器内部 API。
   * 只在 .playing 出现时给封面一小段回弹，不干扰已有的 mc-* 动画。 */
  function playFlourish() {
    var hosts = document.querySelectorAll('.work-card,.ns-item');
    if (!hosts.length) return;
    load(BASE + 'js/vendor/anime.min.js').then(function () {
      var anime = window.anime;
      if (typeof anime !== 'function') return;
      function pop(el) {
        var cover = el.querySelector('.card-cover,.ns-play');
        if (!cover) return;
        anime.remove(cover);
        anime({ targets: cover,
          scale: [{ value: 1.06, duration: 260, easing: 'easeOutQuad' },
                  { value: 1, duration: 420, easing: 'easeOutBack' }],
          complete: function () { cover.style.transform = ''; } });
      }
      var mo = new MutationObserver(function (ms) {
        for (var i = 0; i < ms.length; i++) {
          var el = ms[i].target;
          if (el.classList && el.classList.contains('playing')) pop(el);
        }
      });
      Array.prototype.forEach.call(hosts, function (el) {
        mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      });
    }, function () {});
  }

  /* ---------- 8. 无限动画离屏暂停（A4）----------
   * 放在延迟层而不是 anim.js：这样首屏一个字节都不占。滚出视口的元素本来
   * 就看不见，晚一两秒才加上 .an-idle 没有任何观感影响。
   * 这些选择器就是 style.css / music.css 里挂了 infinite 动画的宿主。 */
  function offscreenPause() {
    if (!('IntersectionObserver' in window)) return;
    var SEL = '.blog-title,.subhead,.card,.post-card,.page-card,.profile-card,' +
              '.player-card,.work-card,.btn,.page-tab,.ctrl-btn,.mode-chip';
    var els = document.querySelectorAll(SEL);
    if (!els.length) return;
    var io = new IntersectionObserver(function (es) {
      for (var n = 0; n < es.length; n++) {
        es[n].target.classList.toggle('an-idle', !es[n].isIntersecting);
      }
    }, { rootMargin: '150px' });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    drawSVG();
    staggerIn();
    ripple();
    pointerFX();
    offscreenPause();
    scrollBar();
    navIndicator();
    playFlourish();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
