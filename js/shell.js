/* ============================================================
 * App 外壳 (js/shell.js) —— 只被首页 index.html 加载，网站其它页面不引用
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
  var lastTab = 'home.html';   /* 内容帧最后停在哪一页（音乐页除外） */

  function tabs() { return Array.prototype.slice.call(document.querySelectorAll('.bot-tab a')); }
  function fileOf(a) { return (a.getAttribute('href') || '').split('/').pop(); }
  function highlight(file) {
    tabs().forEach(function (a) { a.classList.toggle('on', fileOf(a) === file); });
  }

  function show(file, fromPop) {
    if (!file) return;
    current = file;
    if (file !== MUSIC) lastTab = file;
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
  /* ---------- 播放器 iframe 绝不能被导航 ----------
     壳最容易翻车的地方：音乐 tab 亮出来时，用户看到的、能点的就是播放器这一帧
     自己（网页端没有底部 tab，切页只能点页面里的侧边栏）。它一旦导航，<audio>
     就跟着销毁 —— 音乐就断。所以把它里面的站内链接全部接管：不导航这一帧，
     改成把目标页装进内容帧。 */
  function guardPlayerNavigation() {
    var d = playerDoc();
    if (!d || d.__shellGuarded) return;
    d.__shellGuarded = true;
    d.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (a.target === '_blank') return;
      if (/^(https?:)?\/\//i.test(href) || /^(mailto|tel|javascript):/i.test(href)) return;
      var f = href.split('#')[0].split('?')[0].split('/').pop();
      e.preventDefault();
      if (!f || f === MUSIC) return;   /* 指向音乐页自己，什么都不用做 */
      show(f);
    }, true);
  }

  function pageDoc() {
    try { return pageFrame.contentDocument || null; } catch (e) { return null; }
  }

  /* ---------- 内容帧里点到音乐页，也要交给常驻播放器 ----------
     真凶就是这条路径：用户在内容帧里点页面自己的「音乐」链接，音乐页被装进
     内容帧并在那一帧里播放 —— 他下一次切页，这一帧导航，<audio> 随帧销毁，
     于是「切页断音」。所以内容帧里的音乐链接一律拦下来，改成亮出播放器帧。 */
  function guardContentNavigation() {
    var d = pageDoc();
    if (!d || d.__shellGuardedC) return;
    d.__shellGuardedC = true;
    d.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (a.target === '_blank') return;
      if (/^(https?:)?\/\//i.test(href) || /^(mailto|tel|javascript):/i.test(href)) return;
      var f = href.split('#')[0].split('?')[0].split('/').pop();
      if (f !== MUSIC) return;   /* 其它页面正常在内容帧里走 */
      e.preventDefault();
      show(MUSIC);
    }, true);
  }

  /* 兜底：内容帧偷偷落到音乐页（JS 跳转 / 深链 / 表单）→ 交给播放器帧，
     并把内容帧退回它上一页，避免出现第二个播放实例跟着一起放。 */
  function keepContentOffMusic() {
    var d = pageDoc();
    if (!d) return;
    var href = '';
    try { href = d.location.href || ''; } catch (e) { href = ''; }
    if (!href || href.indexOf('about:') === 0) return;
    if (href.indexOf(MUSIC) < 0) return;
    show(MUSIC);
    pageFrame.setAttribute('data-file', '');
    pageFrame.setAttribute('src', lastTab + location.search);
  }

  /* ---------- 兜底：播放器帧被偷偷导航走了就拉回来 ----------
     <a> 拦截覆盖不到的（脚本里的 location.href=...）会真把这一帧导航走，
     <audio> 随之销毁。一旦发现它不在 music.html，立刻重新装回音乐页 ——
     续播会从记录的断点接着放。代价是一次加载，而不是"音乐没了"。 */
  function keepPlayerHome() {
    var href = '';
    try { href = (playerFrame.contentWindow || {}).location.href || ''; } catch (e) { href = ''; }
    if (!href || href.indexOf('about:') === 0) return;
    if (href.indexOf(MUSIC) >= 0) return;
    playerFrame.setAttribute('src', MUSIC + location.search);
  }

  function syncMini() {
    guardPlayerNavigation();
    keepPlayerHome();
    guardContentNavigation();
    keepContentOffMusic();
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

  /* 起始 tab：支持 index.html#journal 直接进对应页 */
  var want = (location.hash || '').replace(/^#/, '');
  var initial = 'home.html';
  tabs().forEach(function (a) {
    if (want && fileOf(a).replace(/\.html$/, '').toLowerCase() === want.toLowerCase()) initial = fileOf(a);
  });
  playerFrame.addEventListener('load', function () {
    setTimeout(guardPlayerNavigation, 300);   /* 帧里的文档换了就得重新接管 */
  });
  pageFrame.addEventListener('load', function () {
    setTimeout(guardContentNavigation, 300);
  });
  show(initial, true);
  setInterval(syncMini, 1000);
})();
