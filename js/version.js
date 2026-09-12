/* ============================================================
 * 版本号统一管理 (version.js)
 * ------------------------------------------------------------
 * 发布新版本时执行：
 *
 *     python scripts/bump_version.py 20260912
 *
 * 该脚本会一次性同步三处版本号：
 *   1. 本文件的 __DSH_VERSION
 *   2. sw.js 的 VERSION（CACHE 与 CORE 的 ?v= 由它生成）
 *   3. 所有 HTML 里静态资源的 ?v= 查询串
 *   （外部 Live2D CDN 的版本号不受影响）
 *
 * 本文件的作用：把页面上所有带 ?v= 的 link/script 改写为当前版本，
 * 防止某个页面漏改。HTML 里已是正确版本时不会触发额外请求。
 * ============================================================ */
(function () {
  var __DSH_VERSION = '20260936';
  window.__DSH_VERSION = __DSH_VERSION;

  function bump(root) {
    if (!root) return;
    root.querySelectorAll('link[href*="?v="],script[src*="?v="]').forEach(function (el) {
      var attr = el.href ? 'href' : 'src';
      var cur = el.getAttribute(attr);
      if (!cur) return;
      var next = cur.replace(/\?v=[^"' ]+/, '?v=' + __DSH_VERSION);
      if (next !== cur) el.setAttribute(attr, next); /* 同值不赋值，避免重复请求 */
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bump(document); });
  } else {
    bump(document);
  }
})();
