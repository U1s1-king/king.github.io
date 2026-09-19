/* ============================================================
 * 影视页 (js/tv.js)
 * ------------------------------------------------------------
 * 为什么必须走代理：实测 12 个公开苹果 CMS 采集接口，**只要请求带 Origin，
 * 响应里就没有 Access-Control-Allow-Origin**（不带 Origin 反而给 *）——
 * 也就是说浏览器直连一定被 CORS 拦死，页面只会是空的。视频流同理
 * （hls.js 用 XHR 取 m3u8/分片，一样要 CORS）。
 * 所以列表/详情/搜索走 /api/tv，m3u8 与分片走 /api/tv/stream，
 * 由 cloudflare/music-api/_worker.js 转发（服务端请求不带 Origin，上游照常给数据）。
 * 部署：把 _worker.js 重新发布一次即可。
 *
 * 生产环境走【同源】门卫：Cloudflare Worker tv-gate 挂在
 * zhaokening.ccwu.cc/api/tv* 上，验完 cookie 再转发给 pages.dev。
 * 所以 TV.html 会先把 window.TV_GATEWAY 设成 location.origin；
 * 这里的默认值只留给本地联调（localhost 不走门卫，CORS 白名单里有 8899）。
 * ============================================================ */
(function () {
  'use strict';

  /* 生产走同源门卫；window.TV_GATEWAY 留给本地联调覆盖 */
  var GATEWAY = (window.TV_GATEWAY || 'https://sakura-music-api.pages.dev').replace(/\/$/, '');
  /* 门卫回 401 时拿它做标记：不重试、不降级直连，直接回登录页 */
  var NEED_GATE = 'NEED_GATE';

  /* 门卫会话过期时的统一提示：说清原因 + 给一个【用户自己点】的重新登录链接。
     绝不在这里 location.replace —— 用户没要求刷新，页面就不该自己刷新。
     用相对路径 'TV.html'：站点可能部署在子路径下，绝对根路径会 404
     （仓库有 CNAME，但 server.js 也支持任意 ROOT）。 */
  function gateExpired() {
    var note = byId('tvNote');
    if (note) {
      note.textContent = '登录状态已过期，需要重新登录：';
      var a = document.createElement('a');
      a.href = 'TV.html';
      a.textContent = '点这里重新登录 ›';
      note.appendChild(a);
    }
    loadingFail('登录状态已过期（点上方的「重新登录」）');
    /* 二级页/播放器开着的时候，列表后面的提示看不见，播放器里也喊一句 */
    if (window.TVPlayer && typeof TVPlayer.showErr === 'function') {
      try { TVPlayer.showErr('登录状态已过期，请重新登录后继续。'); } catch (e) {}
    }
  }
  /* 采集站常见成人向栏目，站点是公开页面，直接不展示 */
  var BLOCK = /伦理|福利|里番|情色|成人|无码|色情|自拍|偷拍|人妖|淫/;
  /* 可以直接塞进 <video> 的直链后缀 */
  var MEDIA_EXT = ['.mp4', '.m4v', '.mkv', '.flv', '.avi', '.mov', '.webm', '.mp3', '.m4a'];

  /* src：分类列表来自哪号源。各站 type_id 编号不同，翻页/点分类必须带上它 */
  var state = { t: '', pg: 1, kw: '', src: null, pick: false, hits: [] };
  /* 聚合模式（无关键词、且用户没手动指定片源）不能翻页，只能「加载更多」。
     原因在网关：聚合时它把各采集源的第 N 页并起来去重，total 是「本页条数 ×
     最深那个源的页数」估出来的（_worker.js 的 tvAggregate），实测首页 total=74000
     而每页只有 37~56 条 → 前端算出 2000 页，点第 2 页拿到的还是各源自己的第 2 页，
     和首页不连续、按名去重后大片重复。所以这一模式改用追加：
     每次请求仍然发 pg（网关按源翻页），把结果接在现有网格后面。
     搜索和选中单一源时数据是连续的真分页，照旧用上一页/下一页。 */
  function isAggMode() { return !state.kw && !state.pick; }
  /* 追加模式下的页码游标：只在「加载更多」里递增 */
  var more = { busy: false, html: '' };
  /* 每次请求发一个序号：后发的永远赢。慢响应回来只作废、不覆盖页面 */
  var reqSeq = 0;
  /* 「片源」那排的源清单（由网关下发），以及这次每个源的耗时 */
  var SRCS = [];
  /* 当前打开的这部片在各源的候选（含正在看的那个）。换源那排按钮用它，
     切换时沿用同一份集合，所以切完还能继续切回来。 */
  var ALT_LIST = [];
  /* 扁平化的选集列表，给播放器的上一集/下一集/自动连播用 */
  var EP = { list: [], i: -1 };
  var LINE_NAMES = { liangzi: '量子线路', lzm3u8: '量子 M3U8', lz: '量子' };

  function byId(id) { return document.getElementById(id); }
  /* 页面自带的那句提示，搜索结果显示时临时换掉，换回来用 */
  var NOTE0 = '';
  /* 页面 load 之后统一把海报 src 补上 */
  function flushImgs() {
    window.__tvLoaded = 1;
    Array.prototype.forEach.call(document.querySelectorAll('#tvGrid img[data-src]'), function (im) {
      im.src = im.getAttribute('data-src');
      im.removeAttribute('data-src');
    });
  }
  if (document.readyState === 'complete') window.__tvLoaded = 1;
  else window.addEventListener('load', flushImgs);
  function setText(id, s) { var el = byId(id); if (el) el.textContent = s; }
  function say(html) { var g = byId('tvGrid'); if (g) g.innerHTML = '<p class="tv-tip">' + html + '</p>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- 加载中 / 加载失败（别让用户对着空屏或者一直转） ----------------
     骨架屏而不是一行「已等 N 秒」：空的灰块能立刻告诉用户「内容是这个形状、正在来」，
     比一句转圈提示稳得多（转圈看两秒就开始怀疑是不是卡死了）。
     秒表仍然保留，但降级成角落一行小字：等太久时它才是有用的信息。 */
  var loadTimers = [];
  var loadTick = 0;
  /* 上一次列表结果：翻页/追加要往它后面接，不能每次清空 */
  var gridHtml = '';
  function clearLoad() {
    loadTimers.forEach(clearTimeout);
    loadTimers = [];
    if (loadTick) { clearInterval(loadTick); loadTick = 0; }
  }

  function skeleton(n) {
    var out = '';
    for (var i = 0; i < (n || 12); i++) {
      out += '<span class="tv-sk"><span class="tv-sk-poster"></span><span class="tv-sk-line"></span></span>';
    }
    return out;
  }

  function loadingStart(what, append) {
    clearLoad();
    var g = byId('tvGrid');
    if (!g) return;
    if (append) {
      /* 追加模式：底部插一个「正在加载更多」的小条，已有的卡片一张都不动 */
      var more = byId('tvMore');
      if (!more) {
        more = document.createElement('div');
        more.id = 'tvMore';
        more.className = 'tv-more';
        g.parentNode.insertBefore(more, g.nextSibling);
      }
      more.innerHTML = '<span class="tv-spin"></span><span id="tvLoadMsg">' + esc(what) + '</span>' +
        '<span class="tv-more-sec" id="tvLoadSec"></span>';
    } else {
      var moreOld = byId('tvMore');
      if (moreOld && moreOld.parentNode) moreOld.parentNode.removeChild(moreOld);
      g.innerHTML = '<div class="tv-sk-grid">' + skeleton(12) + '</div>' +
        '<p class="tv-loading-hint tv-sk-hint"><span id="tvLoadMsg">' + esc(what) +
        '</span> <span id="tvLoadSec"></span></p>';
    }
    var msg = function (s) { var m = byId('tvLoadMsg'); if (m) m.textContent = s; };
    var t0 = Date.now();
    /* 秒表：让用户看得见在等多久，也提醒上限是一分钟 */
    loadTick = setInterval(function () {
      var s = byId('tvLoadSec');
      if (!s) return;
      var n = Math.floor((Date.now() - t0) / 1000);
      s.textContent = n >= 3 ? ('已等 ' + n + ' 秒' + (n >= 50 ? '（快到一分钟上限）' : '')) : '';
    }, 1000);
    /* 提示语只在真的慢下来之后才换，别一上来就吓用户 */
    loadTimers.push(setTimeout(function () { msg('正在逐个片源抓数据，先到的先出…'); }, 2500));
    loadTimers.push(setTimeout(function () { msg('有片源回得慢，还在等它这一页…'); }, 8000));
    loadTimers.push(setTimeout(function () { msg('还没回来。特别慢的话，点上面「片源」换一个快的。'); }, 20000));
    loadTimers.push(setTimeout(function () { msg('等了半分钟了，这个源大概率不灵 —— 建议点「片源」换一个。'); }, 35000));
  }

  function loadingFail(msg) {
    clearLoad();
    var g = byId('tvGrid');
    if (!g) return;
    /* 出错了就别再摆着「上一页 / 1 / 1 / 下一页」——
       页面明明什么都没拿到，分页器却还在，看着像加载完了只是内容空。
       这里和 render() 的无结果分支保持一致。 */
    var pager = byId('tvPager');
    if (pager) pager.hidden = true;
    g.innerHTML = '<div class="tv-loading is-fail"><i class="fas fa-circle-exclamation"></i><p>' + esc(msg) +
      '</p><button type="button" class="tv-retry" id="tvRetry"><i class="fas fa-rotate-right"></i> 重试一次</button>' +
      '<p class="tv-loading-hint">还是不行就点上面「片源」换一个源，或者过会儿再来</p></div>';
    var b = byId('tvRetry');
    if (b) b.addEventListener('click', function () { load(state.pg); });
  }

  /* ---------------- 片源切换 ---------------- */
  /* 片源/分类接口也回 sources，但它们的 id 是按 TV_OFF 过滤后重排的下标，
     顺序由网关定死（见 _worker.js 的 tvSourceList）。这里只做一次形状校验，
     坏数据直接忽略，免得把本地好的 SRCS 覆盖成空的。 */
  function renderSrcs(sources, stats) {
    if (sources && sources.length && typeof sources[0].id === 'number') SRCS = sources;
    var bar = byId('tvSrcs');
    if (!bar || !SRCS.length) return;
    var ms = {};
    (stats || []).forEach(function (s) { ms[s.i] = s.ms; });
    bar.innerHTML = '';
    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'hub-chip' + (state.pick ? '' : ' is-on');
    all.innerHTML = '<i class="fas fa-layer-group"></i><span>聚合（全部源）</span>';
    all.addEventListener('click', function () { pickSrc(null); });
    bar.appendChild(all);
    SRCS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hub-chip' + (state.pick && state.src === s.id ? ' is-on' : '');
      b.title = s.name + (s.search ? '（支持搜索）' : '（不支持搜索，只能翻列表）');
      b.innerHTML = '<i class="fas fa-tower-broadcast"></i><span></span>';
      var nm = s.name;
      if (ms[s.id]) {
        nm += ' ' + (ms[s.id] / 1000).toFixed(1) + 's';
        if (ms[s.id] > 5000) b.classList.add('is-slow');
      }
      b.querySelector('span').textContent = nm;
      b.addEventListener('click', function () { pickSrc(s.id); });
      bar.appendChild(b);
    });
  }

  function pickSrc(id) {
    state.pick = typeof id === 'number';
    state.src = state.pick ? id : null;
    /* 清掉关键词：用户点「片源」是想看这个源的片单，不是在这个源里再搜一次。
       留着关键词会让下次 load 走进搜索分支，选源看起来「没反应」。 */
    state.kw = '';
    var kwEl = byId('tvKw'); if (kwEl) kwEl.value = '';
    renderSrcs(SRCS, []);
    hideHist();
    savePref();
    /* 换源 = 换一批片，正在看的那部不再适用，视图里把它清掉 */
    saveView({ vod: null, vodSrc: null });
    /* 分类现在是固定档（电影/动漫/体育…），跨源通用，换源不用清掉重选；
       网关会按新源把这一档翻译成它自己的 type_id */
    load(1);
  }

  /* 结果提示里要带链接，用 DOM 拼，避免把第三方字符串当 HTML 插 */
  function noteWithLink(msg, url) {
    var note = byId('tvNote');
    if (!note) return;
    note.textContent = msg + ' ';
    if (!url) return;
    var a = document.createElement('a');
    a.href = url; a.target = '_blank'; a.rel = 'noopener nofollow';
    a.textContent = '在新标签页打开 ›';
    note.appendChild(a);
  }

  function isPage(u) { return String(u).indexOf('/share/') >= 0; }
  function isM3u8(u) { return String(u).toLowerCase().indexOf('.m3u8') >= 0; }
  function isMedia(u) {
    var p = String(u).split('?')[0].toLowerCase();
    for (var i = 0; i < MEDIA_EXT.length; i++) { if (p.slice(-MEDIA_EXT[i].length) === MEDIA_EXT[i]) return true; }
    return false;
  }

  function parseJson(t) {
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    t = t.trim();
    try { return JSON.parse(t); } catch (e) { /* 下面再兜一次 */ }
    var s = t.indexOf('{'), e2 = t.lastIndexOf('}');
    if (s >= 0 && e2 > s) { try { return JSON.parse(t.slice(s, e2 + 1)); } catch (e3) {} }
    throw new Error('片源返回的不是合法 JSON');
  }

  /* 一次请求最慢等一分钟（含重试的总预算，不是每次一分钟）。
     CF 边缘偶尔会把响应传到一半卡住，所以必须有上限；但也不能短，有的源本来就慢。 */
  var WAIT_MAX = 60000;
  function timeoutOpt(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return { signal: AbortSignal.timeout(ms) };
    } catch (e) {}
    return {};
  }

  function jget(url, ms) {
    /* credentials 必须是 same-origin：生产环境下 GATEWAY 是同源的，
       门卫靠 HttpOnly cookie 认人 —— 原来写的 'omit' 会把 cookie 丢掉，一律 401。
       本地联调时 GATEWAY 指向 pages.dev（跨域），same-origin 不会带凭据，正好。 */
    return fetch(url, Object.assign({ mode: 'cors', credentials: 'same-origin' }, timeoutOpt(ms || WAIT_MAX))).then(function (r) {
      if (r.status === 401) {
        /* 会话过期（关过浏览器）或门卫不认这个 cookie。
           ⚠ 这里【只报错，绝不自动刷新】。
           以前是 location.replace('TV.html') 回本页重新登录，实测非常反人类：
           用户只是点了个海报，页面就自己刷了 —— 既像 bug，又把当前的
           搜索/列表/滚动位置全冲掉（加了节流也只是从「刷很多次」变成「刷一次」，
           本质没变）。现在交给下面的 catch 显示一句「登录状态已过期」，
           再给一个用户自己点的「重新登录」链接，要不要跳由用户决定。 */
        throw new Error(NEED_GATE);
      }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(parseJson);
  }

  function qs(params) {
    var q = [];
    for (var k in params) { if (params[k] !== '' && params[k] !== undefined && params[k] !== null) q.push(k + '=' + encodeURIComponent(params[k])); }
    return q.join('&');
  }

  /* 列表/详情：优先自建 Worker 代理（有 CORS），失败再试直连（几乎必被拦，留个念想） */
  var DIRECT = 'https://cj.lziapi.com/api.php/provide/vod/';
  var TOO_LONG = '等了超过一分钟还没回来';
  function leftMs(deadline) { return deadline - Date.now(); }

  /* 重试共用同一个 deadline：不管重试几次，总共就等一分钟。
     次数也封顶 —— 否则网络一断就会 700ms 一次空转满一分钟，白等 */
  function apiTry(url, deadline, n) {
    var left = leftMs(deadline);
    if (left < 2500) return Promise.reject(new Error(TOO_LONG));
    return jget(url, left).catch(function (e) {
      if (e && e.message === NEED_GATE) throw e; /* 门卫要口令，重试没意义 */
      if (n <= 1) throw (leftMs(deadline) < 2500 ? new Error(TOO_LONG) : e);
      if (leftMs(deadline) < 2500) throw new Error(TOO_LONG);
      return new Promise(function (r) { setTimeout(r, 700); }).then(function () { return apiTry(url, deadline, n - 1); });
    });
  }

  function apiGet(params) {
    var q = qs(params);
    var deadline = Date.now() + WAIT_MAX;
    return apiTry(GATEWAY + '/api/tv?' + q, deadline, 3).catch(function (e1) {
      if (e1 && e1.message === NEED_GATE) throw e1; /* 也别降级去直连上游 */
      var rest = leftMs(deadline);
      if (rest < 3000) throw new Error(TOO_LONG + '（' + e1.message + '）');
      return jget(DIRECT + '?' + q, rest).catch(function () {
        throw new Error('代理不可用（' + e1.message + '）');
      });
    });
  }

  /* 门卫的会话有 2 小时时间上限（服务端用这道上限兜住「浏览器恢复会话」——
     Chrome 开「继续浏览上次打开的网页」时会把 session cookie 一起恢复，
     关掉浏览器也照样免密，服务端分辨不出来，只能靠时间兜）。
     页面开着就每 20 分钟续一次，看长片不会被中途踢掉；
     页面一关心跳就停，2 小时后必须重新输口令 —— 这就是
     「关掉浏览器就要重新验证」想要的效果，而且不依赖 cookie 本身。 */
  (function keepAlive() {
    if (GATEWAY !== location.origin) return; /* 本地联调直连 pages.dev，不走门卫 */
    function ping() {
      fetch(GATEWAY + '/api/tv/keepalive', { credentials: 'same-origin', cache: 'no-store' })
        .catch(function () { /* 网络抖一下就跳过这次，还有下一次 */ });
    }
    setTimeout(ping, 60 * 1000);
    setInterval(ping, 20 * 60 * 1000);
  })();

  /* 视频流一律走代理：上游对带 Origin 的请求不给 CORS，分段也一样 */
  function streamUrl(u) { return GATEWAY + '/api/tv/stream?u=' + encodeURIComponent(u); }
  /* 海报同样经代理：图床热链保护会让直连的 <img> 拿不到图 */
  function picUrl(u) {
    var s = String(u || '');
    if (!s || s.indexOf('http') !== 0) return s;
    return GATEWAY + '/api/tv/img?u=' + encodeURIComponent(s);
  }

  /* ---------------- 分类 ---------------- */
  /* 固定档的图标（网关只会回这几个名字，对不上就用文件夹图标兜底） */
  var CAT_ICON = {
    '电影': 'fa-film', '电视剧': 'fa-tv', '动漫': 'fa-dragon', '综艺': 'fa-star',
    '纪录片': 'fa-book', '短剧': 'fa-bolt', '体育': 'fa-futbol', '预告片': 'fa-clapperboard',
  };

  function loadCats() {
    return apiGet({ ac: 'list' }).then(function (d) {
      var bar = byId('tvCats');
      if (!bar) return;
      if (d && typeof d._src === 'number' && !state.pick) state.src = d._src;
      if (d && d.sources) renderSrcs(d.sources, null);
      var list = (d && d['class']) || [];
      bar.innerHTML = '';
      var all = document.createElement('button');
      all.type = 'button';
      all.className = 'hub-chip is-on';
      all.innerHTML = '<i class="fas fa-border-all"></i><span>全部</span>';
      all.addEventListener('click', function () { pickCat('', 1); });
      bar.appendChild(all);
      list.forEach(function (c) {
        var name = String(c.type_name || '');
        if (!name || BLOCK.test(name)) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'hub-chip';
        b.setAttribute('data-t', c.type_id);
        b.innerHTML = '<i class="fas ' + (CAT_ICON[name] || 'fa-folder') + '"></i><span></span>';
        b.querySelector('span').textContent = name;
        b.addEventListener('click', function () { pickCat(c.type_id, 1); });
        bar.appendChild(b);
      });
      /* 分类是异步来的，记忆的偏好要等这一排画完才点得亮 */
      markCat();
    }).catch(function (e) {
      /* 门卫过期时分类也是 401 —— 直接给「重新登录」，别让用户对着
         一个「点这重试」白按（重试还是会 401） */
      if (String(e.message || e) === NEED_GATE) { gateExpired(); return; }
      /* 只放一枚重试胶囊，不再把原因写在这里 ——
         片源和分类是一起挂的（同一个接口），下面那张失败卡已经把
         「没找到片源：…」说清楚了。两处各喊一次同样的话只是噪音，
         而且分类条上那行字还会把筛选区撑高一截。 */
      var bar = byId('tvCats');
      if (!bar) return;
      bar.innerHTML = '';
      var again = document.createElement('button');
      again.type = 'button';
      again.className = 'hub-chip';
      again.innerHTML = '<i class="fas fa-rotate-right"></i><span>分类没加载出来，点这重试</span>';
      again.addEventListener('click', function () { loadCats(); });
      bar.appendChild(again);
    });
  }

  function pickCat(t, pg) {
    var bar = byId('tvCats');
    if (bar) {
      Array.prototype.forEach.call(bar.querySelectorAll('.hub-chip'), function (x) {
        x.classList.toggle('is-on', String(x.getAttribute('data-t') || '') === String(t || ''));
      });
    }
    state.t = t;
    /* 换分类等于换一个问题，把搜索词清掉（否则会带着旧关键词去筛分类） */
    state.kw = '';
    var kwEl = byId('tvKw'); if (kwEl) kwEl.value = '';
    hideHist();
    savePref();
    /* 换分类同样是换一批片，清掉正在看的那部 */
    saveView({ vod: null, vodSrc: null });
    load(pg);
  }

  /* 按记忆下来的偏好把对应分类胶囊点亮（分类是异步加载的，
     所以要在 loadCats 渲染完之后再调） */
  function markCat() {
    var bar = byId('tvCats');
    if (!bar) return;
    Array.prototype.forEach.call(bar.querySelectorAll('.hub-chip'), function (x) {
      x.classList.toggle('is-on', String(x.getAttribute('data-t') || '') === String(state.t || ''));
    });
  }

  /* ---------------- 列表 ---------------- */
  function card(it) {
    var a = document.createElement('a');
    a.className = 'tv-card';
    a.href = 'javascript:void(0)';
    /* 追加模式靠这个键去重（源+id），也方便「续播角标」回查进度 */
    a.setAttribute('data-k', String(it._src == null ? '' : it._src) + '|' + String(it.vod_id || ''));
    var pic = String(it.vod_pic || '');
    a.innerHTML = '<span class="tv-poster">' + (pic ? '<img loading="lazy" referrerpolicy="no-referrer" alt="">' : '') +
      '<span class="tv-badge"></span></span><span class="tv-name"></span>';
    if (pic) {
      var img = a.querySelector('img');
      /* 图床经代理偶尔拉不动：降级成站点色占位，不留破图 */
      img.addEventListener('error', function () {
        var box = a.querySelector('.tv-poster');
        if (box) box.classList.add('is-empty');
        if (img.parentNode) img.parentNode.removeChild(img);
      });
      /* 海报延到页面 load 之后再拉：TV 页首屏几十张图会把 load 拖到十几秒，
         而看板娘(Live2D)是等 load 才初始化的，模型纹理就被挤在后面、一半一半地长。
         页面已经 load 完了就直接赋 src，不影响后面的翻页/搜索。 */
      if (window.__tvLoaded) { img.src = picUrl(pic); } else { img.setAttribute('data-src', picUrl(pic)); }
    }
    var badge = a.querySelector('.tv-badge');
    var remark = String(it.vod_remarks || '');
    if (remark) badge.textContent = remark; else badge.remove();
    a.querySelector('.tv-name').textContent = it.vod_name || '未命名';
    a.addEventListener('click', function () { detail(it.vod_id, it._src, a, it._alts); });
    return a;
  }

  /* 往网格里塞卡片，并统一压片名。append=true 时不先清空。 */
  function fillGrid(list, append) {
    var grid = byId('tvGrid');
    if (!grid) return;
    if (!append) grid.innerHTML = '';
    var before = grid.children.length;
    list.forEach(function (it) { grid.appendChild(card(it)); });
    /* 片名统一压到两行：卡片高度是定死的，等进了文档再按 scrollHeight 逐字减，
       比按字数猜准（中英文宽度不一样，CSS 的 line-clamp 实测还会漏出第三行半个字）。
       只处理这次新增的那批（append 时前面的早就压好了）。 */
    var names = grid.querySelectorAll('.tv-name');
    for (var i = before; i < names.length; i++) {
      var n = names[i];
      var s = n.textContent;
      var guard = 0;
      while (n.scrollHeight > n.clientHeight + 1 && s.length > 2 && guard++ < 60) {
        s = s.slice(0, -1);
        n.textContent = s + '…';
      }
    }
  }

  function render(d, append, agg) {
    var grid = byId('tvGrid');
    if (!grid) return;
    var list = (d && d.list) || [];
    var pager = byId('tvPager');
    var moreBox = byId('tvMore');
    if (moreBox && moreBox.parentNode) moreBox.parentNode.removeChild(moreBox);

    if (!list.length) {
      if (append) { flashNote('这个源这一页没有更多了'); }
      else { say('没有找到资源，换个关键词试试'); }
      if (pager) pager.hidden = true;
      if (append) renderMoreBtn(false);
      return;
    }
    /* 追加模式去重：各源翻页会反复吐同一批新片，按 源+id 去重（片名去重不够，
       不同源可能有同名片）。不重复的才算进这次新增。 */
    if (append) {
      var have = {};
      Array.prototype.forEach.call(grid.querySelectorAll('.tv-card'), function (c) {
        var k = c.getAttribute('data-k'); if (k) have[k] = 1;
      });
      list = list.filter(function (it) {
        var k = String(it._src == null ? '' : it._src) + '|' + String(it.vod_id || '');
        if (have[k]) return false;
        have[k] = 1;
        return true;
      });
      if (!list.length) {
        /* 这一页全是老面孔：自动再往后翻一页，别让用户点了个「加载更多」却什么都没发生 */
        if (state.pg - 1 < 12) { load(state.pg, true, true); return; }
        flashNote('没有更多了');
        renderMoreBtn(false);
        return;
      }
    }
    fillGrid(list, append);

    var total = parseInt(d.total, 10) || 0;
    var limit = parseInt(d.limit, 10) || list.length || 1;
    if (append) {
      /* 追加模式没有可信的 total，用「还能不能再翻」判断：
         网关每页固定取 6 轮 × 源数，只要这页条数接近满员就认为后面还有。
         页码游标已经由 load() 推进，这里只负责把按钮画出来。 */
      setText('tvPage', '已加载 ' + grid.children.length + ' 部');
      if (pager) pager.hidden = false;
      renderMoreBtn(true);
      return;
    }
    /* 网关明确标了 _agg（聚合批）就一律按「加载更多」渲染，不看 total；
       本地判定 agg 也算（网关还没重新部署时 _agg 不存在，
       但聚合模式的 total 一样不可信）。两条合起来保证任何一侧生效都不出假分页。 */
    if (agg || (d && d._agg)) {
      setText('tvPage', '已加载 ' + grid.children.length + ' 部');
      if (pager) pager.hidden = false;
      renderMoreBtn(true);
      return;
    }
    var pages = Math.max(1, Math.ceil(total / limit));
    /* 单源模式 total 是真的；但如果算出离谱的页数（网关估错），别把用户送到空白页 */
    if (pages > 500) pages = 500;
    setText('tvPage', state.pg + ' / ' + pages);
    if (pager) pager.hidden = pages <= 1;
  }

  /* 聚合模式下把「上一页/下一页」换成一颗「加载更多」 */
  function renderMoreBtn(on) {
    var pager = byId('tvPager');
    if (!pager) return;
    var prev = byId('tvPrev'), next = byId('tvNext');
    if (prev) prev.hidden = true;
    if (next) next.hidden = true;
    var box = byId('tvMoreBtn');
    if (!on) { if (box && box.parentNode) box.parentNode.removeChild(box); pager.hidden = true; return; }
    if (!box) {
      box = document.createElement('button');
      box.type = 'button';
      box.id = 'tvMoreBtn';
      box.className = 'tv-ep tv-more-btn';
      box.textContent = '加载更多';
      box.addEventListener('click', function () { load(state.pg + 1, true); });
      pager.appendChild(box);
    }
    pager.hidden = false;
  }
  function restorePager() {
    var box = byId('tvMoreBtn');
    if (box && box.parentNode) box.parentNode.removeChild(box);
    var prev = byId('tvPrev'), next = byId('tvNext');
    if (prev) prev.hidden = false;
    if (next) next.hidden = false;
  }

  /* 一句短提示（复用列表下方那行），2.4 秒后自动还原 */
  var flashT = 0;
  function flashNote(msg) {
    var note = byId('tvNote');
    if (!note) return;
    note.textContent = msg;
    clearTimeout(flashT);
    flashT = setTimeout(function () {
      if (note.textContent === msg) note.textContent = state.kw ? note.textContent : NOTE0;
    }, 2400);
  }

  /* 为什么不是「有请求在跑就直接 return」：首屏那次聚合要等三四秒，用户经常刚进页面
     就敲关键词搜索，旧写法会把这次搜索**静默丢掉**，页面上留的还是上一轮结果
     （表现就是「我搜蜘蛛侠，出来的是别的片」，海报/片名全对不上）。
     现在改成序号：新请求一律发出，旧的响应回来发现序号过期就整份作废。 */
  function load(pg, append, auto) {
    var my = ++reqSeq;
    state.pg = pg || 1;
    var t0 = Date.now();
    var single = state.pick && typeof state.src === 'number' ? SRCS.filter(function (s) { return s.id === state.src; }) : [];
    var agg = isAggMode();
    /* 聚合模式永远走「加载更多」；单源/搜索走真分页，把分页器还回来 */
    if (!agg) restorePager();
    if (!append) loadingStart(
      state.kw ? ('正在搜「' + state.kw + '」…') : single.length ? ('正在请求「' + single[0].name + '」…') : '正在找片…',
      false,
    );
    else if (!auto) loadingStart('正在加载更多…', true);
    /* ⚠ _src 必须照发：它是「这条记录来自哪个采集源」的唯一定位信息。
       曾经想过搜索时不带 _src（以为能让网关多打源），结果详情请求的 ids 会打到
       别的源上 —— vod_id 只在单个源内唯一，跨源同号是另一部片，表现就是
       「有些片源点进去拿不到视频」。列表里的 _src 和详情请求的 _src 必须一致。 */
    var q = { ac: 'videolist', t: state.t, pg: state.pg, wd: state.kw, pick: state.pick ? 1 : '' };
    q._src = state.src;
    apiGet(q)
      .then(function (d) {
        /* 动画最少露 500ms：太快反而像闪一下，看不清发生了什么 */
        var wait = append ? 0 : Math.max(0, 500 - (Date.now() - t0));
        return new Promise(function (r) { setTimeout(r, wait); }).then(function () {
          if (my !== reqSeq) return; /* 期间用户又搜了/翻页了/点进详情了，这份结果作废 */
          clearLoad();
          if (d && typeof d._src === 'number' && !state.pick) state.src = d._src;
          if (d && d.sources) renderSrcs(d.sources, d._stats);
          /* 把这次命中的整批结果带着走：二级页侧栏要拿它做横跳。
             按分类浏览（没有关键词）时清空，那块也就不会出现。 */
          state.hits = state.kw ? ((d && d.list) || []) : [];
          render(d, append, agg);
          markResume();
          /* 搜索结果页头写明「搜的是什么、拿到多少条」，用户一眼能核对对不对得上 */
          if (state.kw) {
            noteWithLink(
              '搜索「' + state.kw + '」：' + ((d && d.list) || []).length + ' 条' +
                (d && d._srcs ? '，来自 ' + d._srcs + ' 个片源' : ''),
              '',
            );
          } else if (NOTE0) {
            noteWithLink(NOTE0, '');
          }
        });
      })
      .catch(function (e) {
        if (my !== reqSeq) return; /* 旧请求的报错别糊在新结果上 */
        var pager = byId('tvPager'); if (pager) pager.hidden = true;
        var m = String(e.message || e);
        /* 门卫过期：单独给一句人话 + 重新登录链接，别混进「源站出错」里 */
        if (m === NEED_GATE) { gateExpired(); return; }
        var why = /一分钟|timeout|abort/i.test(m)
          ? '这个源太慢了或者没响应'
          : /^HTTP 5/.test(m)
            ? '源站这会儿出错了'
            : /failed|fetch|network|load/i.test(m)
              ? '连不上片源（网络或代理不通）'
              : '没找到片源';
        /* 追加失败别把已经看到的列表清掉：只在底部提示一句，保留现场 */
        if (append) { flashNote('加载更多失败：' + m); return; }
        loadingFail(why + '：' + m);
      });
  }

  /* 给已经在看的片子标一个续播角标：进列表一眼能看出哪几部看过、看到哪。
     只读本地 localStorage，不发请求。 */
  function markResume() {
    if (!window.TVStore || !TVStore.getProgress) return;
    Array.prototype.forEach.call(document.querySelectorAll('#tvGrid .tv-card'), function (c) {
      var k = String(c.getAttribute('data-k') || '');
      var i = k.indexOf('|');
      if (i < 0) return;
      var src = k.slice(0, i), id = k.slice(i + 1);
      if (!id) return;
      var p = TVStore.getProgress({ vod_id: id, _src: src === '' ? undefined : Number(src) }, '');
      /* 空集数名查不到是正常的（进度按「片+集」存），这里只做粗标记：
         用任意一集的进度代表这部片 */
      if (!p) {
        var any = TVStore.getVodProgress({ vod_id: id, _src: src === '' ? undefined : Number(src) });
        p = any;
      }
      if (!p || !p.t) return;
      var badge = c.querySelector('.tv-resume');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'tv-resume';
        c.querySelector('.tv-poster').appendChild(badge);
      }
      badge.textContent = '看到 ' + fmtTime(p.t);
    });
  }

  /* ---------------- 详情与线路 ---------------- */
  /* 源编号 -> 显示名（SRCS 来自网关的 tvSourceList） */
  function srcName(id) {
    for (var i = 0; i < SRCS.length; i++) { if (SRCS[i].id === id) return SRCS[i].name; }
    return (typeof id === 'number') ? ('源 ' + (id + 1)) : '未知源';
  }

  /* 详情页的「换源」一排：同一部片别的源也有时，用户可以换一个能放的。
     网关聚合时会把同名片记在首条的 _alts 上（见 tvAggregate），
     没有候选项就整排不渲染，不占位。 */
  function renderAltSrcs(cur) {
    var eps = byId('tvEps');
    if (!eps) return;
    var old = byId('tvAltSrcs');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!ALT_LIST.length || ALT_LIST.length < 2) return;
    var box = document.createElement('div');
    box.className = 'tv-alt-srcs';
    box.id = 'tvAltSrcs';
    var lab = document.createElement('span');
    lab.className = 'tv-alt-label';
    lab.textContent = '换源';
    box.appendChild(lab);
    ALT_LIST.forEach(function (a) {
      var isCur = (a._src === cur);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tv-alt-btn' + (isCur ? ' is-on' : '');
      b.textContent = srcName(a._src);
      b.title = isCur ? (srcName(a._src) + '（正在看）') : ('切到 ' + srcName(a._src) + (a.remarks ? ' · ' + a.remarks : ''));
      if (!isCur) {
        b.addEventListener('click', function () {
          /* 不带 alts：沿用现有候选集合，切完这排还在 */
          detail(a.vod_id, a._src);
        });
      }
      box.appendChild(b);
    });
    eps.insertBefore(box, eps.firstChild);
  }

  function detail(vodId, src, cardEl, alts) {
    reqSeq++; /* 在飞的列表结果作废，别盖掉「正在打开…」 */
    /* 提示写在列表下方的提示行，别清空网格 —— 用户点进一部片还想看到刚才的列表 */
    noteWithLink('正在打开…', '');
    /* 聚合列表里每条自带 _src：点哪条就问哪个源要详情，编号才对得上。
       ⚠ 这里必须原样把 pin 发出去（包括搜索场景）：vod_id 只在单个源内唯一，
       不带 _src 时网关会按 order 依次试源、命中即返回，很可能给你另一个源里
       同号的另一部片 —— 播放器拿到的就是错的地址。 */
    var pin = typeof src === 'number' ? src : state.src;
    /* 这部片在别的源也有 —— 网关聚合时把同名片挂在列表条目的 _alts 上。
       带数组 = 新打开一部片，重建候选（含当前源）；不带 = 源内切换，
       沿用现有候选，别把它清掉，否则切一次「换源」那排就没了。 */
    if (Object.prototype.toString.call(alts) === '[object Array]') {
      ALT_LIST = [{ _src: pin, vod_id: vodId, cur: true }];
      for (var ai = 0; ai < alts.length; ai++) {
        var av = alts[ai];
        if (!av) continue;
        if (av._src === pin && String(av.vod_id) === String(vodId)) continue;
        ALT_LIST.push({ _src: av._src, vod_id: av.vod_id, remarks: av.remarks || '' });
      }
    }
    var params = { ac: 'videolist', ids: vodId };
    if (typeof pin === 'number') params._src = pin;
    apiGet(params).then(function (d) {
      var it = (d && d.list && d.list[0]) || null;
      if (!it) throw new Error('没拿到该资源');
      /* ⚠ 详情接口的条目【不返回 _src】，只有外层信封有（实测确认）。
         不补这一下，TVStore 的 key 会退化成 "|id|集"，进度/追剧跨源会串台。 */
      if (typeof it._src !== 'number') {
        var envSrc = (d && typeof d._src === 'number') ? d._src : (typeof pin === 'number' ? pin : undefined);
        if (typeof envSrc === 'number') it._src = envSrc;
      }
      /* 片名以服务端返回的这条为准：列表里拿到的名字可能是空的、也可能被源写串了。
         用服务端的标题回填卡片（用户回头还看得见）再开播放器，点进去才知道自己在看什么。 */
      var nm = String(it.vod_name || '').trim();
      if (nm && cardEl) {
        var nmEl = cardEl.querySelector('.tv-name');
        if (nmEl && nmEl.textContent !== nm) nmEl.textContent = nm;
      }
      openPlayer(it);
      /* 记下「正在看这部」：刷新（含门卫 401 触发的重载）后自动回到这里。
         放在 openPlayer 之后 —— 它内部会先关掉旧的二级页，
         早写会被那次关闭当成「用户离开片子」而抹掉。 */
      saveView({ vod: it.vod_id, vodSrc: it._src });
    }).catch(function (e) {
      if (String(e.message || e) === NEED_GATE) { gateExpired(); return; }
      noteWithLink('打开失败：' + String(e.message || e), '');
    });
  }

  function lineName(raw, i) {
    return LINE_NAMES[String(raw || '').toLowerCase()] || ('线路 ' + (i + 1));
  }

  /* ---------------- 手机端：播放器进「二级页」 ----------------
     AppShell 的二级页（.detail-view）只在 ≤768px 生效，正好就是手机。
     adopt 会把节点整块搬进去并在关闭时自动搬回原位，所以 <video> 不会
     被重建、播放不中断；这也正是它比「克隆一份 DOM」强的地方。 */
  var tvDetail = null;

  /* 返回 true 表示「本来就有二级页，已经关掉了」。
     silent=true 表示「只是要换一层，不是真的离开」：这时不能让 AppShell
     去 history.back() —— 那个 back 是异步的，会落到紧接着 pushState 出来的
     新哨兵上，把历史搞乱，最后「返回列表」会多退一步直接退出 TV 页。 */
  function closeTvDetail(silent) {
    if (!tvDetail) return false;
    var h = tvDetail;
    tvDetail = null;   /* 先置空：close() 会回调 onClose，不置空会绕回来 */
    h.close(silent ? { silent: true } : undefined);
    /* 静默关闭是「换一层」，紧接着 detail() 会把新的写回去；
       只有真的关闭（用户点了返回）才该把「正在看哪部」清掉 */
    if (!silent) saveView({ vod: null, vodSrc: null });
    return true;
  }

  function openTvDetail(title) {
    if (!window.AppShell || !AppShell.openDetail) return null;
    /* 本来有层 = 这是一次「换掉」而不是「新开」（换源走的就是这条路）。
       静默关旧的 + replaceState 开新的，历史位不变，后退才不会多退一步。 */
    var replacing = closeTvDetail(true);
    tvDetail = AppShell.openDetail({
      title: title || '播放',
      replace: replacing,
      /* 桌面端也走二级页。以前这里卡了 tvNarrow()，只有 ≤768px 才建层，
         桌面端点卡片是把播放器就地展开在长页面里 —— 还得往下滚才看得见画面。
         allowDesktop 正是 AppShell 为这种情况留的开关：桌面端会自动补一条
         sticky 的「标题 + 关闭」头（手机端用 App Bar，不重复加）。 */
      allowDesktop: true,
      swipeClose: true,
      onClose: function (o) {
        tvDetail = null;
        /* ⚠ 静默替换（换源）时不能把播放器藏掉：openPlayer 里
           `p.hidden = false` 在 openTvDetail 之前就执行了，而这里会把它
           重新藏起来 —— 结果就是「换完源画面不见了，得再点一集」。
           要藏只在用户真离开时藏；其它清理（收抽屉、选集归位、停播）照做。 */
        var silent = !!(o && o.silent);
        if (!silent) {
          var p = byId('tvPlayer'); if (p) p.hidden = true;
          var bar = byId('tvBar'); if (bar) bar.hidden = true;
        }
        /* 层关掉时抽屉也得跟着收，并把选集搬回右栏，
           否则下次在桌面端打开会发现选集不在侧栏里 */
        var sh = byId('tvSheet'), mk = byId('tvMask'), eps = byId('tvEps'), home = epsHome();
        if (sh) sh.classList.remove('is-open');
        if (mk) mk.classList.remove('is-open');
        if (sh) sh.hidden = true;
        if (mk) mk.hidden = true;
        document.documentElement.classList.remove('tvsheet-open');
        if (eps && home && eps.parentNode !== home) home.appendChild(eps);
        stopPlayer();
      },
    });
    /* 桌面端二级页默认是 880px 居中窄栏（music / journal 用的那套），
       影视页要 B 站那种宽屏两栏，用这个标记类单独放宽，
       不去动别人的 .detail-view 规则。 */
    if (tvDetail && tvDetail.el) tvDetail.el.classList.add('tv-detail');
    return tvDetail;
  }

  /* 二级页侧栏顶部的「本次搜索结果」。
     从列表页点海报进来时，把那次搜索命中的整批结果一并带进层里：用户搜「蜘蛛侠」
     点开其中一部后，侧栏还列着其它几部，可以直接横跳，不必退回列表重搜。
     没有关键词（直接按分类浏览）时整块隐藏。 */
  function renderSbHits(cur) {
    var box = byId('tvSbHits');
    var list = byId('tvSbList');
    if (!box || !list) return;
    var hits = state.hits || [];
    list.innerHTML = '';
    if (!state.kw || hits.length < 2) { box.hidden = true; return; }
    setText('tvSbKw', state.kw);
    setText('tvSbCount', hits.length + ' 条');
    var curId = String((cur && cur.vod_id) || '');
    hits.forEach(function (h) {
      var on = String(h.vod_id || '') === curId;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tv-sb-item' + (on ? ' is-on' : '');
      b.title = h.vod_name || '';
      b.innerHTML = '<span class="tv-sb-poster"></span><span class="tv-sb-body">' +
        '<span class="tv-sb-name"></span><span class="tv-sb-remark"></span></span>';
      var pic = String(h.vod_pic || '');
      if (pic) {
        var im = document.createElement('img');
        im.loading = 'lazy';
        im.referrerPolicy = 'no-referrer';
        im.alt = '';
        im.src = picUrl(pic);
        im.addEventListener('error', function () { if (im.parentNode) im.parentNode.removeChild(im); });
        b.querySelector('.tv-sb-poster').appendChild(im);
      }
      b.querySelector('.tv-sb-name').textContent = h.vod_name || '未命名';
      var rm = String(h.vod_remarks || '');
      if (rm) b.querySelector('.tv-sb-remark').textContent = rm;
      else b.querySelector('.tv-sb-remark').remove();
      b.addEventListener('click', function () {
        if (on) return;   /* 点的就是当前这部，别白重开一次层 */
        noteWithLink('正在打开「' + (h.vod_name || '') + '」…', '');
        detail(h.vod_id, h._src);
      });
      list.appendChild(b);
    });
    box.hidden = false;
  }

  /* ---------------- 移动端选集抽屉（B 站那套） ----------------
     桌面端选集是常驻右栏；手机上 B 站把它收进底部抽屉。这里不复制 DOM，
     而是把 #tvEps 整块搬进抽屉、关闭时搬回 .tv-aside —— 和 AppShell.adopt
     同一个思路：节点身份不变，已经绑好的事件、已经点亮的「当前集」都不会丢。 */
  function isNarrowTv() { return window.matchMedia('(max-width: 992px)').matches; }

  var sheetHome = null;   /* #tvEps 原来的爸爸（.tv-aside），搬回来用 */

  function epsHome() {
    if (!sheetHome) {
      var a = document.querySelector('.tv-aside');
      if (a) sheetHome = a;
    }
    return sheetHome;
  }

  function sheetOpen() {
    var sh = byId('tvSheet'), mk = byId('tvMask'), body = byId('tvSheetBody'), eps = byId('tvEps');
    if (!sh || !eps) return;
    if (!isNarrowTv()) return;
    if (body && eps.parentNode !== body) body.appendChild(eps);
    if (mk) mk.hidden = false;
    if (sh) sh.hidden = false;
    /* 下一帧再加 is-open，否则 hidden 撤掉和 transform 升起挤在同一帧，
       浏览器会把两者合成一次、动画不播（抽屉直接「跳」出来）。 */
    requestAnimationFrame(function () {
      if (mk) mk.classList.add('is-open');
      if (sh) sh.classList.add('is-open');
    });
    document.documentElement.classList.add('tvsheet-open');
  }

  function sheetClose() {
    var sh = byId('tvSheet'), mk = byId('tvMask'), eps = byId('tvEps'), home = epsHome();
    if (mk) mk.classList.remove('is-open');
    if (sh) sh.classList.remove('is-open');
    document.documentElement.classList.remove('tvsheet-open');
    /* 等过渡走完再真正隐藏，否则抽屉会「啪」地消失、看不到下滑动画 */
    setTimeout(function () {
      if (mk && !mk.classList.contains('is-open')) mk.hidden = true;
      if (sh && !sh.classList.contains('is-open')) sh.hidden = true;
      if (eps && home && eps.parentNode !== home) home.appendChild(eps);
    }, 300);
  }

  /* 底部操作栏上显示当前集数，让用户不用开抽屉也知道自己在第几集 */
  function setBarEp(txt) {
    var el = byId('tvBarEpsTxt');
    if (!el) return;
    el.textContent = txt ? ('选集 · ' + txt) : '选集';
  }

  function openPlayer(it) {
    var p = byId('tvPlayer');
    var eps = byId('tvEps');
    if (!p || !eps) return;
    /* 关掉上一次可能还开着的抽屉，并把选集搬回右栏，重开一部片时状态才是干净的 */
    sheetClose();
    setText('tvTitle', it.vod_name || '');
    setText('tvRemark', it.vod_remarks || '');
    /* 数据栏第二格：这条详情是从哪个片源来的（B 站那个位置是播放量） */
    var srcLine = byId('tvSrcLine');
    var pin = typeof it._src === 'number' ? it._src : (typeof state.src === 'number' ? state.src : -1);
    var srcName = '';
    for (var si = 0; si < SRCS.length; si++) { if (SRCS[si].id === pin) { srcName = SRCS[si].name; break; } }
    if (srcLine) {
      if (srcName) { setText('tvSrcName', srcName); srcLine.hidden = false; }
      else { srcLine.hidden = true; }
    }
    renderSbHits(it);
    if (window.TVPlayer) { TVPlayer.setTitle(it.vod_name || ''); TVPlayer.setEpisode(it.vod_remarks || ''); TVPlayer.setNav(false, false); }
    EP.list = [];
    EP.i = -1;
    eps.innerHTML = '';
    var froms = String(it.vod_play_from || '').split('$$$');
    var groups = String(it.vod_play_url || '').split('$$$');
    var firstPlayable = null;
    /* 各条线路（给播放器右上角那个「线路」菜单用，B 站那个位置是清晰度） */
    var LINES = [];

    /* ---- 选集面板：线路做顶部 tab，集数做网格（B 站那个观感）----
       原来是把所有线路的所有集数一次性铺开成「线路名 + 一长串集数」，
       线路一多就得滚很久才能翻到下一集；现在一次只显示一条线路。 */
    var tabsBox = document.createElement('div');
    tabsBox.className = 'tv-ep-tabs';
    var panesBox = document.createElement('div');
    panesBox.className = 'tv-ep-panes';
    var countEl = byId('tvEpCount');
    var PANES = [];        /* 每条线路一项：{ tab, pane, count } */
    var firstPlayablePane = -1;

    function selectLine(k) {
      if (!PANES.length) return;
      if (k < 0 || k >= PANES.length) k = 0;
      PANES.forEach(function (x, i) {
        x.tab.classList.toggle('is-on', i === k);
        x.pane.hidden = i !== k;
      });
      if (countEl) countEl.textContent = PANES[k].count + ' 集';
      /* 抽屉标题里那份集数也得跟着换线路走，否则切了线路数字还是旧的 */
      var sc2 = byId('tvSheetCount');
      if (sc2) sc2.textContent = PANES[k].count + ' 集';
    }

    groups.forEach(function (g, gi) {
      var parts = [];
      g.split('#').forEach(function (x) { if (x.indexOf('$') > 0) parts.push(x); });
      if (!parts.length) return;
      var urls = parts.map(function (x) { return x.slice(x.indexOf('$') + 1); });
      var playable = urls.some(function (u) { return isM3u8(u) || isMedia(u); });

      var pane = document.createElement('div');
      pane.className = 'tv-ep-grid';
      var tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tv-ep-tab' + (playable ? '' : ' is-html');
      tab.textContent = lineName(froms[gi], gi) + (playable ? '' : ' · 网页');
      var entry = { tab: tab, pane: pane, count: parts.length };
      PANES.push(entry);
      tab.addEventListener('click', function () { selectLine(PANES.indexOf(entry)); });

      parts.forEach(function (part, pi) {
        var cut = part.indexOf('$');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tv-ep';
        b.textContent = part.slice(0, cut) || ('第' + (pi + 1) + '集');
        b.title = b.textContent;
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(eps.querySelectorAll('.tv-ep'), function (x) { x.classList.toggle('is-on', x === b); });
          /* 上一集/下一集可能跨线路，面板得跟着切到那一页 */
          selectLine(PANES.indexOf(entry));
          var idx = -1;
          for (var k = 0; k < EP.list.length; k++) { if (EP.list[k].btn === b) { idx = k; break; } }
          EP.i = idx;
          if (window.TVPlayer) { TVPlayer.setNav(idx > 0, idx >= 0 && idx < EP.list.length - 1); TVPlayer.setEpisode(b.textContent || ''); }
          /* 底部栏跟着显示当前集；手机上选完就收起抽屉，把画面还给用户 */
          setBarEp(b.textContent || '');
          if (isNarrowTv()) sheetClose();
          /* 记下「现在在看哪部片的哪一集」——进度和直链都按这个键存 */
          CUR.it = it;
          CUR.ep = b.textContent || '';
          if (window.TVStore) TVStore.saveUrl(it, CUR.ep, urls[pi] || '');
          updateFavBtn();
          play(urls[pi] || '');
        });
        EP.list.push({ btn: b, url: urls[pi] || '' });
        pane.appendChild(b);
      });

      panesBox.appendChild(pane);
      tabsBox.appendChild(tab);
      if (playable) LINES.push({ name: lineName(froms[gi], gi), btn: pane.querySelector('.tv-ep') });
      if (firstPlayablePane < 0 && playable) { firstPlayablePane = PANES.length - 1; firstPlayable = pane.querySelector('.tv-ep'); }
    });
    if (PANES.length) {
      eps.appendChild(tabsBox);
      eps.appendChild(panesBox);
      /* 默认停在第一条「能播」的线路上：第一条线路经常是网页线路，直接显示它
         会让用户以为整部片子都不能播 */
      selectLine(firstPlayablePane < 0 ? 0 : firstPlayablePane);
    }
    if (window.TVPlayer) {
      TVPlayer.setQualities(
        LINES.map(function (x) { return { name: x.name }; }),
        0,
        function (i) { if (LINES[i] && LINES[i].btn) LINES[i].btn.click(); },
      );
    }
    /* 这部片别的源也有的话，在选集上方给一排「换源」 */
    renderAltSrcs(it._src);
    p.hidden = false;
    /* 移动端底部操作栏：只在窄屏出现（宽屏选集就在右栏，不需要它） */
    var bar = byId('tvBar');
    if (bar) bar.hidden = !isNarrowTv();
    /* 抽屉标题里的集数，和右栏那个 #tvEpCount 是同一个数 */
    var sc = byId('tvSheetCount');
    if (sc) sc.textContent = (byId('tvEpCount') || {}).textContent || '';
    setBarEp('');
    /* 手机端把播放器整块搬进二级页：整屏只留「标题 + 视频 + 选集」，
       比在长页面里往下滚着找播放器舒服得多；关闭时自动搬回原位。 */
    var det = openTvDetail(it.vod_name || '');
    if (det && det.el) {
      AppShell.adopt(p, det.el);
      document.documentElement.classList.add('tvp-open');
    }
    if (firstPlayable) { firstPlayable.click(); }
    else {
      var any = eps.querySelector('.tv-ep');
      if (any) {
        var raw = String(it.vod_play_url || '').split('$$$')[0].split('#')[0];
        var u = raw.indexOf('$') > 0 ? raw.slice(raw.indexOf('$') + 1) : '';
        any.click();
        noteWithLink('这个资源只有网页线路，浏览器里播不了。', u);
      } else { setText('tvNote', '这个资源没有可播放的地址'); }
    }
    /* 正常情况下二级页一定建成了（层里自己会滚），再 scrollIntoView 只会把层顶出去；
       只有 AppShell 没加载出来时才退回「就地展开」，那时才需要滚过去。 */
    if (!det && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- 继续观看 / 我的追剧（本地数据） ----------------
     这两块只读 localStorage，不碰网络。没有内容时整块隐藏，不占位。 */
  function myCard(rec, kind) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tv-my-item';
    b.title = rec.name || '';
    var pos = (rec.d && rec.t) ? Math.min(100, Math.max(2, Math.round(rec.t / rec.d * 100))) : 0;
    b.innerHTML = '<span class="tv-my-poster"><span class="tv-my-bar"' + (pos ? '' : ' hidden') +
      '><i style="width:' + pos + '%"></i></span></span>' +
      '<span class="tv-my-name"></span><span class="tv-my-sub"></span>';
    var pic = String(rec.pic || '');
    var poster = b.querySelector('.tv-my-poster');
    if (pic) {
      var im = document.createElement('img');
      im.loading = 'lazy';
      im.referrerPolicy = 'no-referrer';
      im.alt = '';
      im.src = picUrl(pic);
      im.addEventListener('error', function () {
        if (im.parentNode) im.parentNode.removeChild(im);
        poster.classList.add('is-empty');
      });
      poster.insertBefore(im, poster.firstChild);
    } else {
      poster.classList.add('is-empty');
    }
    b.querySelector('.tv-my-name').textContent = rec.name || '未命名';

    /* 副标题：续播显示「看到 12:34 · 第3集」，追剧显示备注 */
    var sub = b.querySelector('.tv-my-sub');
    if (kind === 'prog') {
      var parts = [];
      if (rec.t) parts.push('看到 ' + fmtTime(rec.t));
      if (rec.ep) parts.push(rec.ep);
      sub.textContent = parts.join(' · ');
    } else {
      sub.textContent = rec.remark || '';
      if (!rec.remark) sub.remove();
    }

    /* 追剧卡片右上角给个删除叉 */
    if (kind === 'fav') {
      var del = document.createElement('span');
      del.className = 'tv-my-del';
      del.setAttribute('role', 'button');
      del.setAttribute('aria-label', '取消追剧');
      del.innerHTML = '<i class="fas fa-xmark"></i>';
      del.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (window.TVStore) TVStore.removeFav(rec.key);
        renderMy();
      });
      b.appendChild(del);
    }

    /* 点卡片：有 vod_id 就照常打开详情；只有名字（进度记录被清了）就不响应 */
    b.addEventListener('click', function () {
      if (!rec.id) return;
      detail(rec.id, typeof rec.src === 'number' ? rec.src : undefined);
    });
    return b;
  }

  function renderMy() {
    var box = byId('tvMy'), row = byId('tvMyRow'), favRow = byId('tvFavRow'),
        favHead = byId('tvFavHead'), favCount = byId('tvFavCount');
    if (!box || !row || !favRow || !window.TVStore) return;

    var prog = TVStore.recent(12);
    var favs = TVStore.favList();

    row.innerHTML = '';
    prog.forEach(function (r) { row.appendChild(myCard(r, 'prog')); });

    favRow.innerHTML = '';
    favs.forEach(function (f) {
      /* 追剧记录用的是列表页那套字段，补一个 vod_id 让 myCard 能打开详情 */
      favRow.appendChild(myCard({ id: f.id, name: f.name, pic: f.pic, remark: f.remark, src: f.src, key: f.key }, 'fav'));
    });

    if (favHead) favHead.hidden = !favs.length;
    if (favCount) favCount.textContent = favs.length ? favs.length + ' 部' : '';
    /* 两块都空 → 整块不显示 */
    box.hidden = !prog.length && !favs.length;
  }

  /* 播放页上「追剧」按钮的选中态 */
  function updateFavBtn() {
    var b = byId('tvFav'), t = byId('tvFavTxt');
    if (!b || !window.TVStore) return;
    var on = CUR.it ? TVStore.isFav(CUR.it) : false;
    b.classList.toggle('is-on', on);
    var ic = b.querySelector('i');
    if (ic) ic.className = on ? 'fas fa-star' : 'far fa-star';
    if (t) t.textContent = on ? '已追剧' : '追剧';
  }

  /* ---------------- 搜索历史 / 偏好记忆（纯本地） ----------------
     这两样都只写 localStorage：不联网、不上传。用途很直接 ——
     影视页的用法就是「反复搜同一批片名」，每次重敲一遍很烦；
     分类和片源同理，用户选「动漫 + 量子」之后下次进来还得再选一次。 */
  var K_SK = 'tv.search.v1';
  var K_PREF = 'tv.pref.v1';
  var MAX_SK = 12;

  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 配额满了就算了 */ }
  }
  function searchHistory() {
    var a = lsGet(K_SK, []);
    return Object.prototype.toString.call(a) === '[object Array]' ? a : [];
  }
  function pushHistory(kw) {
    kw = String(kw || '').trim();
    if (!kw) return;
    var a = searchHistory().filter(function (x) { return x !== kw; });
    a.unshift(kw);
    lsSet(K_SK, a.slice(0, MAX_SK));
  }
  function dropHistory(kw) {
    lsSet(K_SK, searchHistory().filter(function (x) { return x !== kw; }));
  }
  function savePref() {
    lsSet(K_PREF, { t: state.t, src: state.src, pick: state.pick });
  }
  function loadPref() {
    var p = lsGet(K_PREF, null);
    if (!p || typeof p !== 'object') return;
    /* 只恢复分类和「选了哪个源」。关键词刻意不恢复：用户下次进来
       想看的是最新片单，而不是被上一次的搜索结果困住。 */
    if (typeof p.t === 'string') state.t = p.t;
    if (p.pick && typeof p.src === 'number') { state.pick = true; state.src = p.src; }
  }

  /* ---------------- 会话内的「当前视图」----------------
     刷新之后要回到原来的位置，而不是被丢回最新片单首页。
     什么时候会刷新：用户自己按 F5（门卫过期不会自动刷新了 ——
     只提示 + 给一个用户自己点的重新登录链接，见 gateExpired）。
     用户真去重登、或自己按了 F5，都不该把正在看的那部片、
     那个搜索词弄丢，所以这里要把位置存下来。
     用 sessionStorage 而不是 localStorage：同一个标签页内刷新要还原，
     但关掉标签页再进来应该回到「最新片单」—— 跨会话恢复关键词会把人
     困在上次搜的东西里（这正是 loadPref 不恢复 kw 的原因）。 */
  var K_VIEW = 'tv.view.v1';
  function ssGet(k, d) { try { var v = sessionStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function saveView(extra) {
    var v = ssGet(K_VIEW, null);
    if (!v || typeof v !== 'object') v = {};
    v.kw = state.kw || '';
    v.t = state.t || '';
    v.src = (typeof state.src === 'number') ? state.src : null;
    v.pick = !!state.pick;
    /* extra 里带 vod 才动「正在看哪部」；不带就原样保留，
       免得随便一次 saveView 把已经打开的片子抹掉 */
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'vod')) {
      v.vod = extra.vod || '';
      v.vodSrc = (typeof extra.vodSrc === 'number') ? extra.vodSrc : null;
    }
    ssSet(K_VIEW, v);
  }
  function loadView() {
    var v = ssGet(K_VIEW, null);
    return (v && typeof v === 'object') ? v : null;
  }

  /* ---------------- 搜索历史下拉 ----------------
     自己画一个：<input list=datalist> 那种原生建议框在移动端表现很差
     （iOS 上根本不弹），而且没法做「点 × 删掉这一条」。
     doSearch 由 boot() 注入 —— 历史项被点时得走和按钮完全一样的流程。 */
  var doSearch = function () {};
  function histOpen() { var b = byId('tvHist'); return !!(b && !b.hidden); }
  function hideHist() { var b = byId('tvHist'); if (b) b.hidden = true; }
  function showHist() {
    var box = byId('tvHist');
    if (!box) return;
    var list = searchHistory();
    if (!list.length) { box.hidden = true; return; }
    box.innerHTML = '';
    var head = document.createElement('div');
    head.className = 'tv-hist-head';
    var ht = document.createElement('span');
    ht.textContent = '最近搜索';
    var clr = document.createElement('button');
    clr.type = 'button';
    clr.textContent = '清空';
    clr.addEventListener('click', function (e) {
      e.stopPropagation();
      lsSet(K_SK, []);
      hideHist();
    });
    head.appendChild(ht);
    head.appendChild(clr);
    box.appendChild(head);
    list.forEach(function (w) {
      var row = document.createElement('div');
      row.className = 'tv-hist-row';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tv-hist-word';
      b.textContent = w;
      b.addEventListener('click', function () { doSearch(w); });
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'tv-hist-del';
      del.setAttribute('aria-label', '删除这条记录');
      del.innerHTML = '<i class="fas fa-xmark"></i>';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        dropHistory(w);
        showHist();
      });
      row.appendChild(b);
      row.appendChild(del);
      box.appendChild(row);
    });
    box.hidden = false;
  }
  /* 上下键在下拉里移动高亮，同时把词填回输入框 */
  function moveHist(dir) {
    var box = byId('tvHist');
    if (!box) return;
    var words = box.querySelectorAll('.tv-hist-word');
    if (!words.length) return;
    var cur = -1;
    for (var i = 0; i < words.length; i++) if (words[i].classList.contains('is-cur')) cur = i;
    if (cur >= 0) words[cur].classList.remove('is-cur');
    var nx = cur + dir;
    if (nx < 0) nx = words.length - 1;
    if (nx >= words.length) nx = 0;
    words[nx].classList.add('is-cur');
    var kw = byId('tvKw');
    if (kw) kw.value = words[nx].textContent;
  }

  function stopPlayer() { if (window.TVPlayer) TVPlayer.stop(); }

  function play(url) {
    if (!url) { setText('tvNote', '这条线路没有地址'); return; }
    if (!window.TVPlayer) { setText('tvNote', '播放器脚本没加载（js/tv-player.js）'); return; }
    if (TVPlayer.classify(url) === 'page') {
      TVPlayer.stop();
      noteWithLink('这条是网页播放线路（返回 HTML，不是视频流），浏览器跨域播不了。', url);
      return;
    }
    TVPlayer.play(url);
  }

  /* ---------------- 观看进度（本地续播） ----------------
     片子打开、进度条一有变化就往 localStorage 写；
     下次点同一集，等 metadata 到了再跳回去。
     为什么等 metadata：HLS 刚建的时候 duration 还是 NaN，
     这时设 currentTime 会被浏览器丢掉，看起来就是「续播没生效」。 */
  var CUR = { it: null, ep: '' };

  function onTimeUpdate() {
    if (!window.TVStore || !CUR.it) return;
    var v = TVPlayer.getVideo && TVPlayer.getVideo();
    if (!v || !v.duration || !isFinite(v.duration)) return;
    TVStore.saveProgress(CUR.it, CUR.ep, v.currentTime, v.duration);
  }

  function resumeIfAny() {
    if (!window.TVStore || !CUR.it) return;
    var v = TVPlayer.getVideo && TVPlayer.getVideo();
    if (!v || !v.duration || !isFinite(v.duration)) return;
    var p = TVStore.getProgress(CUR.it, CUR.ep);
    if (!p || !p.t) return;
    /* 已经接近上次那个位置就别再跳了（可能是重试引起的第二次 metadata） */
    if (Math.abs(v.currentTime - p.t) < 3) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 1, p.t));
    TVPlayer.toast('已续播到 ' + fmtTime(p.t));
  }

  function fmtTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return (h > 0 ? h + ':' : '') + p2(m) + ':' + p2(x);
  }

  /* ---------------- 绑定 ---------------- */
  function boot() {
    var n0 = byId('tvNote');
    if (n0) NOTE0 = n0.textContent;
    if (window.TVPlayer) {
      TVPlayer.init({
        gateway: GATEWAY,
        onPrev: function () { if (EP.i > 0) EP.list[EP.i - 1].btn.click(); },
        onNext: function () { if (EP.i >= 0 && EP.i < EP.list.length - 1) EP.list[EP.i + 1].btn.click(); },
        onEnded: function () { if (EP.i >= 0 && EP.i < EP.list.length - 1) EP.list[EP.i + 1].btn.click(); },
      });
    }
    var go = byId('tvGo'), kw = byId('tvKw'), back = byId('tvBack');
    /* 统一的「执行搜索」入口：记历史、关下拉、回到第 1 页。
       追加模式一律关掉 —— 换关键词必须重开一页，不能往后接。 */
    function runSearch(k) {
      state.kw = String(k == null ? (kw ? kw.value : '') : k).trim();
      if (kw && kw.value !== state.kw) kw.value = state.kw;
      if (state.kw) pushHistory(state.kw);
      hideHist();
      /* 新搜索 = 换一批结果，清掉「正在看哪部」 */
      saveView({ vod: null, vodSrc: null });
      load(1);
    }
    doSearch = runSearch;
    if (go) go.addEventListener('click', function () { runSearch(); });
    if (kw) {
      kw.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); runSearch(); return; }
        if (e.key === 'Escape') { hideHist(); return; }
        /* 方向键在下拉里选：上/下移动高亮（同时回填输入框） */
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          if (!histOpen()) return;
          e.preventDefault();
          moveHist(e.key === 'ArrowDown' ? 1 : -1);
        }
      });
      /* 聚焦就展出历史；输入时防抖 600ms 自动搜 —— 采集源慢，
         每敲一个字发一次会把网关打爆，也让结果乱跳。 */
      kw.addEventListener('focus', function () { if (!kw.value.trim()) showHist(); });
      var deb = 0;
      kw.addEventListener('input', function () {
        clearTimeout(deb);
        var v = kw.value.trim();
        if (!v) { showHist(); return; }
        hideHist();
        deb = setTimeout(function () {
          /* 只有和当前结果不同才重搜，避免「打了又删回去」白打一次网关 */
          if (v !== state.kw) runSearch(v);
        }, 600);
      });
      document.addEventListener('click', function (e) {
        var box = byId('tvHist');
        if (box && !box.hidden && !box.contains(e.target) && e.target !== kw) hideHist();
      });
    }
    var prev = byId('tvPrev'), next = byId('tvNext');
    if (prev) prev.addEventListener('click', function () { if (state.pg > 1) load(state.pg - 1); });
    if (next) next.addEventListener('click', function () { load(state.pg + 1); });
    if (back) back.addEventListener('click', function () {
      /* 二级页开着时「返回列表」就是关掉它：onClose 里已经隐藏 + 停播了 */
      if (closeTvDetail()) return;
      var p = byId('tvPlayer'); if (p) p.hidden = true;
      stopPlayer();
      load(state.pg);
    });
    var rot = byId('tvRotate');
    if (rot) rot.addEventListener('click', function () {
      if (window.TVPlayer && TVPlayer.enterLandscape) TVPlayer.enterLandscape();
    });

    /* ---------- 追剧 / 原站打开 / 清空记录 ---------- */
    var favBtn = byId('tvFav');
    if (favBtn) favBtn.addEventListener('click', function () {
      if (!window.TVStore || !CUR.it) return;
      var on = TVStore.toggleFav(CUR.it);
      updateFavBtn();
      renderMy();
      if (window.TVPlayer && TVPlayer.toast) TVPlayer.toast(on ? '已加入追剧' : '已取消追剧');
    });

    /* 原站打开：把这一集的真实地址甩给浏览器。
       这是「暴露直链」不是「下载」——本站不托管、不转存任何文件。 */
    var srcOpen = byId('tvSrcOpen');
    if (srcOpen) srcOpen.addEventListener('click', function () {
      if (!CUR.it || !CUR.ep) { noteWithLink('还没选集，先点一集再打开原站。', ''); return; }
      var u = window.TVStore ? TVStore.getUrl(CUR.it, CUR.ep) : '';
      if (!u) { noteWithLink('这一集还没有地址记录，先播放一次再试。', ''); return; }
      /* 网页线路（/share/ 那种）本来就要在新标签页看，一并走这里 */
      window.open(u, '_blank', 'noopener,noreferrer');
      noteWithLink('已在原站打开：' + CUR.ep + '（本站不托管该视频，直链来自采集接口）', '');
    });

    var myClear = byId('tvMyClear');
    if (myClear) myClear.addEventListener('click', function () {
      if (!window.TVStore) return;
      /* 只清进度，不动追剧列表 —— 用户主动收藏的东西不该被「清空记录」带走 */
      TVStore.clearAllProgress();
      renderMy();
      noteWithLink('观看记录已清空（追剧列表保留）。', '');
    });

    /* ---------- 观看进度：接在 <video> 上 ----------
       等 loadedmetadata 再跳（那时 duration 才是真的），
       timeupdate 负责回写。两个都在 TVPlayer.init 之后绑。 */
    if (window.TVPlayer && TVPlayer.getVideo) {
      var vv = TVPlayer.getVideo();
      if (vv) {
        vv.addEventListener('loadedmetadata', function () { setTimeout(resumeIfAny, 120); });
        vv.addEventListener('timeupdate', onTimeUpdate);
        /* 关页面/切后台时补存一次，别把最后几秒丢了 */
        vv.addEventListener('pause', function () { onTimeUpdate(); });
      }
      window.addEventListener('pagehide', function () { if (CUR.it) onTimeUpdate(); });
      /* 切到后台（手机切 App）也存一次 */
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden' && CUR.it) onTimeUpdate();
      });
    }

    /* ---------- 移动端底部栏 + 选集抽屉 ---------- */
    var barEps = byId('tvBarEps'), barBack = byId('tvBarBack'), mask = byId('tvMask'),
        sheet = byId('tvSheet'), sheetClose = byId('tvSheetClose'), grip = byId('tvGrip');
    if (barEps) barEps.addEventListener('click', sheetOpen);
    if (mask) mask.addEventListener('click', sheetClose);
    if (sheetClose) sheetClose.addEventListener('click', sheetClose);
    /* 底部栏的返回 = 原来的「返回列表」，复用同一个按钮，逻辑不重写两遍 */
    if (barBack && back) barBack.addEventListener('click', function () { back.click(); });

    /* 抓手下拉关闭：B 站那个小横条是可以往下甩的。
       只认纵向位移，横向滑动不误触。 */
    if (grip && sheet) {
      var gy = 0, gdown = false;
      grip.addEventListener('touchstart', function (e2) {
        var t = e2.touches[0];
        gy = t.clientY; gdown = true;
        sheet.style.transition = 'none';
      }, { passive: true });
      grip.addEventListener('touchmove', function (e2) {
        if (!gdown) return;
        var dy = e2.touches[0].clientY - gy;
        if (dy > 0) sheet.style.transform = 'translateY(' + dy + 'px)';
      }, { passive: true });
      grip.addEventListener('touchend', function (e2) {
        if (!gdown) return;
        gdown = false;
        sheet.style.transition = '';
        sheet.style.transform = '';
        /* 甩过 70px 就当「要关」 */
        var dy = (e2.changedTouches[0] || {}).clientY - gy;
        if (dy > 70) sheetClose();
      });
    }

    /* Esc 关抽屉（桌面端窄窗口调试时也用得上） */
    document.addEventListener('keydown', function (e2) {
      if (e2.key === 'Escape' && sheet && sheet.classList.contains('is-open')) sheetClose();
    });

    /* 窗口从窄变宽时收掉抽屉和底部栏：宽屏选集在右栏，
       留着抽屉会浮在没有侧栏的布局上。 */
    if (window.matchMedia) {
      var mq = window.matchMedia('(max-width: 992px)');
      var onMq = function () {
        if (!mq.matches) {
          var sh = byId('tvSheet'), mk = byId('tvMask'), eps = byId('tvEps'), home = epsHome();
          if (sh) { sh.classList.remove('is-open'); sh.hidden = true; }
          if (mk) { mk.classList.remove('is-open'); mk.hidden = true; }
          document.documentElement.classList.remove('tvsheet-open');
          if (eps && home && eps.parentNode !== home) home.appendChild(eps);
          var bar = byId('tvBar'); if (bar) bar.hidden = true;
        } else {
          /* 变窄：如果播放器正开着，底部栏要补上 */
          var pr = byId('tvPlayer');
          var bar2 = byId('tvBar');
          if (bar2 && pr && !pr.hidden) bar2.hidden = false;
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
    /* 这里原来会在视口变宽时收掉二级页 —— 因为那套样式只在窄屏生效，留在宽屏
       就是一层没有样式的浮层。现在桌面端有自己的样式了，窄屏宽屏来回切都该留着
       这个层，没有理由再关。 */
    if (window.AppShell && AppShell.onMode) AppShell.onMode(function () { /* 保持打开 */ });
    renderMy();
    /* 恢复上次的分类/片源偏好，再拉数据 */
    loadPref();
    /* 再把「本标签页刷新前的位置」接上：同一个搜索词、同一个分类/片源，
       而且如果刷新前正在看某部片，等列表回来后自动把它打开 ——
       这样门卫 401 触发的重载（或用户按 F5）之后，页面看起来没变。 */
    var vw = loadView();
    if (vw) {
      if (typeof vw.kw === 'string' && vw.kw) {
        state.kw = vw.kw;
        var kwEl = byId('tvKw');
        if (kwEl) kwEl.value = vw.kw;
      }
      if (typeof vw.t === 'string' && vw.t) state.t = vw.t;
      if (typeof vw.src === 'number') { state.src = vw.src; state.pick = !!vw.pick; }
    }
    if (byId('tvGrid')) {
      loadCats().then(function () {
        load(1);
        /* 恢复「正在看的那部」。detail() 自己会开二级页+播放器，
           不需要列表先到位，所以并行发起即可。 */
        if (vw && vw.vod) {
          detail(vw.vod, (typeof vw.vodSrc === 'number') ? vw.vodSrc : undefined);
        }
      });
    }
  }

  /* 本地联调/版式验证用的钩子：不走网关，直接拿一份详情数据开播放器。
     生产环境没人会调它（要显式 window.__TV_DEBUG 才会挂上去）。 */
  if (window.__TV_DEBUG) window.__open = function (it) { openPlayer(it); };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
