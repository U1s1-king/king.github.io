/* ============================================================
 * 游戏页返回条 (games/_back.js)
 * ------------------------------------------------------------
 * 游戏都在自己的文件夹里，没有站点侧边栏/底部 tab，
 * 这里补一个浮动入口，点一下回游戏厅。样式内联，不依赖任何外站资源。
 * ============================================================ */
(function () {
  if (window.top !== window.self && document.getElementById('backPill')) return;
  function mount() {
    if (document.getElementById('backPill')) return;
    var a = document.createElement('a');
    a.id = 'backPill';
    a.href = '/Games.html';
    a.textContent = '\u2039 \u6e38\u620f\u5385';
    a.title = '\u8fd4\u56de\u6e38\u620f\u5385';
    var st = document.createElement('style');
    st.textContent = '#backPill{position:fixed;left:14px;top:14px;z-index:2147483000;padding:7px 14px;border-radius:999px;' +
      'background:rgba(255,182,193,.92);color:#fff;font:600 13px/1.4 system-ui,-apple-system,"Microsoft YaHei",sans-serif;' +
      'text-decoration:none;box-shadow:0 4px 14px rgba(161,69,99,.28);backdrop-filter:blur(6px);transition:transform .15s}' +
      '#backPill:hover{transform:translateY(-1px);background:rgba(161,69,99,.94)}' +
      '@media(max-width:768px){#backPill{left:10px;top:10px;padding:6px 12px;font-size:12px}}';
    document.head.appendChild(st);
    document.body.appendChild(a);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
