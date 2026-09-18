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

  /* 打开单篇正文。两种入口共用：
     · 一级页（脚本没跑到 / 壳没建时的回退路径）→ 压二级页
     · 日记壳里点单篇 → 压三级页
     所以这里不再用「已经开着层就 return」把三级页挡掉，改成看层数上限。 */
  function openPost(card) {
    if (!narrow()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    var d = (window.AppShell.detailDepth ? window.AppShell.detailDepth() : 0);
    if (d >= 3) return;
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
    /* 回调名不能再共用 onloadTurnstileCallback：它同时也是 Guestbook.js 的兜底
       注册名，两边抢同一个全局名，再叠上「api.js 可能被插两次」就是竞态 ——
       后插的那次调回调时对方函数还没定义，控制台报
       onloadTurnstileCallback is not defined，人机验证控件就渲染不出来。
       改成本文件私有回调名 + 只插一次 api.js。 */
    if (!window.__jrnTurnstileLoading) {
      window.__jrnTurnstileLoading = true;
      window.__jrnTurnstileReady = function () {
        if (typeof window.__renderTurnstile === 'function') window.__renderTurnstile();
      };
      loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__jrnTurnstileReady', function () {});
    }
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
    /* 工具卡收进入口（不依赖有没有日记卡片，所以放在 .post-card 判断之前） */
    buildEntries();
    var cards = document.querySelectorAll('.post-card');
    if (!cards.length) return;
    /* 关键：正文的收起与摘要都挂在这个开关上。脚本一旦没跑到（缓存、旧包、
       异常），页面自动退回「完整正文」的原样，而不是变成一页光秃秃的标题。 */
    document.documentElement.classList.add('pc-list');
    Array.prototype.forEach.call(cards, decorate);

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var card = t.closest('.post-card');
      /* 日记壳里的卡片本来就在 .detail-view 内，不能一概拦掉。
         规则改成：点的是「日记壳里的卡片」就开三级页，其余详情层
         （图片查看器、今日/学习/专注各页）里的点击仍然不触发开卡。 */
      if (card && t.closest('.pc-shell')) { openPost(card); return; }
      if (t.closest('.detail-view')) return;
      if (card) openPost(card);
    });
  }


  /* ============================================================
     移动端：工具卡收进「伪二级页 / 三级页」
     ------------------------------------------------------------
     背景：日记页在手机上首屏是 8 张工具卡（诗句/天气/心情/农历/倒计时/
     每日一词/7天天气/番茄钟），真正的日记正文被压到很下面。
     这里把它们按功能收成 3 个入口，点进去是二级页；部分二级页里再挂
     一层三级页（例如「本周天气」→ 单日详情）。

     关键设计：搬移，不是克隆
     工具卡里跑着真实状态（番茄钟的 setInterval、心情打卡的 localStorage、
     农历实例、天气 fetch 的回调），克隆 DOM 会把监听器与定时器一起丢掉。
     所以一律用 AppShell.adopt() 搬真实节点，关掉时 releaseAdopted 自动归位。

     依赖顺序：本段在 Journal.js 之后执行（见 Journal.html 的 script 顺序），
     而 Journal.js 那个 IIFE 抓的是当时的 DOM 引用（tempEl / logEl / btns…），
     搬移不改这些引用，回调照常打到搬过去的节点上，所以功能不断。

     回退：一切挂在 html.jrn-app 上，脚本没跑到就整块不生效，
     页面退回改动前的原样（日记正文在上、工具卡原样堆着）。
     ============================================================ */
  var GROUPS = [
    /* 日记壳排第一：它是这个页面的主体，工具卡往后站。
       点它进的是「四篇日记列表 + 关于博主」的二级页，
       再从列表点单篇 → 三级页读正文。 */
    { key: 'posts', title: '日记', icon: 'fa-book-open', desc: '四篇随笔 · 点开阅读全文' },
    { key: 'today', title: '今日', icon: 'fa-sun',      desc: '诗句 · 天气 · 心情 · 农历 · 倒计时' },
    { key: 'learn', title: '学习', icon: 'fa-book',     desc: '每日一词 · 本周天气 · 番茄钟' }
  ];

  /* 二级页里可再展开的三级页。判据写在选择器上，命中的子块被搬进三级页。 */
  var SUBPAGES = [
    { key: 'today', sel: '.journal-weather', title: '今日天气', icon: 'fa-cloud-sun' },
    { key: 'today', sel: '.lunar-card',      title: '农历黄历', icon: 'fa-moon' },
    { key: 'learn', sel: '.week-weather',    title: '本周天气', icon: 'fa-calendar-week' }
  ];

  function maxDepth() { return 3; }
  function depth() {
    return (window.AppShell && window.AppShell.detailDepth) ? window.AppShell.detailDepth() : 0;
  }

  function groupCards(key) {
    var all = document.querySelectorAll('[data-jrn-group="' + key + '"]');
    return Array.prototype.slice.call(all);
  }

  /* ---------- 一级页入口卡 ---------- */
  function buildEntries() {
    var host = document.querySelector('.blog-container');
    if (!host) return;
    if (document.querySelector('.jrn-entry-row')) return;
    var row = document.createElement('div');
    row.className = 'jrn-entry-row';
    document.documentElement.classList.add('jrn-app');

    GROUPS.forEach(function (g) {
      var cards = groupCards(g.key);
      /* 工具卡组靠 data-jrn-group 认领；「日记」壳没有这类卡，
         它认的是 .post-card（加上搬到壳里的「关于博主」）。 */
      if (!cards.length && g.key !== 'posts') return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'jrn-entry';
      b.setAttribute('data-group', g.key);
      b.innerHTML =
        '<span class="jrn-entry-ic"><i class="fas ' + g.icon + '"></i></span>' +
        '<span class="jrn-entry-tx"><b>' + g.title + '</b><small>' + g.desc + '</small></span>' +
        '<i class="fas fa-chevron-right jrn-entry-go"></i>';
      b.addEventListener('click', function () {
        if (g.key === 'posts') { openPostShell(g); return; }
        openGroup(g, cards);
      });
      row.appendChild(b);
    });

    var first = document.querySelector('.poem-card');
    if (first && first.parentNode) first.parentNode.insertBefore(row, first);
    else host.insertBefore(row, host.firstChild);
  }


  /* ---------- 二级页：日记壳（4 篇列表 + 关于博主） ----------
     把 .post-card 与底部「关于博主」整体搬进壳里，壳里点单篇再压三级页。
     为什么要一层壳：原来 4 篇日记直接摊在一级页，工具卡一收进来之后
     一级页的信息结构就变成「4 个入口 + 4 篇长列表」，长短不一。
     套一层壳之后一级页只剩入口，日记内容收进二级、正文收到三级。 */
  function openPostShell(g) {
    if (!narrow() || !window.AppShell || !window.AppShell.openDetail) return;
    if (depth() >= maxDepth()) return;
    var cards = postCards();
    if (!cards.length) return;

    var wrap = document.createElement('div');
    wrap.className = 'jrn-page pc-shell';
    var host = document.createElement('div');
    host.className = 'pc-shell-list';
    wrap.appendChild(host);

    /* 底部「关于博主」跟着一起进去：它是日记页的收尾，
       留在一级页会在 4 个入口下面孤零零地悬着。 */
    var about = document.querySelector('.blog-container > .st-27791aae');

    window.AppShell.openDetail({ title: g.title, content: wrap });
    for (var i = 0; i < cards.length; i++) {
      window.AppShell.adopt(cards[i], host);
    }
    if (about) {
      var abox = document.createElement('div');
      abox.className = 'pc-shell-about';
      wrap.appendChild(abox);
      window.AppShell.adopt(about, abox);
    }
  }

  function postCards() {
    return Array.prototype.slice.call(document.querySelectorAll('.post-card'));
  }

  /* ---------- 二级页：一组工具卡 ---------- */
  function openGroup(g, cards) {
    if (!narrow() || !window.AppShell || !window.AppShell.openDetail) return;
    if (depth() >= maxDepth()) return;

    var wrap = document.createElement('div');
    wrap.className = 'jrn-page';
    var pending = [];
    cards.forEach(function (card) {
      /* 已经开着的二级页里再进一个子页 */
      var sub = null;
      for (var i = 0; i < SUBPAGES.length; i++) {
        if (SUBPAGES[i].key === g.key && card.matches(SUBPAGES[i].sel)) { sub = SUBPAGES[i]; break; }
      }
      if (sub) {
        var entry = document.createElement('button');
        entry.type = 'button';
        entry.className = 'jrn-subentry';
        entry.innerHTML =
          '<i class="fas ' + sub.icon + '"></i> ' + sub.title +
          '<i class="fas fa-chevron-right jrn-entry-go"></i>';
        entry.addEventListener('click', function () { openSub(sub, card); });
        wrap.appendChild(entry);
        return;   /* 卡片本体留在一级页树里，点进去才搬 */
      }
      var box = document.createElement('div');
      box.className = 'jrn-box';
      wrap.appendChild(box);
      pending.push({ card: card, box: box });
    });

    /* 先建层再搬节点 —— 和 openSub 保持同一个顺序。
       反过来（先搬进还没入文档的 wrap）虽然也能跑通，但 adopt() 记下的
       父节点、以及搬移时的可见性都处在一个「游离」状态，容易在后续改动里
       踩坑，所以统一成"层先就位、节点后搬"。 */
    window.AppShell.openDetail({ title: g.title, content: wrap });
    for (var k = 0; k < pending.length; k++) {
      window.AppShell.adopt(pending[k].card, pending[k].box);
    }
  }

  /* ---------- 三级页：二级页里的一个子块 ---------- */
  function openSub(sub, card) {
    if (depth() >= maxDepth()) return;
    var wrap = document.createElement('div');
    wrap.className = 'jrn-page';
    var box = document.createElement('div');
    box.className = 'jrn-box';
    wrap.appendChild(box);
    window.AppShell.openDetail({ title: sub.title, content: wrap });
    /* 注意：adopt 必须在 openDetail 之后 —— 搬进来的节点要落在
       刚建好的那一层里。父卡（已在二级页里）随层栈一起留存。 */
    window.AppShell.adopt(card, box);
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
