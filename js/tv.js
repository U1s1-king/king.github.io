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

  var state = { t: '', pg: 1, kw: '', busy: false };
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

  function jget(url) {
    return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (r) {
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
  function apiGet(params) {
    var q = qs(params);
    return jget(GATEWAY + '/api/tv?' + q).catch(function (e1) {
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
    if (pic) a.querySelector('img').src = picUrl(pic);
    var badge = a.querySelector('.tv-badge');
    var remark = String(it.vod_remarks || '');
    if (remark) badge.textContent = remark; else badge.remove();
    a.querySelector('.tv-name').textContent = it.vod_name || '未命名';
    a.addEventListener('click', function () { detail(it.vod_id); });
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
    apiGet({ ac: 'videolist', t: state.t, pg: state.pg, wd: state.kw }).then(function (d) {
      render(d);
    }).catch(function (e) {
      say('片源暂时不可用：' + String(e.message || e) + '<br><span style="font-size:.8rem">（若是刚更新，可能 Worker 还没重新部署）</span>');
      var pager = byId('tvPager'); if (pager) pager.hidden = true;
    }).then(function () { state.busy = false; });
  }

  /* ---------------- 详情与线路 ---------------- */
  function detail(vodId) {
    say('正在打开…');
    apiGet({ ac: 'videolist', ids: vodId }).then(function (d) {
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
          play(urls[pi] || '');
        });
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

  /* ---------------- 播放 ---------------- */
  var hlsLoading = false;
  function stopPlayer() {
    var v = byId('tvVideo');
    if (v) { try { v.pause(); } catch (e) {} v.removeAttribute('src'); try { v.load(); } catch (e2) {} }
    if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e3) {} window.__tvHls = null; }
  }
  function loadHls(cb) {
    if (window.Hls) { cb(); return; }
    if (hlsLoading) { setTimeout(function () { cb(); }, 400); return; }
    hlsLoading = true;
    var s = document.createElement('script');
    s.src = HLS_JS;
    s.onload = cb;
    s.onerror = function () { setText('tvNote', 'hls.js 没能加载（网络或被拦截），iOS/Safari 仍可原生播放'); };
    document.head.appendChild(s);
  }

  function play(url) {
    var v = byId('tvVideo');
    if (!url) { setText('tvNote', '这条线路没有地址'); return; }
    if (!v) { setText('tvNote', '页面缺少播放器容器'); return; }
    if (isPage(url)) {
      stopPlayer();
      noteWithLink('这条是网页播放线路（返回 HTML，不是视频流），浏览器跨域播不了。', url);
      return;
    }
    if (isMedia(url)) {
      stopPlayer();
      v.src = url;
      var p0 = v.play(); if (p0 && p0.catch) p0.catch(function () {});
      setText('tvNote', '直链播放：' + url);
      return;
    }
    /* m3u8：实测 CDN 对带 Origin 的请求照样回 Access-Control-Allow-Origin:*，
       所以直连最省事、也绕开了「Worker 拉流可能被 CDN 按客户端指纹判掉」的坑；
       直连真失败再自动转一次本站代理兜底。 */
    playM3u8(url, false, false);
  }

  function playM3u8(url, viaProxy, retried) {
    var v = byId('tvVideo');
    if (!v) { setText('tvNote', '页面缺少播放器容器'); return; }
    var src = viaProxy ? streamUrl(url) : url;
    var tag = viaProxy ? ' · 经本站代理' : ' · 直连';
    setText('tvNote', '正在加载：' + url);
    stopPlayer();
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.onerror = function () {
        if (viaProxy || retried) return;
        v.onerror = null;
        playM3u8(url, true, true);
      };
      v.src = src;
      var p1 = v.play(); if (p1 && p1.catch) p1.catch(function () {});
      setText('tvNote', '系统播放器（原生 HLS）' + tag);
      return;
    }
    loadHls(function () {
      if (!window.Hls || !window.Hls.isSupported()) { setText('tvNote', '当前浏览器不支持 HLS 播放'); return; }
      if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e) {} }
      var h = new window.Hls({ maxBufferLength: 30, enableWorker: true });
      window.__tvHls = h;
      h.loadSource(src);
      h.attachMedia(v);
      h.on(window.Hls.Events.MANIFEST_PARSED, function () {
        var p2 = v.play(); if (p2 && p2.catch) p2.catch(function () {});
        setText('tvNote', 'hls.js 播放中' + tag);
      });
      h.on(window.Hls.Events.ERROR, function (ev, data) {
        if (!data || !data.fatal) return;
        try { h.destroy(); } catch (e2) {}
        window.__tvHls = null;
        if (!viaProxy && !retried) { setText('tvNote', '直连失败，改走本站代理重试…'); playM3u8(url, true, true); return; }
        noteWithLink('这条流播放失败（' + data.type + ' / ' + data.details + '），换条线路或去原地址看。', url);
      });
    });
  }

  /* ---------------- 绑定 ---------------- */
  function boot() {
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
