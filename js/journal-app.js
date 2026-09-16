/* ============================================================
 * 日记页 App 化 (journal-app.js) —— 仅手机端
 * ------------------------------------------------------------
 * 把 4 篇 .post-card 做成「列表 → 阅读全文」的伪二级页：
 *   · 列表态：卡片只留 标题 / 日期标签 / 两行摘要 / 阅读全文
 *   · 详情态：正文 .post-content 原样搬进详情层
 * 为什么是搬而不是克隆：正文里有 img.js-lightbox，图片查看器的
 * 点击监听绑在那个节点上，克隆过去监听器不会跟过去，图片就点不开了。
 * 桌面端不装饰、不拦截，页面与改动前完全一致。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }

  function teaserOf(card) {
    var c = card.querySelector('.post-content');
    if (!c) return '';
    var t = (c.textContent || '').replace(/\s+/g, ' ').trim();
    return t.length > 52 ? t.slice(0, 52) + '…' : t;
  }

  function decorate(card) {
    if (card.getAttribute('data-pc-ready')) return;
    card.setAttribute('data-pc-ready', '1');
    var foot = document.createElement('div');
    foot.className = 'pc-foot';
    var t = document.createElement('span');
    t.className = 'pc-teaser';
    t.textContent = teaserOf(card);
    var more = document.createElement('span');
    more.className = 'pc-more';
    more.innerHTML = '阅读全文 <i class="fas fa-chevron-right"></i>';
    foot.appendChild(t);
    foot.appendChild(more);
    card.appendChild(foot);
  }

  function openPost(card) {
    if (!narrow()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    if (window.AppShell.detailOpen()) return;
    var content = card.querySelector('.post-content');
    if (!content) return;

    var titleEl = card.querySelector('.post-title');
    var rawTitle = titleEl ? titleEl.textContent : '';
    var title = rawTitle.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim() || '日记';

    var wrap = document.createElement('div');
    wrap.className = 'pc-detail';
    /* 正文里也要有标题：顶栏那条是截断的，而且手机上没有 H1 撑着 */
    if (rawTitle.trim()) {
      var h = document.createElement('h2');
      h.className = 'pc-detail-title';
      h.textContent = rawTitle.trim();
      wrap.appendChild(h);
    }
    var meta = card.querySelector('.post-meta');
    if (meta) {
      var m = document.createElement('div');
      m.className = 'pc-detail-meta';
      m.innerHTML = meta.innerHTML;
      wrap.appendChild(m);
    }
    var body = document.createElement('div');
    body.className = 'pc-detail-body';
    wrap.appendChild(body);

    window.AppShell.openDetail({ title: title, content: wrap });
    window.AppShell.adopt(content, body);
  }

  /* ---------- 留言板二级页 ----------
     正文节点常驻在 #gbSource（hidden），打开时用 adopt 搬进二级页，关掉自动归还。
     留言脚本和 Turnstile 按需加载：日记页平时不拉它们，点开才拉。 */
  var gbLoading = false, gbReady = false, gbCbs = [];

  function loadScript(src, cb) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = cb;
    s.onerror = cb;
    document.body.appendChild(s);
  }

  /* 等 Turnstile 的 api.js 真正就绪（window.turnstile 可用）再往下走。
     最多等 10 秒，超时也继续 —— 不能因为挑战脚本被挡就不给看留言板。 */
  function waitTurnstile(cb) {
    if (window.turnstile && window.turnstile.render) { cb(); return; }
    loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback', function () {});
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (window.turnstile && window.turnstile.render) { clearInterval(timer); cb(); return; }
      if (tries >= 100) { clearInterval(timer); cb(); }
    }, 100);
  }

  function loadGuestbook(cb) {
    if (gbReady) { cb(); return; }
    gbCbs.push(cb);
    if (gbLoading) return;
    gbLoading = true;
    /* 顺序要紧：原页面是「api.js 先、Guestbook.js 后」。反过来它可能在
       window.turnstile 还没定义时就去 render，控件就退化成 Cloudflare 那张
       「无法连接到网站」的报错卡。 */
    waitTurnstile(function () {
      loadScript('js/Guestbook.js', function () {
        loadScript('js/guestbook-app.js', function () {
          gbReady = true;
          var fns = gbCbs.slice(0);
          gbCbs.length = 0;
          for (var i = 0; i < fns.length; i++) fns[i]();
        });
      });
    });
  }

  function setView(view, fromHash) {
    var gb = view === 'guestbook';
    document.documentElement.classList.toggle('gb-view', gb);
    var sw = document.getElementById('jrnSwitch');
    if (sw) {
      Array.prototype.forEach.call(sw.querySelectorAll('.jrn-switch-item'), function (b) {
        b.classList.toggle('is-on', (b.getAttribute('data-view') === 'guestbook') === gb);
      });
    }
    if (gb) {
      loadGuestbook(function () {
        if (typeof window.GuestbookAppInit === 'function') window.GuestbookAppInit();
      });
    }
    if (!fromHash) {
      try { history.replaceState(null, '', gb ? '#guestbook' : location.pathname + location.search); } catch (e) {}
    }
  }

  function initJournalSwitch() {
    if (document.documentElement.hasAttribute('data-jrn-switch')) return;
    document.documentElement.setAttribute('data-jrn-switch', '1');
    var sw = document.getElementById('jrnSwitch');
    if (sw) {
      sw.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.jrn-switch-item') : null;
        if (!b) return;
        var gb = b.getAttribute('data-view') === 'guestbook';
        setView(gb ? 'guestbook' : 'journal');
        if (gb) window.scrollTo(0, 0);
      });
    }
    /* 深链 Journal.html#guestbook 直接进留言板，刷新也不会丢 */
    setView(location.hash === '#guestbook' ? 'guestbook' : 'journal', true);
    window.addEventListener('hashchange', function () {
      setView(location.hash === '#guestbook' ? 'guestbook' : 'journal', true);
    });
  }

  function init() {
    if (!narrow()) return;
    var cards = document.querySelectorAll('.post-card');
    if (!cards.length) return;
    /* 关键：正文的收起与摘要都挂在这个开关上。脚本一旦没跑到（缓存、旧包、
       异常），页面自动退回「完整正文」的原样，而不是变成一页光秃秃的标题。 */
    document.documentElement.classList.add('pc-list');
    Array.prototype.forEach.call(cards, decorate);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.detail-view')) return;   /* 详情层里的点击不再触发开卡 */
      var card = t.closest('.post-card');
      if (card) openPost(card);
    });
  }

  initJournalSwitch();   /* 与视口无关，网页端也要能切 */

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) { if (isNarrow) init(); });
  }
})();
