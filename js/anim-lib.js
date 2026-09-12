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

  /* ---------- 启动 ---------- */
  function boot() {
    drawSVG();
    staggerIn();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
