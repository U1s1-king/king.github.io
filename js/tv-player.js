/* ============================================================
 * 影视播放器 (js/tv-player.js)
 * ------------------------------------------------------------
 * 交互按 bilibili 网页播放器抄（结构见 css/tv-player.css 顶部注释里的实测数值），
 * 只有主题色换成站点粉。含：底部控制条（左：播放/暂停·上/下一集·时间；
 * 右：线路·倍速·音量·设置·画中画·宽屏·网页全屏·全屏）、进度条可拖拽+缓冲+悬停时间、
 * 音量悬停展开、倍速/线路/设置三个菜单、悬停气泡提示、双击全屏、
 * 空格/←→/↑↓/M/F/W/T/0-9 快捷键、3 秒自动隐藏、加载看门狗（满一分钟报错）。
 * 播放策略：CDN 直连为主（实测带 Origin 也给 ACAO:*），失败自动经 /api/tv/stream 重试一次。
 * ============================================================ */
(function () {
  'use strict';

  var HLS_SRC = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
  var MEDIA_EXT = ['.mp4', '.m4v', '.mkv', '.flv', '.avi', '.mov', '.webm', '.mp3', '.m4a'];
  var RATES = [2, 1.5, 1.25, 1, 0.75, 0.5];
  var FITS = [
    { k: 'contain', n: '适应' },
    { k: 'cover', n: '填充' },
    { k: '16:9', n: '16:9' },
    { k: '4:3', n: '4:3' },
  ];
  var SVG_VOL = '<svg viewBox="0 0 28 28"><path d="M6 11.4h3.6L14 7.2v13.6l-4.4-4.2H6z"/><path d="M17.4 10.6a5 5 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20.3 8a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  var SVG_MUTE = '<svg viewBox="0 0 28 28"><path d="M6 11.4h3.6L14 7.2v13.6l-4.4-4.2H6z"/><path d="M17.6 11 23 16.4M23 11l-5.4 5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';

  var D = {};
  var cfg = {};
  var S = { rate: 1, fit: 'contain', loop: false, autonext: true };
  var hls = null;
  var hlsLoading = false;
  var cur = '';
  var hideTimer = 0;
  var clickTimer = 0;
  var watchdog = 0;
  var volBeforeMute = 1;
  var dragging = 0;
  var quals = [];

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
  function showErr(msg) { if (!D.err) return; if (D.errMsg) D.errMsg.textContent = msg; D.err.hidden = false; setSpin(false); }
  function hideErr() { if (D.err) D.err.hidden = true; }
  function setSpin(on) { if (D.spin) D.spin.hidden = !on; }
  function playing() { return !!(D.video && !D.video.paused && !D.video.ended); }
  function syncPlayIcon() { if (D.play) D.play.classList.toggle('is-pause', playing()); if (D.big) D.big.hidden = playing(); }

  function showUI() { if (D.stage) { D.stage.classList.add('show-ui'); D.stage.classList.remove('is-idle'); } }
  function scheduleHide() {
    clearTimeout(hideTimer);
    showUI();
    hideTimer = setTimeout(function () {
      if (!D.stage || !playing() || dragging || openMenu()) return;
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

  /* ---------------- 菜单 ---------------- */
  function menus() { return [D.rateMenu, D.qualMenu, D.setMenu].filter(Boolean); }
  function openMenu() { return menus().filter(function (m) { return !m.hidden; })[0] || null; }
  function closeMenus() { menus().forEach(function (m) { m.hidden = true; }); }
  function toggleMenu(m) {
    if (!m) return;
    var was = m.hidden;
    closeMenus();
    m.hidden = !was;
    if (!m.hidden) showUI();
  }
  function menuBtn(list, label, on) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (on) b.classList.add('is-on');
    return b;
  }

  function buildRateMenu() {
    if (!D.rateMenu) return;
    D.rateMenu.innerHTML = '';
    RATES.forEach(function (r) {
      var b = menuBtn(RATES, (r === Math.floor(r) ? r.toFixed(1) : String(r)) + 'x', r === S.rate);
      b.addEventListener('click', function () { setRate(r); closeMenus(); });
      D.rateMenu.appendChild(b);
    });
  }
  function buildSetMenu() {
    if (!D.setMenu) return;
    D.setMenu.innerHTML = '';
    var loop = menuBtn(0, '循环播放', S.loop);
    loop.addEventListener('click', function () {
      S.loop = !S.loop;
      if (D.video) D.video.loop = S.loop;
      buildSetMenu();
      toast(S.loop ? '循环播放：开' : '循环播放：关');
    });
    D.setMenu.appendChild(loop);
    var an = menuBtn(0, '自动连播', S.autonext);
    an.addEventListener('click', function () { S.autonext = !S.autonext; buildSetMenu(); toast(S.autonext ? '自动连播：开' : '自动连播：关'); });
    D.setMenu.appendChild(an);
    FITS.forEach(function (f) {
      var b = menuBtn(0, '画面 ' + f.n, S.fit === f.k);
      b.addEventListener('click', function () { setFit(f.k); buildSetMenu(); toast('画面比例：' + f.n); });
      D.setMenu.appendChild(b);
    });
  }
  /* 线路菜单：tv.js 把各条线路传进来（B 站那个位置是清晰度，我们换成线路） */
  function setQualities(list, active, onPick) {
    quals = list || [];
    if (D.qualMenu) {
      D.qualMenu.innerHTML = '';
      quals.forEach(function (q, i) {
        var b = menuBtn(0, q.name || '线路 ' + (i + 1), i === active);
        b.addEventListener('click', function () {
          closeMenus();
          updateQualBtn(q);
          if (onPick) onPick(i);
        });
        D.qualMenu.appendChild(b);
      });
    }
    updateQualBtn(quals[active]);
  }
  function updateQualBtn(q) {
    if (D.qualName) D.qualName.textContent = (q && q.name) || '自动';
    if (D.qual) D.qual.hidden = quals.length < 2;
    if (D.qualMenu) {
      Array.prototype.forEach.call(D.qualMenu.querySelectorAll('button'), function (b, i) { b.classList.toggle('is-on', i === quals.indexOf(q)); });
    }
  }

  function setVolume(v, save) {
    if (!D.video) return;
    v = Math.max(0, Math.min(1, v));
    D.video.volume = v;
    D.video.muted = v === 0;
    if (D.volVal) D.volVal.style.width = (v * 100) + '%';
    if (D.mute) D.mute.innerHTML = v === 0 ? SVG_MUTE : SVG_VOL;
    if (v > 0) volBeforeMute = v;
    if (save) store('tvp.vol', String(v));
  }
  function setRate(r) {
    if (!D.video) return;
    S.rate = r;
    D.video.playbackRate = r;
    store('tvp.rate', String(r));
    buildRateMenu();
    toast('倍速 ' + r + 'x');
  }
  function setFit(k) {
    S.fit = k;
    persistFit(k);
    applyFit();
  }
  function persistFit(k) { store('tvp.fit', k); }
  function applyFit() {
    if (!D.stage || !D.video) return;
    if (S.fit === 'contain' || S.fit === 'cover') {
      D.stage.style.aspectRatio = '';
      D.video.style.objectFit = S.fit;
    } else {
      D.stage.style.aspectRatio = S.fit.replace(':', ' / ');
      D.video.style.objectFit = 'contain';
    }
    if (D.wide) D.wide.classList.toggle('is-on', D.stage.classList.contains('is-wide'));
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

  function wideOn() { return D.stage && D.stage.classList.contains('is-wide'); }
  function webFullOn() { return D.stage && D.stage.classList.contains('is-web-full'); }
  function toggleWide() {
    if (!D.stage) return;
    var on = D.stage.classList.toggle('is-wide');
    document.documentElement.style.overflow = on || webFullOn() ? 'hidden' : '';
    if (D.wide) D.wide.classList.toggle('is-on', on);
    toast(on ? '宽屏' : '退出宽屏');
  }
  function toggleWebFull() {
    if (!D.stage) return;
    var on = D.stage.classList.toggle('is-web-full');
    document.documentElement.style.overflow = on || wideOn() ? 'hidden' : '';
    if (D.web) D.web.classList.toggle('is-on', on);
    toast(on ? '网页全屏' : '退出网页全屏');
  }
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  /* ---------- 手机端横屏 ----------
     三种浏览器的能力差得很远，这里按「能做到多少做多少」的顺序退：
       1. Android Chrome / Edge：元素全屏 + screen.orientation.lock('landscape')
          两个都支持，进去就是横的。
       2. iOS Safari：没有 orientation.lock，元素全屏也拿不到方向控制。唯一能
          真正横过来铺满的路是 video.webkitEnterFullscreen()（系统原生播放器，
          随设备旋转，控件也是系统的）——所以 iOS 直接走它，不要先请求元素全屏，
          否则先全屏再调原生播放器会闪一下。
       3. 什么都不支持的：至少把方向锁试一遍（部分安卓 WebView 只有这一半）。 */
  function lockLandscape() {
    try {
      var so = screen.orientation || screen.mozOrientation || screen.msOrientation;
      if (so && so.lock) { var p = so.lock('landscape'); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  }
  function unlockOrientation() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  /* 「横屏观看」按钮直接调它 */
  function enterLandscape() {
    if (!D.video) return;
    if (isIOS() && D.video.webkitEnterFullscreen) {
      try { D.video.webkitEnterFullscreen(); return; } catch (e) {}
    }
    if (isFull()) { lockLandscape(); return; }
    var fn = D.stage && (D.stage.requestFullscreen || D.stage.webkitRequestFullscreen);
    if (!fn) { lockLandscape(); return; }
    var p = fn.call(D.stage);
    if (p && p.then) p.then(lockLandscape, lockLandscape);
    else lockLandscape();
  }
  function toggleFull() {
    if (!D.stage) return;
    var d = document;
    if (isFull()) {
      unlockOrientation();
      (d.exitFullscreen || d.webkitExitFullscreen || function () {}).call(d);
    } else {
      enterLandscape();
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
  function clearFS() {
    if (D.stage && D.stage.classList.contains('is-web-full')) toggleWebFull();
  }

  /* hls.js 只加载一次；加载期间又来的播放请求排队等脚本，别用定时器猜
     （之前那个 400ms 猜测会在加载没完成时误报「浏览器不支持 HLS」） */
  var hlsCbs = [];
  function loadHls(cb) {
    if (window.Hls) { cb(); return; }
    hlsCbs.push(cb);
    if (hlsLoading) return;
    hlsLoading = true;
    var s = document.createElement('script');
    s.src = HLS_SRC;
    s.onload = function () {
      hlsLoading = false;
      var list = hlsCbs;
      hlsCbs = [];
      list.forEach(function (x) { try { x(); } catch (e) {} });
    };
    s.onerror = function () {
      hlsLoading = false;
      hlsCbs = [];
      showErr('hls.js 没能加载（网络或被拦截）。iOS/Safari 可用系统原生播放。');
    };
    document.head.appendChild(s);
  }
  function destroyHls() {
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    if (window.__tvHls) { try { window.__tvHls.destroy(); } catch (e2) {} window.__tvHls = null; }
  }
  /* ---------------- 播放重试器 ----------------
     为什么不能一出错就弹「加载失败」：这些采集源的 m3u8 经常是「先给个错/先超时，
     过几秒又好了」，实测多等几秒画面就出来了。所以统一交给下面这个重试器：
     没出画面就换个姿势重来（重建 hls → 绕本站代理 → 再交替试），
     全程只转圈 + 一句提示，不弹失败卡片；等满一分钟还是没画面才认输。 */
  var PLAY_BUDGET = 60000;
  var pv = { seq: 0, tries: 0, viaProxy: false, t0: 0, started: false };

  function attempt() {
    var my = pv.seq;
    var url = cur;
    if (!url) return;
    clearTimeout(watchdog);
    destroyHls();
    setSpin(true);
    var src = pv.viaProxy ? cfg.gateway + '/api/tv/stream?u=' + encodeURIComponent(url) : url;
    if (classify(url) === 'media' && !pv.viaProxy) {
      /* 直链 mp4：浏览器原生就能放，出错也只重试不报错 */
      D.video.onerror = function () { if (my === pv.seq) softRetry('直链失败'); };
      D.video.src = url;
      var p = D.video.play();
      if (p && p.catch) p.catch(function () { showUI(); });
    } else {
      D.video.onerror = null;
      playHls(src, my);
    }
    /* 静默看门狗：15 秒还没画面就换姿势，不弹错 */
    watchdog = setTimeout(function () {
      if (my === pv.seq && D.video.readyState < 3) softRetry('没画面');
    }, 15000);
  }

  function softRetry(why) {
    if (!cur) return;
    if (Date.now() - pv.t0 > PLAY_BUDGET) { giveUp(); return; }
    pv.tries++;
    /* 第 2 次起绕本站代理，之后直连/代理交替；两类可能都有问题，多试几轮 */
    pv.viaProxy = pv.tries >= 2 && pv.tries % 2 === 0;
    toast(pv.viaProxy ? '再等一下，改走本站代理重试…' : '这个源有点慢，正在自动重试…');
    setSpin(true);
    var my = pv.seq;
    setTimeout(function () { if (my === pv.seq) attempt(); }, Math.min(1200 * pv.tries, 6000));
  }

  function giveUp() {
    setSpin(false);
    showErr('这条线路一直没出画面（自动重试了几次，「' + whyText() + '」）。换一条线路更快，也可以点重试再等一轮。');
  }
  function whyText() { return '等了 ' + Math.round((Date.now() - pv.t0) / 1000) + ' 秒'; }

  function playHls(src, my) {
    var v = D.video;
    if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
      v.onerror = function () { if (my === pv.seq) softRetry('原生 HLS 失败'); };
      v.src = src;
      var pn = v.play();
      if (pn && pn.catch) pn.catch(function () { showUI(); });
      return;
    }
    setSpin(true);
    loadHls(function () {
      if (my !== pv.seq) return;
      if (!window.Hls || !window.Hls.isSupported()) { showErr('当前浏览器不支持 HLS 播放。'); return; }
      destroyHls();
      hls = new window.Hls({
        maxBufferLength: 30,
        enableWorker: true,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
      });
      window.__tvHls = hls;
      hls.loadSource(src);
      hls.attachMedia(v);
      hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        if (my !== pv.seq) return;
        setSpin(false);
        var p = v.play();
        if (p && p.catch) p.catch(function () { showUI(); });
      });
      hls.on(window.Hls.Events.ERROR, function (ev, data) {
        if (my !== pv.seq || !data || !data.fatal) return;
        /* 已经出过画面的：先就地救，别把播放进度清零 */
        if (pv.started && hls) {
          try {
            if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && hls.recoverMediaError) { hls.recoverMediaError(); return; }
            if (hls.startLoad) { hls.startLoad(); return; }
          } catch (e) {}
        }
        softRetry(String(data.details || data.type || ''));
      });
    });
  }

  function play(url) {
    if (!D.video || !url) return false;
    if (classify(url) === 'page') return false;
    cur = url;
    pv.seq++;
    pv.tries = 0;
    pv.viaProxy = false;
    pv.started = false;
    pv.t0 = Date.now();
    closeMenus();
    document.documentElement.classList.add('tvp-open');
    hideErr();
    attempt();
    return true;
  }
  function stop() {
    clearTimeout(watchdog);
    pv.seq++; /* 作废在飞的重试 */
    pv.started = false;
    if (D.video) D.video.onerror = null;
    closeMenus();
    clearFS();
    document.documentElement.classList.remove('tvp-open');
    destroyHls();
    var v = D.video;
    if (v) { try { v.pause(); } catch (e) {} v.removeAttribute('src'); try { v.load(); } catch (e2) {} }
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
    else if (k === 't' || k === 'T') { e.preventDefault(); toggleWide(); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); setVolume(D.video.muted ? (volBeforeMute || 1) : 0, true); toast(D.video.muted ? '已静音' : '取消静音'); }
    else if (k >= '0' && k <= '9' && D.video.duration) { D.video.currentTime = D.video.duration * (Number(k) / 10); }
  }

  function bind() {
    var v = D.video, st = D.stage;
    ['playing', 'pause', 'ended'].forEach(function (ev) { v.addEventListener(ev, function () { syncPlayIcon(); setTime(); }); });
    v.addEventListener('timeupdate', function () { setTime(); setBuffer(); });
    v.addEventListener('progress', setBuffer);
    v.addEventListener('loadedmetadata', function () { clearTimeout(watchdog); pv.started = true; setTime(); hideErr(); setSpin(false); });
    v.addEventListener('playing', function () { clearTimeout(watchdog); pv.started = true; hideErr(); setSpin(false); });
    v.addEventListener('waiting', function () { setSpin(true); });
    v.addEventListener('canplay', function () { setSpin(false); });
    /* 播放出错一律交给重试器（attempt 里的 onerror），这里不再弹卡片 */
    v.addEventListener('ended', function () { if (S.autonext && cfg.onEnded) cfg.onEnded(); });
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
    if (D.wide) D.wide.addEventListener('click', toggleWide);
    if (D.web) D.web.addEventListener('click', toggleWebFull);
    if (D.full) D.full.addEventListener('click', toggleFull);
    if (D.rate) D.rate.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(D.rateMenu); });
    if (D.qual) D.qual.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(D.qualMenu); });
    if (D.setBtn) D.setBtn.addEventListener('click', function (e) { e.stopPropagation(); toggleMenu(D.setMenu); });
    document.addEventListener('click', function (e) {
      var m = openMenu();
      if (m && !m.contains(e.target)) closeMenus();
    });

    /* 进度条：按下即拖拽，跟 B 站一样拖到哪跳到哪 */
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
      if (D.full) D.full.classList.toggle('is-on', isFull());
      /* 退出全屏必须解方向锁，而且不能只在 toggleFull 里解：
         用系统手势退出（安卓返回键/手势、ESC、通知栏下拉）根本不经过
         toggleFull，锁就没人解 —— 整个页面会一直横着，
         用户只能退出页面重进。这里兜底，任何途径退出全屏都会解。 */
      if (!isFull()) unlockOrientation();
      scheduleHide();
    });
    document.addEventListener('visibilitychange', function () { scheduleHide(); });
  }

  function init(options) {
    cfg = options || {};
    if (!cfg.gateway) cfg.gateway = '';
    D.stage = cfg.stage || $('tvp');
    D.video = cfg.video || $('tvVideo');
    if (!D.stage || !D.video) return false;
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
    D.qual = $('tvpQual');
    D.qualName = $('tvpQualName');
    D.rate = $('tvpRate');
    D.setBtn = $('tvpSet');
    D.pip = $('tvpPip');
    D.wide = $('tvpWide');
    D.web = $('tvpWeb');
    D.full = $('tvpFull');
    D.rateMenu = $('tvpRateMenu');
    D.qualMenu = $('tvpQualMenu');
    D.setMenu = $('tvpSetMenu');
    S.rate = Number(store('tvp.rate') || 1);
    S.fit = store('tvp.fit') || 'contain';
    buildRateMenu();
    buildSetMenu();
    applyFit();
    setVolume(Number(store('tvp.vol') === null ? 1 : store('tvp.vol')), false);
    if (D.rateMenu) Array.prototype.forEach.call(D.rateMenu.querySelectorAll('button'), function (b, i) { b.classList.toggle('is-on', RATES[i] === S.rate); });
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
    setQualities: setQualities,
    seekBy: seekBy,
    enterLandscape: enterLandscape,
    toggleFull: toggleFull,
    isFull: isFull,
    getVideo: function () { return D.video; },
  };
})();
