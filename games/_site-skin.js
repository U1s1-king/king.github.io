/* ============================================================
 * 站点统一皮脚本 (games/_site-skin.js)
 * 只做一件事：把每个游戏的浏览器标题统一成「游戏名 · 游戏厅 | Tomo Ebizuka」。
 * 页面底色/字体/描边在 _site-skin.css 里，返回入口在 _back.js 里。
 * ============================================================ */
(function () {
  function siteName() {
    var h = document.querySelector('h1');
    var name = h ? (h.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (!name) {
      name = (document.title || '').split(/[|·—-]/)[0].trim();
    }
    return name || '小游戏';
  }
  function apply() {
    try {
      document.title = siteName() + ' · 游戏厅 | Tomo Ebizuka';
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
