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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  /* 视口从网页端切回手机端：把手机端的注入重新长回来。
     桌面端的残留由 AppShell 统一拆（见 app-shell.js 的 clearNarrowOnly）。 */
  if (window.AppShell && window.AppShell.onMode) {
    window.AppShell.onMode(function (isNarrow) { if (isNarrow) init(); });
  }
})();
