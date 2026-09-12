/* ============================================================
 * 侧边栏折叠脚本 (sidebar.js)
 * 桌面端：完全隐藏/展开侧边栏，状态记忆在 localStorage
 * 移动端：不生效（侧边栏已由 CSS 隐藏）
 * ============================================================ */
(function () {
  var SIDEBAR = document.getElementById('siteSidebar');
  if (!SIDEBAR) return;

  var COLLAPSE_KEY = 'sidebarCollapsed';
  var collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch (e) {}

  var body = document.body;

  // 折叠按钮（侧边栏顶部）+ 恢复按钮（内容区）
  var btn = document.createElement('button');
  btn.id = 'sidebarToggle';
  btn.className = 'sidebar-toggle-btn';
  btn.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
  btn.title = collapsed ? '展开侧边栏' : '收起侧边栏';
  /* 资源基址。本文件被所有页面加载，而 404.html 会在任意深度被命中，所以不能用
     相对路径；但根绝对路径（/img/...）在用 file:// 直接打开 HTML 时会解析到磁盘
     根目录（file:///D:/img/...）而失效。这里改为从本脚本自身的 URL 推导站点根，
     http(s)、file://、任意深度三种情况都能正确工作；推导失败时退回根绝对路径。 */
  var BASE = '/';
  var SCRIPT = document.currentScript;
  if (!SCRIPT) {
    var LIST = document.getElementsByTagName('script');
    for (var i = LIST.length - 1; i >= 0; i--) {
      if (LIST[i].src && /\/sidebar\.js(\?|$)/.test(LIST[i].src)) { SCRIPT = LIST[i]; break; }
    }
  }
  if (SCRIPT && SCRIPT.src) {
    var M = SCRIPT.src.match(/^(.*\/)js\/sidebar\.js(\?.*)?$/);
    if (M) BASE = M[1];
  }
  btn.innerHTML = '<img src="' + BASE + 'img/btn-collapse.webp" alt="toggle">';
  document.body.appendChild(btn);

  function apply() {
    SIDEBAR.classList.toggle('sidebar-hidden', collapsed);
    body.classList.toggle('sidebar-collapsed', collapsed);
    btn.classList.toggle('is-collapsed', collapsed);
    btn.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
  }
  apply();

  btn.addEventListener('click', function () {
    collapsed = !collapsed;
    apply();
  });
})();
