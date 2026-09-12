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
  });
})();
