/* ============================================================
 * 看板娘触摸端修正 (live2d-app.js) —— 仅手机端
 * ------------------------------------------------------------
 * 现象：点一下看板娘，四个按钮（角色/换装/拍照/隐藏）闪一下就没了。
 * 原因：waifu.js 用 fab 的 mouseenter/mouseleave 控制 .wf-side-show
 *       （第 373-374 行）。触摸端点下去会补一串合成鼠标事件，手指抬起后
 *       mouseleave 紧接着到达，面板就被摘掉了 —— hover 语义在触摸上没有意义。
 * 做法（纯客户端补丁，绝不改 CDN 上的 waifu.js）：
 *   1) 自己用 pointerdown/move/up 判定「点按」（位移 < 8px 才算，否则是拖动
 *      看板娘）。点模型 = 开/关侧栏；开了就停住，不再跟 hover 走。
 *   2) 同元素上的 mouseleave 监听在 waifu.js 之后注册，因此跑在它后面：
 *      只要是我们打开的，就立刻把 wf-side-show 补回来（并保证 800ms 最短显示）。
 *   3) 侧栏加一个「收起」按钮（waifu.js 只认 role/tex/snap/hide，多出来的这个
 *      由本文件处理）；点看板娘以外的地方也能收起。
 * 尺寸问题（面板 400px 宽超出屏幕、按钮不足 48px）在 css/app.css 里改。
 * 桌面端：narrow() 为假直接不介入，一个字节都不碰 waifu.js 的行为。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__L2D_APP__) return;
  window.__L2D_APP__ = true;

  var MIN_SHOW = 800;   /* 最短显示时长(ms)：抬手后的合成 mouseleave 不能吃掉它 */
  var TAP_SLOP = 8;     /* 位移小于这个值才算点按，否则算拖动看板娘 */

  function narrow() { return window.innerWidth <= 768; }
  function fab() { return document.getElementById('waifu-fab'); }

  var open = false;
  var holdUntil = 0;
  var downId = null, downX = 0, downY = 0, moved = false, downInFab = false;

  function setOpen(f, on) {
    open = !!on;
    if (!f) return;
    if (open) {
      holdUntil = Date.now() + MIN_SHOW;
      f.classList.remove('wf-hidden');
      f.classList.add('wf-side-show');
      var tg = document.getElementById('waifu-toggle');
      if (tg) tg.style.display = 'none';
    } else {
      f.classList.remove('wf-side-show');
    }
  }

  function patch() {
    var f = fab();
    if (!f || f.getAttribute('data-l2d-app')) return !!f;
    f.setAttribute('data-l2d-app', '1');

    /* (2) 与其斗 hover，不如在它摘掉之后立刻补回来。
           同元素同类型按注册顺序执行：waifu.js 的在前，所以这里跑在它后面。 */
    f.addEventListener('mouseleave', function () {
      if (open || Date.now() < holdUntil) f.classList.add('wf-side-show');
    });

    /* (1) 点按判定：起手在模型上、位移小于阈值、抬手即切换 */
    document.addEventListener('pointerdown', function (e) {
      if (!narrow() || e.button !== 0) { downId = null; return; }
      var t = e.target;
      var inFab = !!(t && t.closest && f.contains(t));
      downId = e.pointerId;
      downX = e.clientX;
      downY = e.clientY;
      moved = false;
      downInFab = inFab && !(t.closest('.wf-side-btn') || t.closest('.wf-panel'));
    }, true);
    document.addEventListener('pointermove', function (e) {
      if (downId === null || e.pointerId !== downId) return;
      if (Math.abs(e.clientX - downX) > TAP_SLOP || Math.abs(e.clientY - downY) > TAP_SLOP) moved = true;
    }, true);
    document.addEventListener('pointerup', function (e) {
      if (downId === null || e.pointerId !== downId) return;
      downId = null;
      if (moved) return;                       /* 拖动看板娘，不算点按 */
      if (downInFab) { setOpen(f, !open); return; }
      var t = e.target;
      var inFab = !!(t && t.closest && f.contains(t));
      if (open && !inFab) setOpen(f, false);   /* 点别处收起（waifu.js 那句只管 .wf-panel） */
    }, true);

    /* (3) 「收起」按钮：waifu.js 的 side 点击处理只认四个 data-act，这个我们自己收。
           它内部 stopPropagation 只挡祖先，挡不住同元素上的本监听。 */
    var side = f.querySelector('.wf-side');
    if (side && !side.querySelector('[data-act="close"]')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'wf-side-btn';
      b.setAttribute('data-act', 'close');
      b.setAttribute('title', '收起');
      b.textContent = '收起';
      side.appendChild(b);
      side.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.wf-side-btn') : null;
        if (btn && btn.getAttribute('data-act') === 'close') setOpen(f, false);
      });
    }
    return true;
  }

  /* fab 是引擎加载完才建的（CDN），所以要么现在就打上，要么盯着 DOM 等它出现 */
  function boot() {
    if (!narrow()) return;              /* 桌面端完全不介入 */
    if (patch()) return;
    var mo = new MutationObserver(function () { if (patch()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(function () { mo.disconnect(); }, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) { if (isNarrow) boot(); });
  }
})();
