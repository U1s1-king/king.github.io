/* ============================================================
 * 影视页 (js/tv.js)
 * ------------------------------------------------------------
 * 数据来自公开的苹果 CMS 采集接口。建页时逐个实测，结论：
 *   cj.lziapi.com（量子）  接口 CORS YES；搜索/列表/详情/分页都正常
 *   └ lzm3u8 线路           真 m3u8 流，master/variant/TS 段带 CORS，段实测 206
 *   └ liangzi 线路          返回 text/html 的网页播放页，浏览器跨域播不了（CSP 也不许 iframe）
 *   其余候选源（heimuer / ffzy / dyttzy / wolong / wujin / maotaizy …）
 *   要么 DNS 已死、要么 200 但不给 Access-Control-Allow-Origin —— 浏览器读不到，
 *   所以一个都不放，宁可源少也不要「列表能看到、点开必死」。
 * 播放：真 m3u8 交 hls.js（jsDelivr，站点 CSP 已放行），Safari 走原生 HLS；
 *       网页线路不硬塞进播放器，直接给一个新标签页入口。
 * ============================================================ */
(function () {
  'use strict';

  var API = 'https://cj.lziapi.com/api.php/provide/vod/';
  var HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
  /* 采集站分类里常见成人向栏目，站点是公开页面，直接不展示 */
  var BLOCK = /伦理|福利|里番|情色|成人|无码|色情|自拍|偷拍|人妖|淫/;
  /* 只有这些后缀才是能直接塞进 <video> 的直链 */
  var MEDIA_RE = /\.(mp4|m4v|mkv|flv|avi|mov|webm|mp3|m4a)(\?|$)/i;
  /* 网页播放页（非直链流），交给新标签页 */
  var PAGE_RE = /\/share\//i;

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
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener nofollow';
    a.textContent = '在新标签页打开 ›';
    note.appendChild(a);
  }

  function jget(url) {
    return fetch(url, { mode: 'cors', credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      t = t.replace(/^\uFEFF/, '').trim();
      try { return JSON.parse(t); } catch (e) {
        var m = t.match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* 落到下面的错误 */ } }
        throw new Error('片源返回的不是合法 JSON');
      }
    });
  }

  function apiUrl(params) {
    var q = [];
    for (var k in params) { if (params[k] !== '' && params[k] !== undefined) q.push(k + '=' + encodeURIComponent(params[k])); }
    return API + '?' + q.join('&');
  }

  /* ---------------- 分类 ---------------- */
  function loadCats() {
    return jget(apiUrl({ ac: 'list' })).then(function (d) {
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
      if (bar) bar.innerHTML = '<span class="tv-tip">分类加载失败：' + e.message + '</span>';
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
    if (pic) a.querySelector('img').src = pic;
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
    if (!list.length) { say('没有找到资源，换个关键词试试'); byId('tvPager').hidden = true; return; }
    list.forEach(function (it) { grid.appendChild(card(it)); });
    var total = parseInt(d.total, 10) || 0;
    var limit = parseInt(d.limit, 10) || list.length;
    var pages = Math.max(1, Math.ceil(total / limit));
    setText('tvPage', state.pg + ' / ' + pages);
    byId('tvPager').hidden = pages <= 1;
  }

  function load(pg) {
    if (state.busy) return;
    state.busy = true;
    state.pg = pg || 1;
    say('正在加载…');
    jget(apiUrl({ ac: 'videolist', t: state.t, pg: state.pg, wd: state.kw })).then(function (d) {
      render(d);
    }).catch(function (e) {
      say('片源暂时不可用：' + e.message + '<br><span style="font-size:.8rem">（第三方采集站可能换域名了，稍后再试）</span>');
      byId('tvPager').hidden = true;
    }).then(function () { state.busy = false; });
  }

  /* ---------------- 详情与线路 ---------------- */
  function detail(vodId) {
    say('正在打开…');
    jget(apiUrl({ ac: 'videolist', ids: vodId })).then(function (d) {
      var it = (d && d.list && d.list[0]) || null;
      if (!it) throw new Error('没拿到该资源');
      openPlayer(it);
    }).catch(function (e) { say('打开失败：' + e.message); });
  }

  function lineName(raw, i) {
    return LINE_NAMES[String(raw || '').toLowerCase()] || ('线路 ' + (i + 1));
  }

  function openPlayer(it) {
    var p = byId('tvPlayer');
    if (!p) return;
    setText('tvTitle', it.vod_name || '');
    setText('tvRemark', it.vod_remarks || '');
    var eps = byId('tvEps');
    eps.innerHTML = '';
    var froms = String(it.vod_play_from || '').split('$$$');
    var groups = String(it.vod_play_url || '').split('$$$');
    var firstPlayable = null;
    groups.forEach(function (g, gi) {
      var parts = g.split('#').filter(function (x) { return x.indexOf('$') > 0; });
      if (!parts.length) return;
      var urls = parts.map(function (x) { return x.slice(x.indexOf('$') + 1); });
      var playable = urls.some(function (u) { return /\.m3u8(\?|$)/i.test(u); });
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
          play(urls[pi]);
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
      if (any) { any.click(); noteWithLink('这个资源只有网页线路，浏览器里播不了。', groups.length ? (String(it.vod_play_url || '').split('$$$')[0].split('#')[0].split('$')[1] || '') : ''); }
      else setText('tvNote', '这个资源没有可播放的地址');
    }
    if (p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- 播放 ---------------- */
  var hlsLoaded = false;
  function loadHls(cb) {
    if (window.Hls) { cb(); return; }
    if (hlsLoaded) { setTimeout(function () { cb(); }, 400); return; }
    hlsLoaded = true;
    var s = document.createElement('script');
    s.src = HLS_JS;
    s.onload = cb;
    s.onerror = function () { setText('tvNote', 'hls.js 没能加载（网络或被拦截），可以点上面任一集数标题后重试'); };
    document.head.appendChild(s);
  }

  function play(url) {
    var v = byId('tvVideo');
    if (!url) { setText('tvNote', '这条线路没有地址'); return; }
    if (PAGE_RE.test(url)) {
      v.pause();
      v.removeAttribute('src');
      try { v.load(); } catch (e) {}
      if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e2) {} window.__tvHls = null; }
      noteWithLink('这条是网页播放线路（返回 HTML，不是视频流），浏览器跨域播不了。', url);
      return;
    }
    if (MEDIA_RE.test(url)) {
      v.src = url;
      v.play().catch(function () {});
      setText('tvNote', '直链播放：' + url);
      return;
    }
    setText('tvNote', '正在加载：' + url);
    if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = url;
      v.play().catch(function () {});
      setText('tvNote', '系统播放器（原生 HLS）');
      return;
    }
    loadHls(function () {
      if (!window.Hls || !window.Hls.isSupported()) { setText('tvNote', '当前浏览器不支持 HLS 播放'); return; }
      if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e) {} }
      var h = new window.Hls({ maxBufferLength: 30, enableWorker: true });
      window.__tvHls = h;
      h.loadSource(url);
      h.attachMedia(v);
      h.on(window.Hls.Events.MANIFEST_PARSED, function () {
        v.play().catch(function () {});
        setText('tvNote', 'hls.js 播放中：' + url);
      });
      h.on(window.Hls.Events.ERROR, function (ev, data) {
        if (!data || !data.fatal) return;
        try { h.destroy(); } catch (e) {}
        window.__tvHls = null;
        v.src = url;
        var ok = v.play();
        if (ok && ok.catch) ok.catch(function () {});
        noteWithLink('这条流的 hls.js 播放失败（' + data.type + ' / ' + data.details + '），已尝试直链；还不行就去原地址看。', url);
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
      var v = byId('tvVideo');
      if (v) { v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) {} }
      if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e2) {} window.__tvHls = null; }
      load(state.pg);
    });
    loadCats().then(function () { load(1); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
