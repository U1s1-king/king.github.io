/* ============================================================
 * 版本号统一管理 (version.js)
 * 修改 __DSH_VERSION 一处，即可刷新全站静态资源缓存
 * ============================================================ */
(function () {
  var __DSH_VERSION = '20260904';
  window.__DSH_VERSION = __DSH_VERSION;
  function bump(root) {
    if (!root) return;
    root.querySelectorAll('link[href*="?v="],script[src*="?v="]').forEach(function (el) {
      var attr = el.href ? 'href' : 'src';
      el[attr] = el.getAttribute(attr).replace(/\?v=[^"' ]+/, '?v=' + __DSH_VERSION);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { bump(document); });
  } else {
    bump(document);
  }
})();