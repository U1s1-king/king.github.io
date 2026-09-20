/* ============================================================
 * 音乐页 App 增强 (music-plus.js) —— 仅手机端
 * ------------------------------------------------------------
 * 底子都在 music-bundle.js（548KB）里，所以这里的原则是「接」不是「造」：
 *   · 锁屏 / 系统媒体控制：bundle 已完整实现（第 644-670 行），不重复做
 *   · 进度条拖动：bundle 已有 seekTo（第 762 行），不重复做
 *   · 往歌单塞歌并播放：全局 addToPlaylist(song)（第 7495 行）
 *   · 当前曲目完整信息：playlist[currentIndex]（bundle 的全局 let）
 * 本文件只补 bundle 没有的：
 *   1. 播放页「更多」面板：分享 / 收藏 / 播放历史 / 我的收藏 / 睡眠定时
 *   2. 睡眠定时器（5-90 分钟或播完这首）＋倒计时徽标，刷新后能续上
 *   3. 播放历史 + 我的收藏（localStorage，一键重播，找不到就转搜索）
 *   4. 点封面 ↔ 歌词 双视图切换，并跟随封面换主题渐变
 * 桌面端：narrow() 为假直接 return，一个节点都不插。
 * ============================================================ */
(function () {
  'use strict';
  if (window.__MUSIC_PLUS__) return;
  window.__MUSIC_PLUS__ = true;

  var REC_KEY = 'dsh-music-rec';
  var FAV_KEY = 'dsh-music-fav';
  var SLEEP_KEY = 'dsh-music-sleep';

  function narrow() { return window.innerWidth <= 768; }
  function byId(id) { return document.getElementById(id); }
  function q(s, r) { return (r || document).querySelector(s); }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
  function load(key) {
    try { var v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }

  function toast(msg) {
    if (typeof window.showMsg === 'function') { window.showMsg(msg); return; }
    var t = byId('toastMsg');
    if (!t) return;
    t.textContent = msg;
    t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 2000);
  }

  /* ---------- 当前曲目：先用界面文字，再从 bundle 的 playlist 补齐 id/封面 ---------- */
  function curSong() {
    var nameEl = byId('trackName');
    var name = nameEl ? nameEl.textContent.trim() : '';
    if (!name) return null;
    var audio = byId('nativeAudio');
    var artistEl = byId('trackArtist');
    var coverEl = byId('coverImg');
    var s = {
      name: name,
      artist: artistEl ? artistEl.textContent.trim() : '',
      cover: coverEl ? (coverEl.currentSrc || coverEl.getAttribute('src') || '') : '',
      url: audio ? (audio.currentSrc || audio.getAttribute('src') || '') : '',
      id: '', platform: ''
    };
    /* bundle 里的那一条才是完整数据（id 关系到封面/歌词能不能再拉） */
    try {
      if (typeof playlist !== 'undefined' && typeof currentIndex !== 'undefined' && playlist && playlist[currentIndex]) {
        var p = playlist[currentIndex];
        if (p.name) s.name = p.name;
        if (p.artist) s.artist = p.artist;
        if (p.id) s.id = p.id;
        if (p.platform) s.platform = p.platform;
        if (p.cover) s.cover = p.cover;
        if (p.path) s.url = p.path;
      }
    } catch (e) {}
    return s;
  }

  /* ---------- 历史 ---------- */
  function record() {
    var s = curSong();
    if (!s || !s.name) return;
    var list = load(REC_KEY).filter(function (x) { return !(x.name === s.name && x.artist === s.artist); });
    list.unshift({ name: s.name, artist: s.artist, cover: s.cover, url: s.url, id: s.id, platform: s.platform, at: Date.now() });
    store(REC_KEY, list.slice(0, 60));
  }

  /* ---------- 收藏 ---------- */
  function isFav(s) {
    if (!s) return false;
    return load(FAV_KEY).some(function (x) { return x.name === s.name && x.artist === s.artist; });
  }
  function toggleFav(s) {
    if (!s) return false;
    var list = load(FAV_KEY);
    var idx = -1;
    list.forEach(function (x, i) { if (x.name === s.name && x.artist === s.artist) idx = i; });
    if (idx >= 0) { list.splice(idx, 1); store(FAV_KEY, list); return false; }
    list.unshift({ name: s.name, artist: s.artist, cover: s.cover, url: s.url, id: s.id, platform: s.platform, at: Date.now() });
    store(FAV_KEY, list.slice(0, 200));
    return true;
  }

  /* ---------- 按 id 回源取流（播放历史 / 我的收藏 / 最近播放 共用） ----------
     历史里存的 url 是 CDN 直链，会过期 —— 直接拿它去播就是「点了没声」。
     所以点一条记录时一律重新取流，顺序：
       1. 存下来的 platform + id 精确取一次（B站/网易云/QQ…同一套接口）；
       2. 取不到就退一步：拿「歌名 + 歌手」去 B站 搜一条，用 B站 的 id 再取
          —— B站的流最好拿，用户能真正听到；
       3. 两条都落空才认输，提示换源搜。
     想再播一首别的，只要把 {name,artist,id,platform} 丢给 playEntry() 即可。 */
  var playSeq = 0;

  function fetchUrl(song) {
    return window.MusicAPI.songUrl(song, { force: true }).then(function (u) {
      if (!u) throw new Error('no url');
      return u;
    });
  }

  function resolveStream(entry) {
    if (!window.MusicAPI) return Promise.reject(new Error('no api'));
    var platform = entry.platform || '';
    var base = { platform: platform, id: entry.id || '', name: entry.name || '', artist: entry.artist || '' };
    var byId = (platform && base.id)
      ? fetchUrl(base).then(function (u) {
          return { platform: platform, id: base.id, name: base.name, artist: base.artist, cover: entry.cover || '', lrc: entry.lrc || '', url: u };
        })
      : Promise.reject(new Error('no id'));
    return byId['catch'](function () {
      var kw = (base.name + ' ' + (base.artist || '')).trim();
      if (!kw) throw new Error('no keyword');
      return window.MusicAPI.search(kw, { platform: 'bilibili' }).then(function (list) {
        var hit = list && list[0];
        if (!hit) throw new Error('no hit');
        return window.MusicAPI.songUrl(hit).then(function (u) {
          if (!u) throw new Error('no url');
          return {
            platform: 'bilibili', id: hit.id,
            name: base.name || hit.name, artist: base.artist || hit.artist || '',
            cover: hit.cover || entry.cover || '', lrc: hit.lrc || '', url: u
          };
        });
      });
    });
  }

  /* 点一条记录：取流 → 交给 bundle 的 addToPlaylist（它内部会 play 新加的那条） */
  function playEntry(s) {
    if (!s || !s.name) return;
    var seq = ++playSeq;
    toast('正在取流…');
    resolveStream(s).then(function (song) {
      if (seq !== playSeq) return;
      if (typeof window.addToPlaylist !== 'function') { toast('播放器还没就绪喵~'); return; }
      window.addToPlaylist(song);
      setTimeout(record, 700);   /* 等 bundle 写完封面/歌名，再把这条记进历史 */
      if (window.AppShell && window.AppShell.detailOpen && window.AppShell.detailOpen()) {
        window.AppShell.closeDetail();
      }
    })['catch'](function () {
      if (seq !== playSeq) return;
      /* 直链还在就死马当活马医一次，失败再提示换源 */
      if (s.url) {
        try {
          window.addToPlaylist({ name: s.name, artist: s.artist || '', url: s.url, id: s.id || '', platform: s.platform || '', cover: s.cover || '' });
          setTimeout(record, 700);
          if (window.AppShell && window.AppShell.detailOpen && window.AppShell.detailOpen()) window.AppShell.closeDetail();
          return;
        } catch (e) { /* 落到下面的提示 */ }
      }
      toast('这首取不到流，点右侧放大镜换个源搜喵~');
    });
  }

  /* ---------- 续播：离开播放页时记下「哪首、第几秒」 ----------
     多页站点切页会销毁文档，<audio> 跟着死，这是没法绕的。能做的是把
     断点存下来：回到播放页时按存的 id 重新取流，再从那一秒接着放。
     只在「离开时确实在放」且 12 小时以内才续，自己暂停走的不续。 */
  var RESUME_KEY = 'dsh-music-resume';
  var lastSave = 0;
  var restoring = false;

  function readResume() {
    try { return JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); } catch (e) { return null; }
  }

  function saveResume() {
    if (restoring) return;
    var audio = byId('nativeAudio');
    if (!audio) return;
    var s = curSong();
    if (!s || !s.name) return;
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify({
        name: s.name, artist: s.artist || '', cover: s.cover || '',
        id: s.id || '', platform: s.platform || '',
        at: Math.round(audio.currentTime || 0),
        playing: !audio.paused && !audio.ended,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function bindResume() {
    var audio = byId('nativeAudio');
    if (!audio || audio.__mpResume) return;
    audio.__mpResume = true;
    audio.addEventListener('timeupdate', function () {
      var now = Date.now();
      if (now - lastSave < 4000) return;   /* 4 秒存一次，够细也不吵 */
      lastSave = now;
      saveResume();
    });
    audio.addEventListener('pause', saveResume);
    window.addEventListener('pagehide', saveResume);
    window.addEventListener('beforeunload', saveResume);
  }

  /* 回到播放页：还在放的那首从断点继续 */
  function restoreResume() {
    var r = readResume();
    if (!r || !r.playing || !r.name) return;
    if (Date.now() - (Number(r.ts) || 0) > 12 * 3600 * 1000) return;
    var audio = byId('nativeAudio');
    if (!audio) return;
    if (!audio.paused || (audio.currentTime || 0) > 1) return;   /* 已经有人在放了，别抢 */
    var at = Number(r.at) || 0;
    restoring = true;
    toast(at > 3 ? '继续播放《' + r.name + '》' : '继续播放');
    playEntry(r);
    setTimeout(function () { restoring = false; }, 3000);
    if (at > 3) {
      var once = function () {
        audio.removeEventListener('loadedmetadata', once);
        try { audio.currentTime = at; } catch (e) {}
      };
      audio.addEventListener('loadedmetadata', once);
      setTimeout(function () { audio.removeEventListener('loadedmetadata', once); }, 15000);
    }
  }

  /* ---------- 通用底部面板 ---------- */
  var sheetEl = null;
  function closeSheet() {
    if (sheetEl && sheetEl.parentNode) sheetEl.parentNode.removeChild(sheetEl);
    sheetEl = null;
  }
  function sheet(title, rows) {
    closeSheet();
    var mask = document.createElement('div');
    mask.className = 'mp-mask';
    var box = document.createElement('div');
    box.className = 'mp-sheet';
    var head = document.createElement('div');
    head.className = 'mp-sheet-head';
    var ttl = document.createElement('span');
    ttl.textContent = title;
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'mp-sheet-x';
    x.setAttribute('aria-label', '关闭');
    x.innerHTML = '<i class="fas fa-times"></i>';
    head.appendChild(ttl);
    head.appendChild(x);
    var body = document.createElement('div');
    body.className = 'mp-sheet-body';
    (rows || []).forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mp-row' + (r.on ? ' on' : '');
      var ic = document.createElement('i');
      ic.className = 'fas ' + (r.icon || 'fa-circle');
      var nm = document.createElement('span');
      nm.className = 'mp-row-name';
      nm.textContent = r.label;
      b.appendChild(ic);
      b.appendChild(nm);
      if (r.note) {
        var nt = document.createElement('span');
        nt.className = 'mp-row-note';
        nt.textContent = r.note;
        b.appendChild(nt);
      }
      if (r.on) {
        var ck = document.createElement('i');
        ck.className = 'fas fa-check mp-row-check';
        b.appendChild(ck);
      }
      b.addEventListener('click', function () { closeSheet(); if (r.run) r.run(); });
      body.appendChild(b);
    });
    box.appendChild(head);
    box.appendChild(body);
    mask.appendChild(box);
    mask.addEventListener('click', function (e) { if (e.target === mask) closeSheet(); });
    x.addEventListener('click', closeSheet);
    document.body.appendChild(mask);
    sheetEl = mask;
    return mask;
  }

  /* ---------- 睡眠定时器 ---------- */
  var sleepUntil = 0;
  var sleepAfterTrack = false;
  var sleepTick = null;

  function sleepLeft() { return sleepUntil - Date.now(); }
  function sleepActive() { return sleepUntil > 0 || sleepAfterTrack; }

  function sleepBadge() {
    var b = byId('fsSleepBadge');
    if (!b) return;
    if (sleepUntil > 0) {
      var s = Math.max(0, Math.round(sleepLeft() / 1000));
      b.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      b.style.display = '';
    } else if (sleepAfterTrack) {
      b.textContent = '本曲后';
      b.style.display = '';
    } else {
      b.style.display = 'none';
    }
  }

  function sleepCancel(silent) {
    sleepUntil = 0;
    sleepAfterTrack = false;
    try { localStorage.removeItem(SLEEP_KEY); } catch (e) {}
    if (sleepTick) { clearInterval(sleepTick); sleepTick = null; }
    sleepBadge();
    if (!silent) toast('已取消睡眠定时喵');
  }

  function sleepStart(minutes, afterTrack) {
    sleepAfterTrack = !!afterTrack;
    sleepUntil = minutes ? Date.now() + minutes * 60000 : 0;
    if (sleepUntil) store(SLEEP_KEY, sleepUntil); else { try { localStorage.removeItem(SLEEP_KEY); } catch (e) {} }
    if (sleepTick) clearInterval(sleepTick);
    sleepTick = setInterval(function () {
      if (sleepUntil > 0 && sleepLeft() <= 0) { fireSleep(); return; }
      sleepBadge();
    }, 1000);
    sleepBadge();
    toast(afterTrack ? '本曲播完就停喵~' : minutes + ' 分钟后停止播放喵~');
  }

  function fireSleep() {
    var audio = byId('nativeAudio');
    var afterTrack = sleepAfterTrack;
    sleepCancel(true);
    if (!audio) return;
    if (afterTrack) {                    /* 播完这首：曲终自然停，不用淡出 */
      try { audio.pause(); } catch (e) {}
      toast('这首听完啦，已停止播放喵~');
      return;
    }
    /* 定时到点：3 秒内把音量收干净再暂停，比硬切舒服（音量不写回本地） */
    var v0 = audio.volume;
    var steps = 20;
    var i = 0;
    var t = setInterval(function () {
      i++;
      try { audio.volume = Math.max(0, v0 * (1 - i / steps)); } catch (e) {}
      if (i >= steps) {
        clearInterval(t);
        try { audio.pause(); audio.volume = v0; } catch (e) {}
      }
    }, 150);
    toast('到点啦，已渐弱停止播放喵~');
  }

  function sleepSheet() {
    var opts = [['不开启', 0], ['5 分钟', 5], ['15 分钟', 15], ['30 分钟', 30], ['60 分钟', 60], ['90 分钟', 90]];
    var rows = opts.map(function (o) {
      var on = (o[1] === 0 && !sleepActive()) || (o[1] > 0 && sleepUntil > 0 && Math.abs(sleepLeft() - o[1] * 60000) < 60000);
      return {
        icon: 'fa-clock', label: o[0], on: on,
        run: function () { if (o[1] === 0) sleepCancel(true); else sleepStart(o[1], false); }
      };
    });
    rows.push({ icon: 'fa-music', label: '播完当前这首', on: sleepAfterTrack, run: function () { sleepStart(0, true); } });
    sheet('睡眠定时', rows);
  }

  /* ---------- 历史 / 收藏 列表页 ---------- */
  function listPage(title, items, opts) {
    if (!window.AppShell || !window.AppShell.openDetail) return;
    opts = opts || {};
    /* 这个列表的唯一入口是播放页「更多」面板，而播放页本身就是二级页：
       直接开会被「同时只允许一个二级页」的规则吃掉（表现为点了没反应）。
       所以先收起当前二级页，等它退场之后再开。 */
    if (window.AppShell.detailOpen()) {
      window.AppShell.closeDetail();
      setTimeout(function () { listPage(title, items, opts); }, 320);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'mp-list';
    if (!items.length) {
      var e = document.createElement('div');
      e.className = 'mp-empty';
      e.innerHTML = '<i class="fas ' + (opts.emptyIcon || 'fa-music') + '"></i>';
      var p = document.createElement('p');
      p.textContent = opts.emptyText || '还没有内容喵~';
      e.appendChild(p);
      wrap.appendChild(e);
    }
    items.forEach(function (s) {
      var row = document.createElement('div');
      row.className = 'mp-item';
      var img = document.createElement('img');
      img.className = 'mp-item-cover';
      img.alt = '';
      img.loading = 'lazy';
      if (s.cover) img.src = s.cover; else img.classList.add('noart');
      var info = document.createElement('div');
      info.className = 'mp-item-info';
      var nm = document.createElement('div');
      nm.className = 'mp-item-name';
      nm.textContent = s.name || '未知歌曲';
      var sub = document.createElement('div');
      sub.className = 'mp-item-sub';
      sub.textContent = s.artist || '未知歌手';
      info.appendChild(nm);
      info.appendChild(sub);
      var find = document.createElement('button');
      find.type = 'button';
      find.className = 'mp-item-btn';
      find.setAttribute('aria-label', '搜索这首歌');
      find.innerHTML = '<i class="fas fa-search"></i>';
      find.addEventListener('click', function (e) {
        e.stopPropagation();
        if (window.MusicAppSearch) window.MusicAppSearch('ns', (s.name + ' ' + (s.artist || '')).trim());
      });
      row.appendChild(img);
      row.appendChild(info);
      row.appendChild(find);
      if (opts.onRemove) {
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'mp-item-btn danger';
        del.setAttribute('aria-label', '移除');
        del.innerHTML = '<i class="fas ' + (opts.removeIcon || 'fa-heart') + '"></i>';
        del.addEventListener('click', function (e) {
          e.stopPropagation();
          opts.onRemove(s);
          row.parentNode && row.parentNode.removeChild(row);
          if (!wrap.querySelector('.mp-item')) listPage(title, [], opts);
        });
        row.appendChild(del);
      }
      row.addEventListener('click', function () {
        /* playEntry 内部取流成功后自己会收起二级页 */
        playEntry(s);
      });
      wrap.appendChild(row);
    });
    /* allowDesktop：这个列表在桌面端也要能打开（桌面端默认拒绝建二级页） */
    window.AppShell.openDetail({ title: title, content: wrap, swipeClose: true, allowDesktop: true });
  }

  /* ---------- 页面上的「最近播放」横向条（手机端才有位置放） ---------- */
  function buildRecentStrip() {
    var items = load(REC_KEY).slice(0, 10);
    var old = byId('mpRecentStrip');
    /* 桌面端不注入这条横条（样式只在 max-width:768px 里）。视口拉宽之后
       audio 的 play 事件仍会调到这里 —— 必须挡住，否则网页端会自己长出
       一条没样式的横条，这就是「移动端残留」。 */
    if (!narrow()) {
      if (old && old.parentNode) old.parentNode.removeChild(old);
      return;
    }
    if (!items.length) { if (old && old.parentNode) old.parentNode.removeChild(old); return; }
    if (old && old.getAttribute('data-first') === items[0].name) return;
    var card = q('.player-card');
    if (!card || !card.parentNode) return;
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var box = document.createElement('section');
    box.id = 'mpRecentStrip';
    box.className = 'mp-strip';
    box.setAttribute('data-first', items[0].name);
    var head = document.createElement('div');
    head.className = 'mp-strip-head';
    var ttl = document.createElement('span');
    ttl.textContent = '最近播放';
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'mp-strip-more';
    more.textContent = '全部';
    more.addEventListener('click', function () {
      listPage('播放历史', load(REC_KEY), { emptyIcon: 'fa-clock-rotate-left', emptyText: '还没有播放记录喵~' });
    });
    head.appendChild(ttl);
    head.appendChild(more);

    var row = document.createElement('div');
    row.className = 'mp-strip-row';
    items.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mp-strip-item';
      var im = document.createElement('img');
      im.alt = '';
      im.loading = 'lazy';
      if (s.cover) im.src = s.cover;
      var nm = document.createElement('span');
      nm.className = 'mp-strip-name';
      nm.textContent = s.name || '';
      b.appendChild(im);
      b.appendChild(nm);
      b.addEventListener('click', function () {
        playEntry(s);
      });
      row.appendChild(b);
    });
    box.appendChild(head);
    box.appendChild(row);
    card.parentNode.insertBefore(box, card.nextSibling);
  }

  /* ---------- 播放页主题：跟随封面 + 按曲名取一组固定配色 ---------- */
  var THEMES = [
    ['#ffd9e6', '#ffb0ca'], ['#dbe9ff', '#b6d2ff'], ['#e8dcff', '#c9b6ff'],
    ['#d9f5e8', '#a9e8cd'], ['#fff0d6', '#ffd79b'], ['#ffe2e2', '#ffbcbc'],
    ['#e0f2ff', '#aadeff'], ['#f7e2ff', '#e0b3ff']
  ];
  function themeFor(s) {
    var t = (s && (s.name || '') + (s && s.artist || '')) || '';
    var h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 9973;
    return THEMES[h % THEMES.length];
  }
  function paintStage() {
    var wrap = q('.fs-wrap');
    if (!wrap) return;
    var s = curSong();
    if (!s) return;
    var th = themeFor(s);
    wrap.style.setProperty('--mp-a', th[0]);
    wrap.style.setProperty('--mp-b', th[1]);
    if (s.cover) wrap.style.setProperty('--mp-cover', 'url("' + String(s.cover).replace(/"/g, '%22') + '")');
  }

  /* ---------- 播放页绑定：更多按钮/歌词切换/主题 ---------- */
  function bindStage(wrap) {
    if (!wrap || wrap.__mpBound) return;
    wrap.__mpBound = true;

    /* 倒计时徽标挂在顶栏中间 */
    var top = q('.fs-top', wrap);
    if (top && !byId('fsSleepBadge')) {
      var b = document.createElement('span');
      b.id = 'fsSleepBadge';
      b.className = 'fs-sleep-badge';
      b.style.display = 'none';
      var col = q('.fs-collapse', top);
      if (col) col.insertAdjacentElement('afterend', b); else top.insertBefore(b, top.firstChild);
    }
    sleepBadge();

    /* 点封面/歌词区域 = 两种视图来回切（主流播放页都这么切） */
    var cover = q('.fs-cover', wrap);
    var lyr = q('.fs-lyrics', wrap);
    /* 歌词按钮：给「点封面切歌词」一个看得见的入口（点封面、点按钮都能切） */
    if (top && !q('.fs-lyric', top)) {
      var lyricBtn = document.createElement('button');
      lyricBtn.type = 'button';
      lyricBtn.className = 'fs-icon fs-lyric';
      lyricBtn.setAttribute('aria-label', '歌词');
      lyricBtn.setAttribute('title', '歌词');
      lyricBtn.innerHTML = '<i class="fas fa-align-left"></i>';
      var moreBtn = q('.fs-more', top);
      if (moreBtn) top.insertBefore(lyricBtn, moreBtn); else top.appendChild(lyricBtn);
      lyricBtn.addEventListener('click', function () { flip(); });
    }

    function setLyric(on) {
      on = !!on;
      wrap.classList.toggle('lyric-mode', on);
      var lb = q('.fs-lyric', wrap);
      if (lb) {
        lb.classList.toggle('on', on);
        lb.setAttribute('aria-label', on ? '收起歌词' : '歌词');
        lb.setAttribute('title', on ? '回到唱片' : '歌词');
        lb.innerHTML = '<i class="fas ' + (on ? 'fa-compact-disc' : 'fa-align-left') + '"></i>';
      }
    }
    function flip() { setLyric(!wrap.classList.contains('lyric-mode')); }
    if (cover) cover.addEventListener('click', flip);
    if (lyr) lyr.addEventListener('click', function (e) {
      /* 歌词行本身可能带点击跳转，别抢 */
      if (e.target && e.target.closest && e.target.closest('.lrc-item,.lrc-line,.lyr-line,.lyric-line,.active')) return;
      flip();
    });
    paintStage();
  }

  /* ---------- 更多面板 ---------- */
  function menu() {
    var s = curSong();
    var fav = isFav(s);
    sheet('更多', [
      { icon: 'fa-heart', label: fav ? '取消收藏' : '收藏这首', on: fav, run: function () {
          var now = toggleFav(s);
          toast(now ? '已收藏喵~' : '已取消收藏');
        } },
      { icon: 'fa-clock', label: '睡眠定时', note: sleepActive() ? '已开启' : '', run: sleepSheet },
      { icon: 'fa-clock-rotate-left', label: '播放历史', run: function () {
          listPage('播放历史', load(REC_KEY), { emptyIcon: 'fa-clock-rotate-left', emptyText: '还没有播放记录喵~' });
        } },
      { icon: 'fa-heart', label: '我的收藏', run: function () {
          listPage('我的收藏', load(FAV_KEY), {
            emptyIcon: 'fa-heart', emptyText: '还没有收藏的歌喵~', removeIcon: 'fa-heart-crack',
            onRemove: function (it) { toggleFav(it); }
          });
        } },
      { icon: 'fa-share-nodes', label: '分享这首歌', run: function () {
          var text = s ? (s.name + (s.artist ? ' - ' + s.artist : '')) : '喵喵音乐';
          var data = { title: text, text: '🌸 ' + text, url: location.href };
          if (navigator.share) { navigator.share(data).catch(function () {}); return; }
          try {
            navigator.clipboard.writeText(text + ' ' + location.href).then(function () { toast('已复制分享内容喵~'); });
          } catch (e) { toast('复制失败喵~'); }
        } },
      { icon: 'fa-chevron-down', label: '收起播放页', run: function () {
          var c = q('.fs-collapse');
          if (c) c.click();
        } }
    ]);
  }
  /* 阶段五：把 listPage / 播放历史收藏的存储键 / playEntry 也导出去 ——
     js/music-pages.js 要用同一套列表页与同一条播放入口，不另造一份。
     REC_KEY='dsh-music-rec'（播放历史）、FAV_KEY='dsh-music-fav'（收藏）。 */
  window.MusicPlus = {
    menu: menu, sheet: sheet, sleepSheet: sleepSheet, record: record, toast: toast,
    listPage: listPage, playEntry: playEntry, curSong: curSong,
    REC_KEY: REC_KEY, FAV_KEY: FAV_KEY
  };

  /* ---------- 初始化 ---------- */
  /* ---------- 桌面端：同一套功能，复用站点的 .mode-strip / .mode-chip ---------- */
  function initDesktop() {
    var panel = q('.player-right .lyric-panel') || byId('lyricBox');
    var extra = q('.player-right .extra-actions') || q('.extra-actions');
    if (!panel || !panel.parentNode || !extra) return;
    if (byId('deskActions')) return;

    var row = document.createElement('div');
    row.id = 'deskActions';
    row.className = 'mode-strip';
    extra.appendChild(row);

    function chip(icon, text, run) {
      var b = document.createElement('div');
      b.className = 'mode-chip';
      b.setAttribute('role', 'button');
      b.setAttribute('tabindex', '0');
      b.setAttribute('title', text);
      b.innerHTML = '<i class="fas ' + icon + '"></i><span class="chip-txt"></span>';
      var lab = b.querySelector('.chip-txt');
      if (lab) lab.textContent = text;
      b.addEventListener('click', function (ev) { ev.stopPropagation(); run(b); });
      b.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); run(b); } });
      return b;
    }

    function openLyricPage() {
      if (!window.AppShell || !window.AppShell.openDetail) return;
      if (window.AppShell.detailOpen()) return;
      var host = document.createElement('div');
      host.className = 'detail-lyric';
      var sh = window.AppShell.openDetail({ title: '歌词', allowDesktop: true, content: host });
      if (!sh || !sh.el) return;
      /* 搬真的歌词面板进去，不复制：复制等于高亮和自动滚动全死 */
      var p = q('.player-right .lyric-panel') || byId('lyricBox');
      if (p) window.AppShell.adopt(p, host);
    }

    chip('fa-align-left', '歌词页', openLyricPage);

    var favChip = chip('fa-heart', '收藏', function (b) {
      var now = toggleFav(curSong());
      toast(now ? '已收藏喵~' : '已取消收藏');
      syncFav(b);
    });
    function syncFav(b) {
      var on = isFav(curSong());
      b.classList.toggle('on', !!on);
      b.setAttribute('title', on ? '取消收藏' : '收藏这首');
      var i = b.querySelector('i');
      if (i) i.className = 'fas ' + (on ? 'fa-heart-crack' : 'fa-heart');
      var s = b.querySelector('.chip-txt');
      if (s) s.textContent = on ? '取消收藏' : '收藏';
    }
    syncFav(favChip);
    /* 换歌时把收藏状态跟上 */
    var nameEl = byId('trackName');
    if (nameEl && 'MutationObserver' in window) {
      nameEl.__mpFavObs = new MutationObserver(function () { syncFav(favChip); });
      nameEl.__mpFavObs.observe(nameEl, { childList: true, characterData: true, subtree: true });
    }

    chip('fa-clock', '睡眠定时', function () { sleepSheet(); });
    chip('fa-clock-rotate-left', '播放历史', function () {
      listPage('播放历史', load(REC_KEY), { emptyIcon: 'fa-clock-rotate-left', emptyText: '还没有播放记录喵~' });
    });
    chip('fa-heart', '我的收藏', function () {
      listPage('我的收藏', load(FAV_KEY), {
        emptyIcon: 'fa-heart', emptyText: '还没有收藏的歌喵~', removeIcon: 'fa-heart-crack',
        onRemove: function (it) { toggleFav(it); }
      });
    });
    chip('fa-share-nodes', '分享', function () {
      var s = curSong();
      var text = s ? (s.name + (s.artist ? ' - ' + s.artist : '')) : '喵喵音乐';
      var data = { title: text, text: '🌸 ' + text, url: location.href };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      try {
        navigator.clipboard.writeText(text + ' ' + location.href).then(function () { toast('已复制分享内容喵~'); });
      } catch (err) { toast('复制失败喵~'); }
    });

    /* 点歌词面板能进歌词页。处理函数挂在节点上，视口切回手机端时要能摘掉，不残留。 */
    panel.__mpClick = openLyricPage;
    panel.addEventListener('click', panel.__mpClick);
    panel.setAttribute('title', '点一下打开歌词页');
    /* 点唱片由 music-app.js 负责（进全屏播放页），这里**不再**绑定。
       原来两边都往 #coverInner 挂 click：
         music-app.js  → openFull()       （进全屏播放页）
         music-plus.js → openLyricPage()  （进歌词页）
       一次点击两个都会触发，而两边都带 if (AppShell.detailOpen()) return 守卫，
       于是谁先执行谁赢、另一个被静默吞掉 —— 用户点封面时行为随机，
       表现为「有时进播放页、有时进歌词页」，是最难查的一类失败。
       已定：点封面 = 进全屏播放页；歌词页在播放页内由 fs-lyric 按钮切换
       （music-plus.js:559-584 的 lyric-mode），不再需要第二个封面入口。 */
  }

    function initMobile() {
    if (!narrow()) return;
    /* 监听器/观察者只绑一次，模式切回来时只补 DOM */
    if (mobileBound) return;
    mobileBound = true;

    var audio = byId('nativeAudio');
    if (audio) {
      audio.addEventListener('loadedmetadata', function () { record(); paintStage(); buildRecentStrip(); });
      audio.addEventListener('play', function () { record(); paintStage(); buildRecentStrip(); });
      audio.addEventListener('ended', function () {
        if (sleepAfterTrack) fireSleep();
      });
    }
    /* 曲名/封面变化 → 重绘主题（bundle 换歌会改这两个节点） */
    var nameEl = byId('trackName');
    if (nameEl && 'MutationObserver' in window) {
      new MutationObserver(function () { paintStage(); }).observe(nameEl, { childList: true, characterData: true, subtree: true });
      var coverEl = byId('coverImg');
      if (coverEl) new MutationObserver(function () { paintStage(); }).observe(coverEl, { attributes: true, attributeFilter: ['src'] });
    }

    /* 刷新后把没到点的睡眠定时续上 */
    try {
      var saved = parseInt(localStorage.getItem(SLEEP_KEY) || '0', 10);
      if (saved && saved > Date.now()) sleepStart(Math.round((saved - Date.now()) / 60000), false);
      else if (saved) { try { localStorage.removeItem(SLEEP_KEY); } catch (e) {} }
    } catch (e) {}

    /* 播放页是后建的（music-app.js 在点开时才建）—— 等它出现再绑 */
    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function () {
        var wrap = q('.fs-wrap');
        if (wrap) bindStage(wrap);
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    bindStage(q('.fs-wrap'));
    buildRecentStrip();
  }

  function init() {
    bindResume();
    if (narrow()) initMobile();
    else initDesktop();
    setTimeout(restoreResume, 1500);   /* 等 bundle 把歌单恢复完再续 */
  }

  /* ---------- 视口跨越 768px：两端注入的节点互相拆干净 ---------- */
  var mobileBound = false;

  function dropNode(id) {
    var el = byId(id);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  function dropClick(el) {
    if (el && el.__mpClick) { el.removeEventListener('click', el.__mpClick); el.__mpClick = null; }
  }
  function clearDesktopEntry() {
    dropNode('deskActions');
    var panel = q('.player-right .lyric-panel') || byId('lyricBox');
    dropClick(panel);
    if (panel) { panel.removeAttribute('title'); panel.style.cursor = ''; }
    /* #coverInner 归 music-app.js 管（点封面进全屏播放页），这里不再清理它。
       原先这里会 removeAttribute('title') + cursor='' —— 那是为 music-plus 自己
       挂的封面入口做收尾。既然本文件已不再绑定封面，继续清理就会去动
       别的模块的节点：music-app 的 openFull 入口还在，title/cursor 被抹掉
       属于越权修改，之后没有任何地方会补回来。 */
    var nameEl = byId('trackName');
    if (nameEl && nameEl.__mpFavObs) { nameEl.__mpFavObs.disconnect(); nameEl.__mpFavObs = null; }
  }

  function applyMode(isNarrow) {
    if (isNarrow === undefined) isNarrow = narrow();
    if (isNarrow) {
      clearDesktopEntry();   /* 拆掉网页端的入口 */
      initMobile();          /* 已绑过监听就只补 DOM */
      buildRecentStrip();
      paintStage();
    } else {
      dropNode('mpRecentStrip');   /* 拆掉手机端的横条 */
      initDesktop();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  if (window.AppShell && window.AppShell.onMode) window.AppShell.onMode(applyMode);
})();
