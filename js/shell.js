/* ============================================================
 * App 外壳 (js/shell.js) —— 只被 shell.html 加载，网站其它页面不引用
 * ------------------------------------------------------------
 * 目的只有一个：切页不断音。
 *   · #player-frame 装 music.html，加载一次后永不导航 → <audio> 一直活着
 *   · #page-frame 装其它页面，点底部 tab 只换它的 src
 *   · 音乐 tab = 直接把 player-frame 显示出来（不重新加载）
 * 外壳与两个 iframe 同源，所以可以直接读播放器的 DOM 来同步迷你条。
 * ============================================================ */
(function () {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  var pageFrame = byId('page-frame');
  var playerFrame = byId('player-frame');
  var mini = byId('app-mini-player');
  var MUSIC = 'music.html';
  var current = '';

  function tabs() { return Array.prototype.slice.call(document.querySelectorAll('.bot-tab a')); }
  function fileOf(a) { return (a.getAttribute('href') || '').split('/').pop(); }
  function highlight(file) {
    tabs().forEach(function (a) { a.classList.toggle('on', fileOf(a) === file); });
  }

  function show(file, fromPop) {
    if (!file) return;
    current = file;
    highlight(file);
    if (file === MUSIC) {
      var src = playerFrame.getAttribute('src');
      if (!src || src === 'about:blank') playerFrame.setAttribute('src', MUSIC + location.search);
      playerFrame.style.display = 'block';
      pageFrame.style.display = 'none';
    } else {
      pageFrame.style.display = 'block';
      playerFrame.style.display = 'none';
      if (pageFrame.getAttribute('data-file') !== file) {
        pageFrame.setAttribute('data-file', file);
        pageFrame.setAttribute('src', file + location.search);
      }
    }
    if (!fromPop && history.pushState) {
      try { history.pushState({ shell: file }, '', '#' + file.replace(/\.html$/, '')); } catch (e) {}
    }
    syncMini();
  }

  /* 底部 tab 一律由外壳接管：让它整页跳转就等于把音乐掐断 */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('.bot-tab a') : null;
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    var f = fileOf(a);
    if (f && f !== current) show(f);
  });

  window.addEventListener('popstate', function () {
    var st = history.state;
    if (st && st.shell) show(st.shell, true);
  });

  /* ---------- 迷你条：直接读播放器 iframe 的 DOM（同源） ---------- */
  function playerDoc() {
    try { return playerFrame.contentDocument || null; } catch (e) { return null; }
  }
  function playerState() {
    var d = playerDoc();
    if (!d) return null;
    var audio = d.getElementById('nativeAudio');
    var name = d.getElementById('trackName');
    if (!audio || !name) return null;
    var text = (name.textContent || '').trim();
    if (!text) return null;
    return {
      name: text,
      artist: ((d.getElementById('trackArtist') || {}).textContent || '').trim(),
      cover: (d.getElementById('coverImg') || {}).src || '',
      paused: !!audio.paused,
      started: !!(audio.currentSrc || audio.getAttribute('src'))
    };
  }
  function syncMini() {
    if (!mini) return;
    var s = playerState();
    var on = !!(s && s.started && current !== MUSIC);
    mini.classList.toggle('show', on);
    if (!on) return;
    var c = byId('mpCover');
    if (c && s.cover) c.src = s.cover;
    var t = byId('mpTitle');
    if (t) t.textContent = s.name;
    var ar = byId('mpArtist');
    if (ar) ar.textContent = s.artist;
    var pb = byId('mpPlay');
    if (pb) pb.innerHTML = '<i class="fas ' + (s.paused ? 'fa-play' : 'fa-pause') + '"></i>';
  }
  function tap(sel) {
    var d = playerDoc();
    if (!d) return;
    var b = d.querySelector(sel);
    if (b) b.click();
    setTimeout(syncMini, 250);
  }
  var play = byId('mpPlay'), prev = byId('mpPrev'), next = byId('mpNext');
  if (play) play.addEventListener('click', function (e) { e.stopPropagation(); tap('#playPauseBtn'); });
  if (prev) prev.addEventListener('click', function (e) { e.stopPropagation(); tap('#prevBtn'); });
  if (next) next.addEventListener('click', function (e) { e.stopPropagation(); tap('#nextBtn'); });
  if (mini) mini.addEventListener('click', function () { show(MUSIC); });

  /* 起始 tab：支持 shell.html#journal 直接进对应页 */
  var want = (location.hash || '').replace(/^#/, '');
  var initial = 'index.html';
  tabs().forEach(function (a) {
    if (want && fileOf(a).replace(/\.html$/, '').toLowerCase() === want.toLowerCase()) initial = fileOf(a);
  });
  show(initial, true);
  setInterval(syncMini, 1000);
})();
