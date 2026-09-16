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
  var state = { t: '', pg: 1, kw: '', src: null, busy: false };
  /* 扁平化的选集列表，给播放器的上一集/下一集/自动连播用 */
  var EP = { list: [], i: -1 };
  var LINE_NAMES = { liangzi: '量子线路', lzm3u8: '量子 M3U8', lz: '量子' };

  function byId(id) { return document.getElementById(id); }
  function setText(id, s) { var el = byId(id); if (el) el.textContent = s; }
  function say(html) { var g = byId('tvGrid'); if (g) g.innerHTML = '<p class="tv-tip">' + html + '</p>'; }

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

  /* 浏览器端超时：CF 边缘偶尔会把响应传到一半卡住，不能干等 */
  function timeoutOpt(ms) {
    try {
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return { signal: AbortSignal.timeout(ms) };
    } catch (e) {}
    return {};
  }

  function jget(url) {
    return fetch(url, Object.assign({ mode: 'cors', credentials: 'omit' }, timeoutOpt(12000))).then(function (r) {
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
  function apiTry(url, n) {
    return jget(url).catch(function (e) {
      if (n > 1) {
        return new Promise(function (r) { setTimeout(r, 700); }).then(function () { return apiTry(url, n - 1); });
      }
      throw e;
    });
  }

  function apiGet(params) {
    var q = qs(params);
    return apiTry(GATEWAY + '/api/tv?' + q, 3).catch(function (e1) {
      return jget(DIRECT + '?' + q).catch(function () {
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
      if (d && typeof d._src === 'number') state.src = d._src;
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
    say('正在加载…');
    apiGet({ ac: 'videolist', t: state.t, pg: state.pg, wd: state.kw, _src: state.src }).then(function (d) {
      if (d && typeof d._src === 'number') state.src = d._src;
      render(d);
    }).catch(function (e) {
      say('片源暂时不可用：' + String(e.message || e) + '<br><span style="font-size:.8rem">（若是刚更新，可能 Worker 还没重新部署）</span>');
      var pager = byId('tvPager'); if (pager) pager.hidden = true;
    }).then(function () { state.busy = false; });
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
      if (!firstPlayable && playable) firstPlayable = box.querySelector('.tv-ep');
    });
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
