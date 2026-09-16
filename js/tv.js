/* ============================================================
 * 影视页 (js/tv.js)
 * ------------------------------------------------------------
 * 为什么必须走代理：实测 12 个公开苹果 CMS 采集接口，**只要请求带 Origin，
 * 响应里就没有 Access-Control-Allow-Origin**（不带 Origin 反而给 *）——
 * 也就是说浏览器直连一定被 CORS 拦死，页面只会是空的。视频流同理
 * （hls.js 用 XHR 取 m3u8/分片，一样要 CORS）。
 * 所以列表/详情/搜索走 /api/tv，m3u8 与分片走 /api/tv/stream，
 * 由 cloudflare/music-api/_worker.js 转发（服务端请求不带 Origin，上游照常给数据）。
 * 部署：把 _worker.js 重新发布一次即可，前端不用改地址。
 * ============================================================ */
(function () {
  'use strict';

  /* 生产走自建 Worker；window.TV_GATEWAY 留给本地联调覆盖 */
  var GATEWAY = (window.TV_GATEWAY || 'https://sakura-music-api.pages.dev').replace(/\/$/, '');
  var HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
  /* 采集站常见成人向栏目，站点是公开页面，直接不展示 */
  var BLOCK = /伦理|福利|里番|情色|成人|无码|色情|自拍|偷拍|人妖|淫/;
  /* 可以直接塞进 <video> 的直链后缀 */
  var MEDIA_EXT = ['.mp4', '.m4v', '.mkv', '.flv', '.avi', '.mov', '.webm', '.mp3', '.m4a'];

  /* src：分类列表来自哪号源。各站 type_id 编号不同，翻页/点分类必须带上它 */
  var state = { t: '', pg: 1, kw: '', src: null, busy: false, pick: false };
  /* 「片源」那排的源清单（由网关下发），以及这次每个源的耗时 */
  var SRCS = [];
  /* 扁平化的选集列表，给播放器的上一集/下一集/自动连播用 */
  var EP = { list: [], i: -1 };
  var LINE_NAMES = { liangzi: '量子线路', lzm3u8: '量子 M3U8', lz: '量子' };

  function byId(id) { return document.getElementById(id); }
  function setText(id, s) { var el = byId(id); if (el) el.textContent = s; }
  function say(html) { var g = byId('tvGrid'); if (g) g.innerHTML = '<p class="tv-tip">' + html + '</p>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------------- 加载中 / 加载失败（别让用户对着空屏或者一直转） ---------------- */
  var loadTimers = [];
  var loadTick = 0;
  function clearLoad() {
    loadTimers.forEach(clearTimeout);
    loadTimers = [];
    if (loadTick) { clearInterval(loadTick); loadTick = 0; }
  }

  function loadingStart(what) {
    clearLoad();
    var g = byId('tvGrid');
    if (!g) return;
    g.innerHTML = '<div class="tv-loading"><span class="tv-spin"></span><p id="tvLoadMsg">' + esc(what) +
      '</p><p class="tv-loading-hint" id="tvLoadSec">已等 0 秒</p></div>';
    var msg = function (s) { var m = byId('tvLoadMsg'); if (m) m.textContent = s; };
    var t0 = Date.now();
    /* 秒表：让用户看得见在等多久，也提醒上限是一分钟 */
    loadTick = setInterval(function () {
      var s = byId('tvLoadSec');
      if (!s) return;
      var n = Math.floor((Date.now() - t0) / 1000);
      s.textContent = '已等 ' + n + ' 秒' + (n >= 50 ? '（快到一分钟上限）' : '');
    }, 1000);
    loadTimers.push(setTimeout(function () { msg('正在逐个片源抓数据，先到的先出…'); }, 1200));
    loadTimers.push(setTimeout(function () { msg('有片源回得慢，还在等它这一页…'); }, 6000));
    loadTimers.push(setTimeout(function () { msg('还没回来。特别慢的话，点上面「片源」换一个快的。'); }, 18000));
    loadTimers.push(setTimeout(function () { msg('等了半分钟了，这个源大概率不灵 —— 建议点「片源」换一个。'); }, 35000));
  }

  function loadingFail(msg) {
    clearLoad();
    var g = byId('tvGrid');
    if (!g) return;
    g.innerHTML = '<div class="tv-loading is-fail"><i class="fas fa-circle-exclamation"></i><p>' + esc(msg) +
      '</p><button type="button" class="tv-retry" id="tvRetry"><i class="fas fa-rotate-right"></i> 重试一次</button>' +
      '<p class="tv-loading-hint">还是不行就点上面「片源」换一个源，或者过会儿再来</p></div>';
    var b = byId('tvRetry');
    if (b) b.addEventListener('click', function () { load(state.pg); });
  }

  /* ---------------- 片源切换 ---------------- */
  function renderSrcs(sources, stats) {
    if (sources && sources.length) SRCS = sources;
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
    renderSrcs(SRCS, []);
    /* 各站分类编号不通用，换了源就把分类清掉重来 */
    if (state.t) { pickCat('', 1); return; }
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
    return fetch(url, Object.assign({ mode: 'cors', credentials: 'omit' }, timeoutOpt(ms || WAIT_MAX))).then(function (r) {
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
      if (n <= 1) throw (leftMs(deadline) < 2500 ? new Error(TOO_LONG) : e);
      if (leftMs(deadline) < 2500) throw new Error(TOO_LONG);
      return new Promise(function (r) { setTimeout(r, 700); }).then(function () { return apiTry(url, deadline, n - 1); });
    });
  }

  function apiGet(params) {
    var q = qs(params);
    var deadline = Date.now() + WAIT_MAX;
    return apiTry(GATEWAY + '/api/tv?' + q, deadline, 3).catch(function (e1) {
      var rest = leftMs(deadline);
      if (rest < 3000) throw new Error(TOO_LONG + '（' + e1.message + '）');
      return jget(DIRECT + '?' + q, rest).catch(function () {
        throw new Error('代理不可用（' + e1.message + '）');
      });
    });
  }

  /* 视频流一律走代理：上游对带 Origin 的请求不给 CORS，分段也一样 */
  function streamUrl(u) { return GATEWAY + '/api/tv/stream?u=' + encodeURIComponent(u); }
  /* 海报同样经代理：图床热链保护会让直连的 <img> 拿不到图 */
  function picUrl(u) {
    var s = String(u || '');
    if (!s || s.indexOf('http') !== 0) return s;
    return GATEWAY + '/api/tv/img?u=' + encodeURIComponent(s);
  }

  /* ---------------- 分类 ---------------- */
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
        b.innerHTML = '<i class="fas fa-folder"></i><span></span>';
        b.querySelector('span').textContent = name;
        b.addEventListener('click', function () { pickCat(c.type_id, 1); });
        bar.appendChild(b);
      });
    }).catch(function (e) {
      var bar = byId('tvCats');
      if (bar) bar.innerHTML = '<span class="tv-tip">分类加载失败：' + String(e.message || e) + '</span>';
    });
  }

  function pickCat(t, pg) {
    var bar = byId('tvCats');
    if (bar) {
      Array.prototype.forEach.call(bar.querySelectorAll('.hub-chip'), function (x) {
        x.classList.toggle('is-on', String(x.getAttribute('data-t') || '') === String(t || ''));
      });
    }
    state.t = t; load(pg);
  }

  /* ---------------- 列表 ---------------- */
  function card(it) {
    var a = document.createElement('a');
    a.className = 'tv-card';
    a.href = 'javascript:void(0)';
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
      img.src = picUrl(pic);
    }
    var badge = a.querySelector('.tv-badge');
    var remark = String(it.vod_remarks || '');
    if (remark) badge.textContent = remark; else badge.remove();
    a.querySelector('.tv-name').textContent = it.vod_name || '未命名';
    a.addEventListener('click', function () { detail(it.vod_id, it._src); });
    return a;
  }

  function render(d) {
    var grid = byId('tvGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var list = (d && d.list) || [];
    var pager = byId('tvPager');
    if (!list.length) { say('没有找到资源，换个关键词试试'); if (pager) pager.hidden = true; return; }
    list.forEach(function (it) { grid.appendChild(card(it)); });
    var total = parseInt(d.total, 10) || 0;
    var limit = parseInt(d.limit, 10) || list.length || 1;
    var pages = Math.max(1, Math.ceil(total / limit));
    setText('tvPage', state.pg + ' / ' + pages);
    if (pager) pager.hidden = pages <= 1;
  }

  function load(pg) {
    if (state.busy) return;
    state.busy = true;
    state.pg = pg || 1;
    var t0 = Date.now();
    var single = state.pick && typeof state.src === 'number' ? SRCS.filter(function (s) { return s.id === state.src; }) : [];
    loadingStart(single.length ? ('正在请求「' + single[0].name + '」…') : '正在找片…');
    apiGet({ ac: 'videolist', t: state.t, pg: state.pg, wd: state.kw, _src: state.src, pick: state.pick ? 1 : '' })
      .then(function (d) {
        /* 动画最少露 500ms：太快反而像闪一下，看不清发生了什么 */
        var wait = Math.max(0, 500 - (Date.now() - t0));
        return new Promise(function (r) { setTimeout(r, wait); }).then(function () {
          clearLoad();
          if (d && typeof d._src === 'number' && !state.pick) state.src = d._src;
          if (d && d.sources) renderSrcs(d.sources, d._stats);
          render(d);
        });
      })
      .catch(function (e) {
        var pager = byId('tvPager'); if (pager) pager.hidden = true;
        var m = String(e.message || e);
        var why = /一分钟|timeout|abort/i.test(m)
          ? '这个源太慢了或者没响应'
          : /^HTTP 5/.test(m)
            ? '源站这会儿出错了'
            : /failed|fetch|network|load/i.test(m)
              ? '连不上片源（网络或代理不通）'
              : '没找到片源';
        loadingFail(why + '：' + m);
      })
      .then(function () { state.busy = false; });
  }

  /* ---------------- 详情与线路 ---------------- */
  function detail(vodId, src) {
    say('正在打开…');
    /* 聚合列表里每条自带 _src：点哪条就问哪个源要详情，编号才对得上 */
    var pin = typeof src === 'number' ? src : state.src;
    apiGet({ ac: 'videolist', ids: vodId, _src: pin }).then(function (d) {
      var it = (d && d.list && d.list[0]) || null;
      if (!it) throw new Error('没拿到该资源');
      openPlayer(it);
    }).catch(function (e) { say('打开失败：' + String(e.message || e)); });
  }

  function lineName(raw, i) {
    return LINE_NAMES[String(raw || '').toLowerCase()] || ('线路 ' + (i + 1));
  }

  function openPlayer(it) {
    var p = byId('tvPlayer');
    var eps = byId('tvEps');
    if (!p || !eps) return;
    setText('tvTitle', it.vod_name || '');
    setText('tvRemark', it.vod_remarks || '');
    if (window.TVPlayer) { TVPlayer.setTitle(it.vod_name || ''); TVPlayer.setEpisode(it.vod_remarks || ''); TVPlayer.setNav(false, false); }
    EP.list = [];
    EP.i = -1;
    eps.innerHTML = '';
    var froms = String(it.vod_play_from || '').split('$$$');
    var groups = String(it.vod_play_url || '').split('$$$');
    var firstPlayable = null;
    /* 各条线路（给播放器右上角那个「线路」菜单用，B 站那个位置是清晰度） */
    var LINES = [];
    groups.forEach(function (g, gi) {
      var parts = [];
      g.split('#').forEach(function (x) { if (x.indexOf('$') > 0) parts.push(x); });
      if (!parts.length) return;
      var urls = parts.map(function (x) { return x.slice(x.indexOf('$') + 1); });
      var playable = urls.some(function (u) { return isM3u8(u) || isMedia(u); });
      var box = document.createElement('div');
      box.className = 'tv-line';
      var lab = document.createElement('span');
      lab.className = 'tv-line-name' + (playable ? '' : ' is-html');
      lab.textContent = lineName(froms[gi], gi) + (playable ? '' : '（网页线路）');
      box.appendChild(lab);
      parts.forEach(function (part, pi) {
        var cut = part.indexOf('$');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tv-ep';
        b.textContent = part.slice(0, cut) || ('第' + (pi + 1) + '集');
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(eps.querySelectorAll('.tv-ep'), function (x) { x.classList.toggle('is-on', x === b); });
          var idx = -1;
          for (var k = 0; k < EP.list.length; k++) { if (EP.list[k].btn === b) { idx = k; break; } }
          EP.i = idx;
          if (window.TVPlayer) { TVPlayer.setNav(idx > 0, idx >= 0 && idx < EP.list.length - 1); TVPlayer.setEpisode(b.textContent || ''); }
          play(urls[pi] || '');
        });
        EP.list.push({ btn: b, url: urls[pi] || '' });
        box.appendChild(b);
      });
      eps.appendChild(box);
      if (playable) LINES.push({ name: lineName(froms[gi], gi), btn: box.querySelector('.tv-ep') });
      if (!firstPlayable && playable) firstPlayable = box.querySelector('.tv-ep');
    });
    if (window.TVPlayer) {
      TVPlayer.setQualities(
        LINES.map(function (x) { return { name: x.name }; }),
        0,
        function (i) { if (LINES[i] && LINES[i].btn) LINES[i].btn.click(); },
      );
    }
    p.hidden = false;
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
    if (p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- 播放（B 站风格那套在 js/tv-player.js） ---------------- */
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

  /* ---------------- 绑定 ---------------- */
  function boot() {
    if (window.TVPlayer) {
      TVPlayer.init({
        gateway: GATEWAY,
        onPrev: function () { if (EP.i > 0) EP.list[EP.i - 1].btn.click(); },
        onNext: function () { if (EP.i >= 0 && EP.i < EP.list.length - 1) EP.list[EP.i + 1].btn.click(); },
        onEnded: function () { if (EP.i >= 0 && EP.i < EP.list.length - 1) EP.list[EP.i + 1].btn.click(); },
      });
    }
    var go = byId('tvGo'), kw = byId('tvKw'), back = byId('tvBack');
    if (go) go.addEventListener('click', function () { state.kw = kw ? kw.value.trim() : ''; load(1); });
    if (kw) kw.addEventListener('keydown', function (e) { if (e.key === 'Enter') { state.kw = kw.value.trim(); load(1); } });
    var prev = byId('tvPrev'), next = byId('tvNext');
    if (prev) prev.addEventListener('click', function () { if (state.pg > 1) load(state.pg - 1); });
    if (next) next.addEventListener('click', function () { load(state.pg + 1); });
    if (back) back.addEventListener('click', function () {
      var p = byId('tvPlayer'); if (p) p.hidden = true;
      stopPlayer();
      load(state.pg);
    });
    if (byId('tvGrid')) loadCats().then(function () { load(1); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
