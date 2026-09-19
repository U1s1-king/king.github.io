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
  /* 快捷键说明（设置菜单里那一项弹出它）。写成一行，toast 里换行靠 CSS 的 white-space。 */
  var KEYHELP = '空格/k 播放暂停 · ←/→ 5秒 · j/l 10秒 · ↑/↓ 音量 · m 静音 · ' +
    'f 全屏 · w 网页全屏 · t 宽屏 · 0-9 跳到N0% · Shift+,/. 减速加速 · Shift+1~4 倍速 · p/n 上下集';
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

  /* ms 可选：一般提示 1.2 秒就够，但「快捷键说明」那种长文本
     一秒多根本读不完，所以给个自定义时长的口子。 */
  function toast(msg, ms) {
    if (!D.toast) return;
    D.toast.textContent = msg;
    D.toast.hidden = false;
    /* 长文本加个类：让它换行、放宽一点，别撑出播放器外面 */
    D.toast.classList.toggle('is-long', String(msg).length > 40);
    D.toast.classList.add('on');
    clearTimeout(D.toast._t);
    D.toast._t = setTimeout(function () { D.toast.classList.remove('on'); }, ms || 1200);
  }
  function showErr(msg) { if (!D.err) return; if (D.errMsg) D.errMsg.textContent = msg; D.err.hidden = false; setSpin(false); }
  function hideErr() { if (D.err) D.err.hidden = true; }
  function setSpin(on) { if (D.spin) D.spin.hidden = !on; }
  function playing() { return !!(D.video && !D.video.paused && !D.video.ended); }
  function syncPlayIcon() { if (D.play) D.play.classList.toggle('is-pause', playing()); if (D.big) D.big.hidden = playing(); }

  function showUI() { if (D.stage) { D.stage.classList.add('show-ui'); D.stage.classList.remove('is-idle'); } }
  /* 鼠标是否真的停在画面上：全屏时它是判断「该不该藏控制条」的唯一依据。
     用 hover 媒体查询是因为触屏设备根本没有鼠标，这时候不该走这套逻辑。 */
  function hasMouse() {
    try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) { return true; }
  }
  /* 全屏/宽屏时：鼠标一动就把控制条叫回来，并且【不显示光标】这件事
     只在不全屏时才做 —— 全屏下藏光标会让用户找不到自己在哪，也很难点中按钮。 */
  function immersive() {
    return !!(isFull() || webFullOn() || wideOn());
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    showUI();
    hideTimer = setTimeout(function () {
      if (!D.stage || !playing() || dragging || openMenu()) return;
      /* 鼠标设备在全屏下：仍然收控制条（让画面干净），但保留光标。
         这是「鼠标可正常显示并操作」的关键 —— 以前 is-idle 会 cursor:none，
         全屏后鼠标一动看不见指针，等于没法操作。 */
      D.stage.classList.remove('show-ui');
      if (!D.err || D.err.hidden) D.stage.classList.add('is-idle');
      /* 全屏 + 鼠标设备：补一个 is-immersive，CSS 靠它把 cursor 还原成 default */
      D.stage.classList.toggle('is-immersive', immersive() && hasMouse());
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
    /* 快捷键说明：B 站没有这一项，但我们的键位比 B 站多，
       不给个地方写出来用户不会知道（尤其 j/l 和 Shift+数字）。 */
    var help = menuBtn(0, '快捷键说明', false);
    help.addEventListener('click', function () { closeMenus(); toast(KEYHELP, 6000); });
    D.setMenu.appendChild(help);
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

  /* 全屏/宽屏状态一变就同步一次：is-immersive 决定「隐藏控制条时要不要留光标」。
     所有会改变沉浸状态的入口（全屏按钮、宽屏、网页全屏、系统手势退出全屏）
     都要叫它，否则光标策略会停在旧状态。 */
  function syncImmersive() {
    if (!D.stage) return;
    D.stage.classList.toggle('is-immersive', immersive() && hasMouse());
  }

  function wideOn() { return D.stage && D.stage.classList.contains('is-wide'); }
  function webFullOn() { return D.stage && D.stage.classList.contains('is-web-full'); }
  function toggleWide() {
    if (!D.stage) return;
    var on = D.stage.classList.toggle('is-wide');
    document.documentElement.style.overflow = on || webFullOn() ? 'hidden' : '';
    if (D.wide) D.wide.classList.toggle('is-on', on);
    syncImmersive();
    toast(on ? '宽屏' : '退出宽屏');
  }
  function toggleWebFull() {
    if (!D.stage) return;
    var on = D.stage.classList.toggle('is-web-full');
    document.documentElement.style.overflow = on || wideOn() ? 'hidden' : '';
    if (D.web) D.web.classList.toggle('is-on', on);
    syncImmersive();
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
  /* 画中画。以前只写了 try/catch，会有三个问题：
       1. 不支持 PiP 的浏览器（iOS Safari、部分 Firefox）点了完全没反应，
          用户以为按钮坏了 —— 现在明确提示「这个浏览器不支持」；
       2. 进入/退出后按钮没有选中态，看不出当前是不是 PiP；
       3. requestPictureInPicture 返回 Promise，被浏览器拒绝时
          （比如没播放、或用户手势不足）会静默失败，这里接住并提示。 */
  function syncPipBtn() {
    if (!D.pip) return;
    var d = document;
    var on = !!(d.pictureInPictureElement && d.pictureInPictureElement === D.video);
    D.pip.classList.toggle('is-on', on);
  }
  function togglePip() {
    if (!D.video) return;
    var d = document;
    if (!d.pictureInPictureEnabled && !d.pictureInPictureElement) {
      toast('这个浏览器不支持画中画');
      return;
    }
    try {
      if (d.pictureInPictureElement) {
        d.exitPictureInPicture().then(syncPipBtn).catch(function () {});
      } else if (D.video.requestPictureInPicture) {
        D.video.requestPictureInPicture().then(syncPipBtn).catch(function (err) {
          /* 最常见的原因是「视频还没开始播」—— PiP 需要有一帧画面 */
          toast(err && err.name === 'NotAllowedError' ? '先播放一下再开画中画' : '画中画打不开');
        });
      } else {
        toast('这个浏览器不支持画中画');
      }
    } catch (e) {
      toast('画中画打不开');
    }
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

  /* ============================================================
   * 快捷键（照 bilibili 播放器那一套）
   * ------------------------------------------------------------
   * 实测 B 站网页端播放器的键位，逐条对应：
   *   空格 / k        播放、暂停
   *   ← / →           快退、快进 5 秒
   *   j / l           快退、快进 10 秒（B 站的 J/L 是 10 秒，和方向键不同）
   *   ↑ / ↓           音量 ±5%
   *   m               静音开关
   *   f               全屏（进入/退出）
   *   w               网页全屏
   *   t               宽屏
   *   Esc             退出全屏（浏览器自己处理，这里只同步按钮态）
   *   0-9             跳到总时长的 N0%
   *   Shift+, / .     减速 / 加速
   *   Shift+1..4      1.0x / 2.0x / 3.0x / 4.0x（B 站番剧页这套）
   *   p / n           上一集 / 下一集（Shift 与否都认）
   *
   * 三个「踩过的坑」写在这里，改的时候别踩回去：
   *
   *  1) 数字键必须先排除修饰键。原来只判断 '0' <= k <= '9'，
   *     于是 Shift+2（想切 2 倍速）被当成「跳到 20%」，
   *     实测 currentTime 从 300 直接跳到 120 —— 快捷键互相打架。
   *  2) 全屏后必须仍然生效。document 上的监听本来就能收到全屏里的按键，
   *     真正的坑是那个 offsetParent 守卫：全屏时祖先被浏览器改了渲染方式，
   *     offsetParent 可能变成 null，于是整个键盘在最重要的场景下失灵。
   *     现在改成「看播放器是否真的在页面上可见」，不再依赖 offsetParent。
   *  3) effectAllowed 之类的手势限制不影响键盘，但输入框必须放行：
   *     用户在搜索框里打字时，f/j/k 都得是普通字符。
   * ============================================================ */
  /* 按 B 站的档位顺序排列，Shift+N 的 N 就是这里的下标 + 1 */
  var KEY_RATES = [1, 2, 3, 4];
  /* 倍速增减用的完整档位表（和倍速菜单一致，只是方向反过来用） */
  function stepRate(dir) {
    /* RATES 是从快到慢排的：[2, 1.5, 1.25, 1, 0.75, 0.5]
       「加速」= 往数组前面走。找不到当前位置就退回 1x 再走一步。 */
    var i = RATES.indexOf(S.rate);
    if (i < 0) {
      /* 当前倍速不在档位表里（比如手改过），先归到 1x */
      i = RATES.indexOf(1);
    }
    var j = i - dir; /* dir=+1 加速 -> 下标减小 */
    if (j < 0) j = 0;
    if (j > RATES.length - 1) j = RATES.length - 1;
    if (j === i) { toast(dir > 0 ? '已是最快' : '已是最慢'); return; }
    setRate(RATES[j]);
  }

  /* 播放器是否「正在被使用」——用它替代原来的 offsetParent 判断。
     条件：stage 存在、且它的盒子里有实际尺寸（display:none 或未插入时为 0），
     同时没有别的输入控件抢焦点。

     ⚠ 全屏时不能只看 getBoundingClientRect：全屏元素在部分浏览器里
     祖先被改写渲染方式，rect 可能返回 0（这正是原来 offsetParent 那个坑的变体），
     于是「全屏后快捷键失灵」—— 而全屏恰恰是最需要键盘的场景。
     所以先把全屏/网页全屏/宽屏三种「确定在被使用」的状态直接放行。 */
  function playerActive() {
    var st = D.stage;
    if (!st) return false;
    if (immersive()) return true;
    var r = st.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function onKey(e) {
    if (!playerActive()) return;
    var t = e.target || {};
    var tag = (t.tagName || '').toLowerCase();
    /* 输入框、可编辑区域里一律放行，别把用户打的字吃掉 */
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    /* 带 Ctrl/Alt/Meta 的组合键交给浏览器（Ctrl+F 找内容、Alt+← 后退…） */
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    var k = e.key;
    var shift = e.shiftKey;

    /* ---------- 带 Shift 的：倍速 ---------- */
    if (shift) {
      /* Shift+1..4 → 1x/2x/3x/4x。注意这里必须先于下面的数字键处理 */
      if (k >= '1' && k <= '4' && KEY_RATES.length >= Number(k)) {
        e.preventDefault();
        setRate(KEY_RATES[Number(k) - 1]);
        return;
      }
      /* Shift+. / Shift+, → 加速 / 减速（和 B 站一致） */
      if (k === '>' || k === '.') { e.preventDefault(); stepRate(1); return; }
      if (k === '<' || k === ',') { e.preventDefault(); stepRate(-1); return; }
      /* Shift+p / Shift+n → 上一集 / 下一集 */
      if (k === 'P') { e.preventDefault(); if (cfg.onPrev) cfg.onPrev(); return; }
      if (k === 'N') { e.preventDefault(); if (cfg.onNext) cfg.onNext(); return; }
      /* 其它带 Shift 的键不拦，避免吃掉浏览器的快捷键 */
      return;
    }

    /* ---------- 不带 Shift ---------- */
    if (k === ' ' || k === 'Spacebar' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); seekBy(-5); toast('-5 秒'); }
    else if (k === 'ArrowRight') { e.preventDefault(); seekBy(5); toast('+5 秒'); }
    else if (k === 'j' || k === 'J') { e.preventDefault(); seekBy(-10); toast('-10 秒'); }
    else if (k === 'l' || k === 'L') { e.preventDefault(); seekBy(10); toast('+10 秒'); }
    else if (k === 'ArrowUp') { e.preventDefault(); setVolume(D.video.volume + 0.05, true); toast('音量 ' + Math.round(D.video.volume * 100) + '%'); }
    else if (k === 'ArrowDown') { e.preventDefault(); setVolume(D.video.volume - 0.05, true); toast('音量 ' + Math.round(D.video.volume * 100) + '%'); }
    else if (k === 'f' || k === 'F') { e.preventDefault(); toggleFull(); }
    else if (k === 'w' || k === 'W') { e.preventDefault(); toggleWebFull(); }
    else if (k === 't' || k === 'T') { e.preventDefault(); toggleWide(); }
    else if (k === 'm' || k === 'M') { e.preventDefault(); setVolume(D.video.muted ? (volBeforeMute || 1) : 0, true); toast(D.video.muted ? '已静音' : '取消静音'); }
    else if (k === 'p') { e.preventDefault(); if (cfg.onPrev) cfg.onPrev(); }
    else if (k === 'n') { e.preventDefault(); if (cfg.onNext) cfg.onNext(); }
    /* 数字键：跳到总时长的 N0%。放在最后，且已经排除了 Shift */
    else if (k >= '0' && k <= '9' && D.video.duration && isFinite(D.video.duration)) {
      e.preventDefault();
      D.video.currentTime = D.video.duration * (Number(k) / 10);
      toast('跳到 ' + (Number(k) * 10) + '%');
    }
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
    /* 画中画状态同步：用户也可能在系统画中画窗口上点关闭，
       不能只在我们自己的按钮点击时更新，得监听这两个事件。 */
    v.addEventListener('enterpictureinpicture', syncPipBtn);
    v.addEventListener('leavepictureinpicture', syncPipBtn);
    v.addEventListener('dblclick', function () { clearTimeout(clickTimer); toggleFull(); });
    v.addEventListener('click', function () {
      clearTimeout(clickTimer);
      clickTimer = setTimeout(toggle, 220);
    });
    st.addEventListener('pointermove', function (e) {
      /* 触屏的 pointermove 是拖拽产生的，不该触发「鼠标动了」这套 */
      if (e.pointerType !== 'touch') scheduleHide();
    });
    st.addEventListener('pointerdown', scheduleHide);
    /* 全屏后鼠标可能停在画面上不动：这时候控制条应该【保持显示】而不是
       3 秒后自己收掉（收掉了用户还得再晃一下鼠标才找得到按钮）。
       靠 hover 状态判断，比监听 mousemove 可靠。 */
    st.addEventListener('mouseenter', function () { if (immersive() && hasMouse()) showUI(); });

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

    /* ---------- 手势控制（手机/平板） ----------
       B 站那套：横向滑 = 快进快退，纵向滑（左半边）= 亮度、（右半边）= 音量，
       双击 = 播放/暂停，单击 = 显示/隐藏控制条。
       全部用 touch 事件而不是 pointer：pointer 在移动端会和进度条的拖拽抢事件。
       判断阈值 12px —— 小于它当点击，避免轻微滑动被当成手势。 */
    var g = { on: false, x0: 0, y0: 0, t0: 0, axis: '', moved: false, baseVol: 0, baseSeek: 0 };
    var GEST = 12;
    function gestTip(txt) { toast(txt, 700); }
    st.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { g.on = false; return; }
      var t = e.touches[0];
      /* 从控制条/菜单上起手的滑动不算手势（那是进度条拖拽和点按钮） */
      var el = e.target;
      if (el && el.closest && el.closest('.tvp-bar, .tvp-menu, .tvp-err')) { g.on = false; return; }
      g.on = true; g.moved = false; g.axis = '';
      g.x0 = t.clientX; g.y0 = t.clientY; g.t0 = Date.now();
      g.baseVol = D.video.volume;
      g.baseSeek = D.video.currentTime;
    }, { passive: true });

    st.addEventListener('touchmove', function (e) {
      if (!g.on || e.touches.length !== 1) return;
      var t = e.touches[0];
      var dx = t.clientX - g.x0, dy = t.clientY - g.y0;
      if (!g.axis) {
        if (Math.abs(dx) < GEST && Math.abs(dy) < GEST) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      g.moved = true;
      var r = st.getBoundingClientRect();
      if (g.axis === 'x') {
        /* 横向：整屏宽 ≈ 120 秒，滑多少给多少，实时预览但不立刻 seek
           （立刻 seek 会让 HLS 反复重载分片，滑完再落点更顺） */
        var span = r.width || 320;
        var dt = (dx / span) * 120;
        var to = Math.max(0, Math.min((D.video.duration || 0) - 1, g.baseSeek + dt));
        g.pending = to;
        gestTip((dt >= 0 ? '快进 ' : '快退 ') + fmt(Math.abs(dt)) + ' / ' + fmt(to));
      } else {
        var left = (g.x0 - r.left) < r.width / 2;
        if (left) {
          /* 左半边上下滑 = 音量（不做亮度：网页改不了系统亮度，
             盖一层黑幕模拟只会让画面发灰，反而更差） */
          var dv = -dy / (r.height || 240);
          setVolume(g.baseVol + dv, true);
          gestTip('音量 ' + Math.round(D.video.volume * 100) + '%');
        } else {
          /* 右半边上下滑 = 音量（左右都给音量，手机上比亮度实用） */
          var dv2 = -dy / (r.height || 240);
          setVolume(g.baseVol + dv2, true);
          gestTip('音量 ' + Math.round(D.video.volume * 100) + '%');
        }
      }
    }, { passive: true });

    st.addEventListener('touchend', function (e) {
      if (!g.on) return;
      g.on = false;
      var dt = Date.now() - g.t0;
      if (!g.moved) {
        /* 没滑动：当点击。短按 = 播放/暂停，双击 = 播放/暂停（同一个动作，
           因为移动端单击已经被「显示控制条」占了，B 站也是这么处理的） */
        if (dt < 250) { clearTimeout(clickTimer); clickTimer = setTimeout(toggle, 220); }
        return;
      }
      if (g.axis === 'x' && typeof g.pending === 'number') {
        seekTo(g.pending);   /* 手势结束才真正落点 */
        toast('已跳到 ' + fmt(g.pending));
        g.pending = undefined;
      }
      scheduleHide();
    });

    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', function () {
      if (D.full) D.full.classList.toggle('is-on', isFull());
      /* 退出全屏必须解方向锁，而且不能只在 toggleFull 里解：
         用系统手势退出（安卓返回键/手势、ESC、通知栏下拉）根本不经过
         toggleFull，锁就没人解 —— 整个页面会一直横着，
         用户只能退出页面重进。这里兜底，任何途径退出全屏都会解。 */
      if (!isFull()) unlockOrientation();
      syncImmersive();
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
    syncImmersive();
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
    /* 对外暴露倍速与设置：页面上别的地方（以及自动化测试）
       需要一个能同时改 video.playbackRate 和内部 S.rate 的入口，
       直接改 video 会让内部状态和实际值不同步。 */
    setRate: setRate,
    getRate: function () { return S.rate; },
    enterLandscape: enterLandscape,
    toggleFull: toggleFull,
    isFull: isFull,
    getVideo: function () { return D.video; },
  };
})();
