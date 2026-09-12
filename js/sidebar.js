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
  btn.innerHTML = '<img src="img/btn-collapse.webp" alt="toggle">';
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
