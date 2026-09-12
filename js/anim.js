/* ============================================================
 * 全站动画补充层（js/anim.js）
 * ------------------------------------------------------------
 * 与 common.js 的分工：
 *   common.js 决定"什么时候显示"（IntersectionObserver 加 .reveal-in）
 *   本文件决定"显示得好看"（交错延迟、抬升、淡入、背景光斑）
 * 不重复注册观察器，只监听 .reveal-in 的出现来补交错延迟。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__ANIM__) return;
  window.__ANIM__ = true;

  /* 站点根：必须在这里同步取 document.currentScript —— 一旦进入 ready()
     回调它就已经是 null 了。file:// 与任意深度的 404 路径都要正确。 */
  var BASE = '/';
  var SELF = document.currentScript;
  if (!SELF) {
    var SL = document.getElementsByTagName('script');
    for (var i = SL.length - 1; i >= 0; i--) {
      if (SL[i].src && /\/anim\.js(\?|$)/.test(SL[i].src)) { SELF = SL[i]; break; }
    }
  }
  if (SELF && SELF.src) {
    var SM = SELF.src.match(/^(.*\/)js\/anim\.js(\?.*)?$/);
    if (SM) BASE = SM[1];
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- 1. 入场交错 ---------- */
    /* 同一批出现的兄弟节点按顺序各晚 70ms，最多拖后 350ms，
       避免一整排卡片齐刷刷同时蹦出来。 */
    var MAX_STEP = 5, STEP_MS = 70;
    function orderOf(el) {
      var n = 0, p = el.previousElementSibling;
      while (p) {
        if (p.classList && (p.classList.contains('reveal-in') || p.classList.contains('reveal-init'))) n++;
        p = p.previousElementSibling;
      }
      return Math.min(n, MAX_STEP);
    }
    function stagger(el) {
      if (el.__anStagger) return;
      el.__anStagger = true;
      el.style.setProperty('--an-delay', (orderOf(el) * STEP_MS) + 'ms');
    }
    if (!reduce && 'MutationObserver' in window) {
      var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var el = muts[i].target;
          if (el.classList && el.classList.contains('reveal-in')) stagger(el);
        }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    }
    /* 首屏已经显示的那批也要补上 */
    Array.prototype.forEach.call(document.querySelectorAll('.reveal-in'), stagger);

    /* ---------- 2. 卡片抬升 ---------- */
    var CARDS = '.profile-card,.poem-card,.main-card,.tool-card,.post-card,.page-card,' +
                '.section-block,.archive-item,.link-card,.guest-card';
    Array.prototype.forEach.call(document.querySelectorAll(CARDS), function (el) {
      el.classList.add('an-lift');
    });

    /* ---------- 3. 标题与导航入场 ---------- */
    Array.prototype.forEach.call(document.querySelectorAll('.blog-title'), function (el) {
      if (!reduce) el.classList.add('an-title-in');
    });
    var navA = document.querySelectorAll('.sidebar-nav a');
    if (!navA.length) navA = document.querySelectorAll('.sidebar-nav > *');
    Array.prototype.forEach.call(navA, function (el, i) {
      if (reduce) return;
      el.style.setProperty('--an-i', String(Math.min(i, 10)));
      el.classList.add('an-nav-in');
    });

    /* ---------- 4. 小标题下划线 ---------- */
    Array.prototype.forEach.call(document.querySelectorAll('main h2, main h3'), function (el) {
      el.classList.add('an-underline');
    });

    /* ---------- 5. 图片淡入 ---------- */
    /* 万一图片加载失败、或者 load 一直不触发，2.5 秒后强制显示。
       不能让它永远停在 opacity:0 —— 那就成了"图挂了"。 */
    Array.prototype.forEach.call(document.querySelectorAll('main img'), function (img) {
      if (reduce || !img.getAttribute('src')) return;
      img.classList.add('an-fade');
      var show = function () { img.classList.add('an-in'); };
      if (img.complete && img.naturalWidth > 0) { show(); return; }
      img.addEventListener('load', show, { once: true });
      img.addEventListener('error', show, { once: true });
      setTimeout(show, 2500);
    });

    /* ---------- 6. 背景光斑 ---------- */
    if (!reduce && !document.getElementById('an-aurora')) {
      var au = document.createElement('div');
      au.id = 'an-aurora';
      au.setAttribute('aria-hidden', 'true');
      au.innerHTML = '<i></i><i></i><i></i>';
      document.body.insertBefore(au, document.body.firstChild);
    }

    /* ---------- 7. SVG 描边待绘 + 延后拉起动画库 ---------- */
    /* 先给待绘的 SVG 盖上"暂不可见"，避免"先全画好、再清空重画"的闪跳。
       3.5 秒兜底：库没来也一定恢复可见，绝不能留下空白。 */
    Array.prototype.forEach.call(document.querySelectorAll('svg[data-draw]'), function (svg) {
      svg.classList.add('an-draw-pending');
      setTimeout(function () { svg.classList.remove('an-draw-pending'); }, 3500);
    });
    /* anime.js(17KB) 与 Vivus(12.5KB) 只在 load 之后的空闲时段按需加载，
       绝不占用首屏关键路径 —— "首屏 JS 净增为 0" 靠的就是这一条。 */
    function scheduleLib() {
      if (window.__ANIM_LIB__ || window.__ANIM_LIB_SRC) return;
      window.__ANIM_LIB_SRC = 1;
      var s = document.createElement('script');
      s.src = BASE + 'js/anim-lib.js';
      s.async = true;
      s.onerror = function () {};
      document.head.appendChild(s);
    }
    function whenIdle() {
      if ('requestIdleCallback' in window) window.requestIdleCallback(scheduleLib, { timeout: 2500 });
      else setTimeout(scheduleLib, 400);
    }
    /* 正常在 load 之后的空闲时段拉起；但 load 迟迟不来（慢 CDN、长轮询）时
       必须有兜底，否则整个动画层会静默失效 —— 实测 Archives.html 就会这样。
       动态插入的 script 自带 async，不会阻塞渲染，这个兜底是安全的。 */
    var pulled = false;
    function pullOnce() { if (pulled) return; pulled = true; whenIdle(); }
    if (document.readyState === 'complete') pullOnce();
    else {
      window.addEventListener('load', pullOnce, { once: true });
      setTimeout(pullOnce, 2500);
    }
  });
})();
