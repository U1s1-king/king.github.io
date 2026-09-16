/* ============================================================
 * 影视播放器 (js/tv-player.js)
 * ------------------------------------------------------------
 * 控件布局与交互照 B 站网页播放器做：底部控制条、悬停滑出、3 秒无操作自动隐藏、
 * 中央大播放键、双击全屏、空格/←→/↑↓/F/W/M 快捷键、倍速菜单、画中画、
 * 网页全屏（不占系统全屏）、载入转圈、失败遮罩加重试、缓冲条。
 * 播放策略：CDN 对带 Origin 的请求给 ACAO:*（实测 master/variant/TS 全 200），
 * 所以默认直连；直连失败自动经本站 Worker /api/tv/stream 再试一次。
 * 依赖：可选 hls.js（不支持原生 HLS 的浏览器）。
 * ============================================================ */
(function () {
  'use strict';

  var HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
  var MEDIA_EXT = ['.mp4', '.m4v', '.mkv', '.flv', '.avi', '.mov', '.webm', '.mp3', '.m4a'];
  var RATES = [2, 1.5, 1.25, 1, 0.75, 0.5];

  var D = {};
  var cfg = {};
  var hls = null;
  var hlsLoading = false;
  var cur = '';
  var retriedProxy = false;
  var hideTimer = 0;
  var clickTimer = 0;
  var volBeforeMute = 1;
  var dragging = 0;
  /* 加载看门狗：再慢也不能一直转圈，到点就报错让人换线路 */
  var watchdog = 0;

  function $(id) { return document.getElementById(id); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function fmt(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    var mm = (m < 10 ? '0' : '') + m;
    return (h > 0 ? h + ':' : '') + mm + ':' + (x < 10 ? '0' : '') + x;
  }

  function classify(url) {
    var s = String(url || '');
    if (s.indexOf('/share/') >= 0) return 'page';
    var p = s.split('?')[0].toLowerCase();
    for (var i = 0; i < MEDIA_EXT.length; i++) if (p.slice(-MEDIA_EXT[i].length) === MEDIA_EXT[i]) return 'media';
    return 'hls';
  }

  function toast(msg) {
    if (!D.toast) return;
    D.toast.textContent = msg;
    D.toast.hidden = false;
    D.toast.classList.add('on');
    clearTimeout(D.toast._t);
    D.toast._t = setTimeout(function () { D.toast.classList.remove('on'); }, 1200);
  }

  function showErr(msg) {
    if (!D.err) return;
    if (D.errMsg) D.errMsg.textContent = msg;
    D.err.hidden = false;
    setSpin(false);
  }
  function hideErr() { if (D.err) D.err.hidden = true; }

  function setSpin(on) { if (D.spin) D.spin.hidden = !on; }

  function setIcon(btn, names) {
    if (!btn) return;
    var i = btn.querySelector('i');
    if (!i) return;
    names.forEach(function (n) { i.classList.toggle(n, true); });
  }
  function switchIcon(btn, remove, add) {
    if (!btn) return;
    var i = btn.querySelector('i');
    if (!i) return;
    i.classList.remove(remove);
    i.classList.add(add);
  }

  function playing() { return !!(D.video && !D.video.paused && !D.video.ended); }

  function syncPlayIcon() {
    var on = playing();
    switchIcon(D.play, on ? 'fa-play' : 'fa-pause', on ? 'fa-pause' : 'fa-play');
    if (D.big) D.big.hidden = on;
  }

  function showUI() {
    if (!D.stage) return;
    D.stage.classList.add('show-ui');
    D.stage.classList.remove('is-idle');
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    showUI();
    hideTimer = setTimeout(function () {
      if (!D.stage || !playing() || D.menu && !D.menu.hidden || dragging) return;
      D.stage.classList.remove('show-ui');
      if (!D.err || D.err.hidden) D.stage.classList.add('is-idle');
    }, 3000);
  }

  function setTime() {
    if (!D.video) return;
    var d = D.video.duration || 0, t = D.video.currentTime || 0;
    if (D.cur) D.cur.textContent = fmt(t);
    if (D.dur) D.dur.textContent = fmt(d);
    if (D.played) D.played.style.width = (d > 0 ? Math.min(100, (t / d) * 100) : 0) + '%';
  }

  function setBuffer() {
    if (!D.video || !D.buf) return;
    var d = D.video.duration || 0;
    if (!d) { D.buf.style.width = '0%'; return; }
    var b = D.video.buffered, end = 0;
    for (var i = 0; i < b.length; i++) if (b.start(i) <= D.video.currentTime + 0.5) end = Math.max(end, b.end(i));
    D.buf.style.width = Math.min(100, (end / d) * 100) + '%';
  }

  function seekTo(t) {
    if (!D.video) return;
    var d = D.video.duration || 0;
    D.video.currentTime = Math.max(0, Math.min(d ? d - 0.2 : t, t));
    setTime();
  }
  function ratioAt(e) {
    var r = D.track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
  }

  function setVolume(v, save) {
    if (!D.video) return;
    v = Math.max(0, Math.min(1, v));
    D.video.volume = v;
    D.video.muted = v === 0;
    if (D.volVal) D.volVal.style.width = (v * 100) + '%';
    switchIcon(D.mute, v === 0 ? 'fa-volume-high' : 'fa-volume-xmark', v === 0 ? 'fa-volume-xmark' : 'fa-volume-high');
    if (v > 0) volBeforeMute = v;
    if (save) store('tvp.vol', String(v));
  }

  function setRate(r) {
    if (!D.video) return;
    D.video.playbackRate = r;
    if (D.rate) D.rate.textContent = (r === Math.floor(r) ? r.toFixed(1) : String(r)) + 'x';
    store('tvp.rate', String(r));
    if (D.menu) {
      Array.prototype.forEach.call(D.menu.querySelectorAll('button'), function (b) {
        b.classList.toggle('is-on', Number(b.getAttribute('data-r')) === r);
      });
    }
    toast('倍速 ' + r + 'x');
  }

  function buildMenu() {
    if (!D.menu) return;
    D.menu.innerHTML = '';
    RATES.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-r', String(r));
      b.textContent = r + 'x';
      b.addEventListener('click', function () {
        setRate(r);
        D.menu.hidden = true;
      });
      D.menu.appendChild(b);
    });
  }

  function toggle() {
    if (!D.video) return;
    hideErr();
    if (playing()) D.video.pause();
    else D.video.play().catch(function () { showUI(); });
  }
  function seekBy(s) { if (D.video) seekTo(D.video.currentTime + s); }

  function setNav(hasPrev, hasNext) {
    if (D.prev) D.prev.disabled = !hasPrev;
    if (D.next) D.next.disabled = !hasNext;
  }

  function webFullOn() { return D.stage && D.stage.classList.contains('is-web-full'); }
  function toggleWebFull() {
    if (!D.stage) return;
    var on = D.stage.classList.toggle('is-web-full');
    document.documentElement.style.overflow = on ? 'hidden' : '';
    switchIcon(D.web, on ? 'fa-arrows-left-right' : 'fa-arrows-left-right', on ? 'fa-compress' : 'fa-expand');
    if (D.full) D.full.hidden = on;
    toast(on ? '网页全屏' : '退出网页全屏');
  }
  function toggleFull() {
    if (!D.stage) return;
    var d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    } else {
      var fn = D.stage.requestFullscreen || D.stage.webkitRequestFullscreen;
      if (fn) fn.call(D.stage).catch(function () {});
    }
  }
  function togglePip() {
    if (!D.video) return;
    var d = document;
    try {
      if (d.pictureInPictureElement) d.exitPictureInPicture();
      else if (D.video.requestPictureInPicture) D.video.requestPictureInPicture();
    } catch (e) {}
  }

  function loadHls(cb) {
    if (window.Hls) { cb(); return; }
    if (hlsLoading) { setTimeout(function () { cb(); }, 400); return; }
    hlsLoading = true;
    var s = document.createElement('script');
    s.src = HLS_SRC;
    s.onload = cb;
    s.onerror = function () { showErr('hls.js 没能加载（网络或被拦截）。iOS/Safari 可用系统原生播放。'); };
    document.head.appendChild(s);
  }

  function destroyHls() {
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e2) {} window.__tvHls = null; }
  }

  function playNative(url, viaProxy) {
    var v = D.video;
    v.onerror = function () {
      if (viaProxy || retriedProxy) { showErr('这条线路播不动，换一条试试。'); return; }
      retriedProxy = true;
      toast('直连失败，改走本站代理重试…');
      playNative(url, true);
    };
    v.src = viaProxy ? cfg.gateway + '/api/tv/stream?u=' + encodeURIComponent(url) : url;
    var p = v.play();
    if (p && p.catch) p.catch(function () { showUI(); });
  }

  function playHls(url, viaProxy) {
    var v = D.video;
    var src = viaProxy ? cfg.gateway + '/api/tv/stream?u=' + encodeURIComponent(url) : url;
    if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
      playNative(url, viaProxy);
      return;
    }
    setSpin(true);
    loadHls(function () {
      if (!window.Hls || !window.Hls.isSupported()) { showErr('当前浏览器不支持 HLS 播放。'); return; }
      destroyHls();
      hls = new window.Hls({ maxBufferLength: 30, enableWorker: true });
      window.__tvHls = hls;
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        setSpin(false);
        var p = v.play();
        if (p && p.catch) p.catch(function () { showUI(); });
      });
      hls.on(window.Hls.Events.ERROR, function (ev, data) {
        if (!data || !data.fatal) return;
        destroyHls();
        if (!viaProxy && !retriedProxy) {
          retriedProxy = true;
          toast('直连失败，改走本站代理重试…');
          playHls(url, true);
          return;
        }
        showErr('这条流播放失败（' + data.type + ' / ' + data.details + '），换条线路或到原地址看。');
      });
    });
  }

  function play(url) {
    if (!D.video || !url) return false;
    if (classify(url) === 'page') return false;
    cur = url;
    retriedProxy = false;
    clearTimeout(watchdog);
    watchdog = setTimeout(function () {
      if (!D.video || playing() || D.video.readyState >= 3) return;
      showErr('这个源加载太慢或者没响应（等满一分钟了）。点重试，或者回列表换一条线路。');
    }, 60000);
    /* 播放器一开就把看板娘收起来，免得她压住右侧按钮 */
    document.documentElement.classList.add('tvp-open');
    hideErr();
    setSpin(true);
    destroyHls();
    var kind = classify(url);
    if (kind === 'media') {
      D.video.src = url;
      var p = D.video.play();
      if (p && p.catch) p.catch(function () { showUI(); });
      setSpin(false);
      return true;
    }
    playHls(url, false);
    return true;
  }

  function stop() {
    clearTimeout(watchdog);
    document.documentElement.classList.remove('tvp-open');
    destroyHls();
    var v = D.video;
    if (v) {
      try { v.pause(); } catch (e) {}
      v.removeAttribute('src');
      try { v.load(); } catch (e2) {}
    }
    setSpin(false);
    hideErr();
    setTime();
  }

  function onKey(e) {
    if (!D.stage || D.stage.offsetParent === null) return;
    var t = e.target || {};
    var tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || t.isContentEditable) return;
    var k = e.key;
    if (k === ' ' || k === 'Spacebar' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seekBy(-5); toast('-5 秒'); }
    else if (k === 'ArrowRight') { e.preventDefault(); seekBy(5); toast('+5 秒'); }
    else if (k === 'ArrowUp') { e.preventDefault(); setVolume(D.video.volume + 0.05, true); toast('音量 ' + Math.round(D.video.volume * 100) + '%'); }
    else if (k === 'ArrowDown') { e.preventDefault(); setVolume(D.video.volume - 0.05, true); toast('音量 ' + Math.round(D.video.volume * 100) + '%'); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); toggleFull(); }
    else if (k === 'w' || k === 'W') { e.preventDefault(); toggleWebFull(); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); setVolume(D.video.muted ? (volBeforeMute || 1) : 0, true); toast(D.video.muted ? '已静音' : '取消静音'); }
    else if (k >= '0' && k <= '9' && D.video.duration) { D.video.currentTime = D.video.duration * (Number(k) / 10); }
  }

  function bind() {
    var v = D.video, st = D.stage;
    ['playing', 'pause', 'ended'].forEach(function (ev) { v.addEventListener(ev, function () { syncPlayIcon(); setTime(); }); });
    v.addEventListener('timeupdate', function () { setTime(); setBuffer(); });
    v.addEventListener('progress', setBuffer);
    v.addEventListener('loadedmetadata', function () { clearTimeout(watchdog); setTime(); hideErr(); setSpin(false); });
    v.addEventListener('playing', function () { clearTimeout(watchdog); hideErr(); setSpin(false); });
    v.addEventListener('waiting', function () { setSpin(true); });
    v.addEventListener('canplay', function () { setSpin(false); });
    v.addEventListener('error', function () { if (!hls) showErr('视频加载失败，换一条线路或重试。'); });
    v.addEventListener('ended', function () { if (cfg.onEnded) cfg.onEnded(); });
    v.addEventListener('dblclick', function () { clearTimeout(clickTimer); toggleFull(); });
    v.addEventListener('click', function () {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(toggle, 220);
    });

    st.addEventListener('pointermove', scheduleHide);
    st.addEventListener('pointerdown', scheduleHide);

    if (D.play) D.play.addEventListener('click', toggle);
    if (D.big) D.big.addEventListener('click', toggle);
    if (D.retry) D.retry.addEventListener('click', function () { if (cur) play(cur); });
    if (D.prev) D.prev.addEventListener('click', function () { if (cfg.onPrev) cfg.onPrev(); });
    if (D.next) D.next.addEventListener('click', function () { if (cfg.onNext) cfg.onNext(); });
    if (D.mute) D.mute.addEventListener('click', function () {
      setVolume(D.video.muted || D.video.volume === 0 ? (volBeforeMute || 1) : 0, true);
      toast(D.video.muted ? '已静音' : '取消静音');
    });
    if (D.pip) D.pip.addEventListener('click', togglePip);
    if (D.web) D.web.addEventListener('click', toggleWebFull);
    if (D.full) D.full.addEventListener('click', toggleFull);
    if (D.rate) D.rate.addEventListener('click', function (e) { e.stopPropagation(); D.menu.hidden = !D.menu.hidden; });
    document.addEventListener('click', function (e) { if (D.menu && !D.menu.hidden && !D.menu.contains(e.target) && e.target !== D.rate) D.menu.hidden = true; });

    /* 进度条：按下即拖拽（B 站那样拖到哪跳到哪） */
    D.track.addEventListener('pointerdown', function (e) {
      dragging = 1;
      D.track.classList.add('is-drag');
      try { D.track.setPointerCapture(e.pointerId); } catch (er) {}
      if (D.video.duration) seekTo(ratioAt(e) * D.video.duration);
    });
    D.track.addEventListener('pointermove', function (e) {
      var r = ratioAt(e);
      if (D.hover) {
        D.hover.style.left = (r * 100) + '%';
        D.hover.textContent = fmt((D.video.duration || 0) * r);
      }
      if (dragging && D.video.duration) seekTo(r * D.video.duration);
    });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      D.track.addEventListener(ev, function () { dragging = 0; D.track.classList.remove('is-drag'); });
    });

    /* 音量条 */
    function volAt(e) {
      var r = D.volWrap.getBoundingClientRect();
      setVolume((e.clientX - r.left) / (r.width || 1), true);
    }
    D.volWrap.addEventListener('pointerdown', function (e) {
      D.volWrap.classList.add('is-drag');
      try { D.volWrap.setPointerCapture(e.pointerId); } catch (er) {}
      volAt(e);
    });
    D.volWrap.addEventListener('pointermove', function (e) { if (D.volWrap.classList.contains('is-drag')) volAt(e); });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      D.volWrap.addEventListener(ev, function () { D.volWrap.classList.remove('is-drag'); });
    });

    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', function () {
      var on = !!document.fullscreenElement;
      switchIcon(D.full, on ? 'fa-expand' : 'fa-compress', on ? 'fa-compress' : 'fa-expand');
    });
    document.addEventListener('visibilitychange', function () { scheduleHide(); });
  }

  function init(options) {
    cfg = options || {};
    if (!cfg.gateway) cfg.gateway = '';
    D.stage = cfg.stage || $('tvp');
    D.video = cfg.video || $('tvVideo');
    if (!D.stage || !D.video) return false;
    D.top = $('tvpTop');
    D.name = $('tvpName');
    D.ep = $('tvpEp');
    D.big = $('tvpBig');
    D.spin = $('tvpSpin');
    D.err = $('tvpErr');
    D.errMsg = $('tvpErrMsg');
    D.retry = $('tvpRetry');
    D.toast = $('tvpToast');
    D.bar = $('tvpBar');
    D.play = $('tvpPlay');
    D.prev = $('tvpPrev');
    D.next = $('tvpNext');
    D.cur = $('tvpCur');
    D.dur = $('tvpDur');
    D.track = $('tvpTrack');
    D.buf = $('tvpBuf');
    D.played = $('tvpPlayed');
    D.hover = $('tvpHover');
    D.mute = $('tvpMute');
    D.volWrap = $('tvpVolWrap');
    D.volVal = $('tvpVolVal');
    D.rate = $('tvpRate');
    D.pip = $('tvpPip');
    D.web = $('tvpWeb');
    D.full = $('tvpFull');
    D.menu = $('tvpMenu');
    buildMenu();
    setVolume(Number(store('tvp.vol') === null ? 1 : store('tvp.vol')), false);
    setRate(Number(store('tvp.rate') || 1));
    bind();
    syncPlayIcon();
    setTime();
    return true;
  }

  window.TVPlayer = {
    init: init,
    play: play,
    stop: stop,
    classify: classify,
    toast: toast,
    showErr: showErr,
    setTitle: function (t) { if (D.name) D.name.textContent = t || ''; },
    setEpisode: function (t) { if (D.ep) D.ep.textContent = t || ''; },
    setNav: setNav,
    seekBy: seekBy,
    getVideo: function () { return D.video; },
  };
})();
