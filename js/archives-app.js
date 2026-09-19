/* ============================================================
 * 归档页 App 化 (archives-app.js) —— 仅手机端
 * ------------------------------------------------------------
 * 两类卡片各自成立：
 *   · 视频卡（.video-wrapper > B站 iframe）→ 搬移，接续播放不重置
 *   · 外链卡 / GitHub 仓库卡（只有 .card-info）→ 克隆即可
 * （音乐卡已随「音乐区域」区块一起移除，站点有独立的音乐页。）
 * 入口不去劫持整张卡片的点击：视频卡里本来就有播放按钮，
 * 整卡可点必然打架。改为每张卡右下角一个明确的「详情」按钮。
 * GitHub 仓库卡是 fetch 之后才插进来的，所以用 MutationObserver 补按钮。
 * 桌面端不装饰、不拦截。
 * ============================================================ */
(function () {
  'use strict';

  function narrow() { return window.innerWidth <= 768; }

  function decorate(card) {
    if (card.getAttribute('data-mc-ready')) return;
    card.setAttribute('data-mc-ready', '1');
    var row = document.createElement('div');
    row.className = 'mc-detail-row';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mc-detail';
    btn.innerHTML = '<i class="fas fa-circle-info"></i> 详情';
    row.appendChild(btn);
    card.appendChild(row);
  }

  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll('.media-card'), decorate);
  }

  function appendBiliLink(box, url) {
    if (!url) return;
    var a = document.createElement('a');
    a.className = 'mcd-open';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = '<i class="fas fa-up-right-from-square"></i> 在 B 站打开';
    box.appendChild(a);
  }


  /* ============================================================
     归档页：3 个大区块 + 小工具 → 入口 → 二级列表 → 三级详情
     ------------------------------------------------------------
     背景：归档页原先把多个区块摊成一条 9588px 的长页
     （实测 844px 视口 ≈ 11 屏），其中「网站外链区域」一区就 3276px。
     这里按内容切成 4 个入口，点进去是紧凑列表，再点卡片才看详情。

     层级：一级（入口）→ 二级（区块内卡片列表）→ 三级（原有详情/播放器）

     音乐区块已从归档页移除（站点有独立的音乐页，这里重复了），
     所以 AREAS 与 sectionsOf() 都少一项，序号整体前移。

     与日记页同样的三条原则：
     1) 搬移不是克隆 —— 视频 iframe 一克隆就会重新加载，所以一级页的
        卡片是**真节点**，进二级页用 adopt 搬。
     2) 层先就位、节点后搬（adopt 要落在已入文档的层里）。
     3) 回退开关 html.arc-app —— 脚本没跑到就整块不生效，页面退回改动前原样。
     ============================================================ */
  var AREAS = [
    { key: 'video', title: '视频',   icon: 'fa-video',       desc: 'B站嵌入 · 3 个视频' },
    { key: 'links', title: '外链',   icon: 'fa-link',        desc: '常去的网站收藏' },
    { key: 'cloud', title: '网盘',   icon: 'fa-cloud',       desc: '仓储资源' },
    { key: 'tools', title: '小工具', icon: 'fa-toolbox',     desc: '数据 · 美图 · 时钟 · 彩蛋' }
  ];

  /* 哪个区块属于哪个入口：按 .section-block 的**文档序号**切。
     前 3 个是「视频/外链/网盘」，之后的一律归「小工具」。
     注意这里不用类名判断 —— 区块只有 .section-block 一个共同类，
     顺序就是它们的身份，所以新增/删除区块时必须同步改这里。 */
  function sectionsOf() {
    /* 按文档顺序取全部区块：前 3 个（视频/外链/网盘）在 .archive-sections 里，
       其余 10 个小工具区是它的兄弟。用后代选择器一次拿全，再按序号切分。 */
    var all = Array.prototype.slice.call(
      document.querySelectorAll('.archive-container .section-block')
    );
    return { video: all.slice(0, 1), links: all.slice(1, 2),
             cloud: all.slice(2, 3), tools: all.slice(3) };
  }

  function depth() {
    return (window.AppShell && window.AppShell.detailDepth) ? window.AppShell.detailDepth() : 0;
  }

  /* ---------- 二级页里的一行：缩略图 + 标题 + 一行元信息 ---------- */
  function rowFor(card, title) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'arc-row';

    /* 缩略图：统一用类型图标。
       刻意**不去猜** B站封面 URL —— bvid 推不出封面图床路径
       （那需要额外调 api.bilibili.com/view，等于给列表加 21 个请求，
       还得处理失败/限流）。图标方案零请求、零失败态，
       封面留给三级页里已经在跑的播放器自己显示。 */
    var thumb = document.createElement('span');
    thumb.className = 'arc-row-thumb';
    thumb.innerHTML = '<i class="fas ' + iconFor(card) + '"></i>';

    var tx = document.createElement('span');
    tx.className = 'arc-row-tx';
    var b = document.createElement('b');
    b.textContent = title;
    var s = document.createElement('small');
    s.textContent = metaFor(card);
    tx.appendChild(b);
    tx.appendChild(s);

    var go = document.createElement('i');
    go.className = 'fas fa-chevron-right arc-row-go';

    btn.appendChild(thumb);
    btn.appendChild(tx);
    btn.appendChild(go);
    btn.addEventListener('click', function () { openCard(card); });
    return btn;
  }

  function iconFor(card) {
    if (card.querySelector('.video-wrapper')) return 'fa-video';
    if (card.querySelector('.link-card-content')) return 'fa-link';
    if (card.querySelector('.repo-card, .gh-repo')) return 'fa-code-branch';
    return 'fa-file';
  }

  function metaFor(card) {
    var d = card.querySelector('.card-desc');
    var st = card.querySelector('.card-stats');
    var tag = card.querySelector('.type-badge');
    var parts = [];
    if (d && d.textContent.trim()) parts.push(d.textContent.trim());
    if (st && st.textContent.trim() && !/同步中/.test(st.textContent)) parts.push(st.textContent.trim());
    if (!parts.length && tag) parts.push(tag.textContent.trim());
    return parts.join(' · ').slice(0, 60);
  }

  function titleOf(card) {
    var t = card.querySelector('.card-title');
    if (!t) return '未命名';
    var badge = t.querySelector('.type-badge');
    var badgeText = badge ? (badge.textContent || '').trim() : '';
    var full = (t.textContent || '').trim();
    var without = badge ? full.replace(badgeText, '').trim() : full;
    /* 外链卡的标题**就是**那个 type-badge（例：「cloudflare网站外链」），
       去掉之后什么都不剩，会整列显示「未命名」（截图确认过）。
       所以：只有「去掉徽章后还有正文」时才用正文，否则退回徽章文字。
       外链卡再顺手把尾缀「网站外链」去掉，标题更干净。 */
    var s = without || badgeText;
    s = s.replace(/网站外链$/, '').trim();
    s = s.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim();
    return s || '未命名';
  }

  /* ---------- 一级页：入口卡 ---------- */
  function buildEntries() {
    /* 挂在 .archive-container 下、.archive-sections 之前。
       不能挂进 .archive-sections —— 它只包着前 4 个区块，
       入口卡会被一起算进「要隐藏的区块」里。 */
    var host = document.querySelector('.archive-container');
    if (!host) return;
    if (document.querySelector('.arc-entry-row')) return;
    var groups = sectionsOf();
    var row = document.createElement('div');
    row.className = 'arc-entry-row';
    document.documentElement.classList.add('arc-app');

    AREAS.forEach(function (a) {
      var secs = groups[a.key] || [];
      if (!secs.length) return;
      var n = 0;
      secs.forEach(function (s) { n += s.querySelectorAll('.media-card').length; });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'arc-entry';
      b.innerHTML =
        '<span class="arc-entry-ic"><i class="fas ' + a.icon + '"></i></span>' +
        '<span class="arc-entry-tx"><b>' + a.title + '</b><small>' +
        (n ? (n + ' 项 · ' + a.desc) : a.desc) + '</small></span>' +
        '<i class="fas fa-chevron-right arc-entry-go"></i>';
      b.addEventListener('click', function () { openArea(a, secs); });
      row.appendChild(b);
    });
    /* 插在「归档」页头之后：用 firstChild 会跑到大标题**上面**（截图确认过，
       一进页面先看到一排按钮）；用 insertBefore(row, .archive-sections) 也不行 ——
       .archive-sections 前面还夹着页头，实测顺序仍是 入口 -> 页头。
       锚点取 .archive-header 的下一个兄弟，才是真正的「标题下面」。 */
    var hdr = host.querySelector('.archive-header');
    if (hdr && hdr.parentNode === host) host.insertBefore(row, hdr.nextSibling);
    else {
      var sections = host.querySelector('.archive-sections');
      if (sections && sections.parentNode === host) host.insertBefore(row, sections);
      else host.appendChild(row);
    }
  }

  /* ---------- 二级页：一个区块的卡片列表 ---------- */
  function openArea(a, secs) {
    if (!narrow() || !window.AppShell || !window.AppShell.openDetail) return;
    if (depth() >= 3) return;

    var wrap = document.createElement('div');
    wrap.className = 'arc-page';
    var list = document.createElement('div');
    list.className = 'arc-list';
    wrap.appendChild(list);

    /* 收集这个入口下的全部卡片，标题按所属区块分节 */
    var entries = [];
    secs.forEach(function (sec) {
      var st = sec.querySelector('.section-title');
      var label = st ? (st.textContent || '').replace(/\s+/g, ' ').trim() : '';
      var cards = sec.querySelectorAll('.media-card');
      if (cards.length) {
        entries.push({ sep: label });
        Array.prototype.forEach.call(cards, function (c) { entries.push({ card: c }); });
      } else {
        /* 没有 .media-card 的小工具区：整块搬进来 */
        entries.push({ block: sec });
      }
    });

    window.AppShell.openDetail({ title: a.title, content: wrap });

    entries.forEach(function (e) {
      if (e.sep) {
        var h = document.createElement('div');
        h.className = 'arc-sep';
        h.textContent = e.sep;
        list.appendChild(h);
        return;
      }
      if (e.block) {
        var box = document.createElement('div');
        box.className = 'arc-block';
        list.appendChild(box);
        window.AppShell.adopt(e.block, box);
        return;
      }
      /* 卡片：一级页里放一行紧凑列表，点它才进三级看详情。
         卡片本体留在一级页树里，进三级时才搬。 */
      list.appendChild(rowFor(e.card, titleOf(e.card)));
    });
  }

  function openCard(card) {
    if (!narrow()) return;
    if (!window.AppShell || !window.AppShell.openDetail) return;
    /* 三级页：从二级列表点进来时层栈已有 1 层，这里不能再被
       「已经开着层就 return」挡掉（那会让二级页里的卡片完全点不动）。 */
    if (depth() >= 3) return;

    var info = card.querySelector('.card-info');
    var video = card.querySelector('.video-wrapper');

    var wrap = document.createElement('div');
    wrap.className = 'mc-detail-wrap';
    var mediaBox = document.createElement('div');
    mediaBox.className = 'mcd-media';
    var infoBox = document.createElement('div');
    infoBox.className = 'mcd-info';
    wrap.appendChild(mediaBox);
    wrap.appendChild(infoBox);
    if (info) infoBox.innerHTML = info.innerHTML;

    var titleEl = info ? info.querySelector('.card-title') : null;
    var title = (titleEl ? titleEl.textContent : '').replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '').trim() || '详情';

    window.AppShell.openDetail({ title: title, content: wrap });

    if (video) {
      window.AppShell.adopt(video, mediaBox);
      var frame = video.querySelector('iframe');
      var src = frame ? frame.getAttribute('src') || '' : '';
      var bv = /bvid=([A-Za-z0-9]+)/.exec(src);
      appendBiliLink(infoBox, bv ? 'https://www.bilibili.com/video/' + bv[1] : '');
    } else if (mediaBox.parentNode) {
      mediaBox.parentNode.removeChild(mediaBox);   /* 纯信息卡没有媒体区 */
    }
  }

  function init() {
    if (!narrow()) return;
    /* 入口卡先建：它不依赖 .media-card 是否已就绪，不过 scan() 会给
       卡片补「详情」按钮（二级列表里已经不用那个按钮了，保留无害，
       桌面端与回退路径还要它）。 */
    buildEntries();
    scan();

    /* GitHub 仓库卡片异步插入，300ms 去抖后再补按钮 */
    var timer = null;
    function schedule() {
      if (timer) return;
      timer = setTimeout(function () { timer = null; scan(); }, 300);
    }
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (!t.closest('.mc-detail')) return;
      var card = t.closest('.media-card');
      if (card) openCard(card);
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
