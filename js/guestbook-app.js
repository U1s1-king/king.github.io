/* ============================================================
 * 留言页 App 化 (guestbook-app.js)
 * ------------------------------------------------------------
 * 两件事：
 * 1) APP 内降级。打包成 App 后页面 origin 是 https://localhost：
 *    giscus 需要能校验的域名，Cloudflare Turnstile 同样，后端还有
 *    CORS 来源限制 —— 结果是「点了留言没反应」，用户完全不知道为什么。
 *    这里换成人话说明 + 一键转系统浏览器（走 app-shell 的外链通道）。
 * 2) 手机端把「写留言」表单收进全屏二级页：留言列表当主页、写作当
 *    二级页，和主流 App 的「列表 + 发布页」一致。
 * 网页端（非 APP、非窄屏）一行都不碰。
 * ============================================================ */
(function () {
  'use strict';

  var PAGE_URL = 'https://zhaokening.ccwu.cc/Guestbook.html';

  function narrow() { return window.innerWidth <= 768; }
  function isApp() { return !!(window.AppShell && window.AppShell.isApp); }
  function byId(id) { return document.getElementById(id); }
  function q(sel, root) { return (root || document).querySelector(sel); }

  function noteHtml(title, desc, btnText) {
    return '<i class="fas fa-circle-info"></i><div><b>' + title + '</b><p>' + desc + '</p>' +
      '<a class="gb-note-btn" href="' + PAGE_URL + '" target="_blank" rel="noopener noreferrer">' +
      '<i class="fas fa-arrow-up-right-from-square"></i> ' + btnText + '</a></div>';
  }

  /* ---------- 1. APP 内降级 ---------- */
  function degrade() {
    if (!isApp()) return;
    document.documentElement.classList.add('gb-degraded');

    var formCard = q('.form-card');
    if (formCard && formCard.parentNode) {
      var note = document.createElement('div');
      note.className = 'gb-note';
      note.innerHTML = noteHtml(
        'App 内无法提交留言',
        '留言与论坛都做了来源校验和人机验证，打包后的 App（localhost）过不了这一关。请到浏览器里留言喵~',
        '在浏览器中打开');
      formCard.parentNode.insertBefore(note, formCard);
    }
    var btn = byId('submitBtn');
    if (btn) { btn.disabled = true; btn.setAttribute('aria-disabled', 'true'); }

    /* 论坛：giscus 脚本可能晚于本文件往 wrapper 里塞 iframe，
       所以这里换掉内容的同时，CSS 里再明确藏掉 iframe。 */
    var wrap = q('.giscus-wrapper');
    if (wrap) {
      wrap.innerHTML = '<div class="gb-note gb-note-forum">' +
        noteHtml('论坛在 App 里加载不出来', 'giscus 需要能校验域名，App 内的 localhost 不在白名单里。',
                 '在浏览器中打开论坛') + '</div>';
    }
    var tst = byId('turnstileWrap');
    if (tst) {
      var hint = document.createElement('div');
      hint.className = 'gb-note gb-note-mini';
      hint.innerHTML = '<i class="fas fa-shield-alt"></i><div>人机验证在 App 内不可用（已停用提交按钮）</div>';
      tst.parentNode.insertBefore(hint, tst.nextSibling);
    }
  }

  /* ---------- 2. 写留言二级页 ---------- */
  function openComposer(formCard) {
    if (!narrow() || isApp()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    if (window.AppShell.detailOpen()) return;

    var wrap = document.createElement('div');
    wrap.className = 'gb-compose-page';
    /* .in-detail 是给 CSS 用的：列表态靠 :not(.in-detail) 收起表单，
       这样不管表单在树的哪个位置被搬走都不会「搬进去还是隐藏的」 */
    formCard.classList.add('in-detail');
    window.AppShell.openDetail({
      title: '写留言',
      content: wrap,
      onClose: function () { formCard.classList.remove('in-detail'); }
    });
    window.AppShell.adopt(formCard, wrap);
  }

  function buildComposerEntry(formCard) {
    var bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'gb-compose';
    bar.innerHTML = '<i class="fas fa-pen-fancy"></i> 写留言';
    bar.addEventListener('click', function () { openComposer(formCard); });
    formCard.parentNode.insertBefore(bar, formCard);
  }

  /* 提交成功后自动退出写作页：留言列表重渲染就是成功信号，
     提交失败（缺昵称、验证没过）列表不会动，所以不会误关。 */
  function watchSubmit() {
    var btn = byId('submitBtn');
    var list = byId('messagesList');
    if (!btn || !list) return;
    var pending = false;
    btn.addEventListener('click', function () { pending = true; });
    new MutationObserver(function () {
      if (!pending) return;
      pending = false;
      if (window.AppShell && window.AppShell.detailOpen()) window.AppShell.closeDetail();
    }).observe(list, { childList: true });
  }

  function init() {
    degrade();
    var formCard = q('.form-card');
    if (!formCard || isApp() || !narrow()) return;
    if (q('.gb-compose')) return;
    /* 开关挂 html：脚本没跑到就整块不生效，表单照旧在页面上 */
    document.documentElement.classList.add('gb-compose-mode');
    buildComposerEntry(formCard);
    watchSubmit();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) { if (isNarrow) init(); });
  }
})();
