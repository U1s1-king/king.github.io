/* ============================================================
 * 音乐页二级页集合  js/music-pages.js
 * ------------------------------------------------------------
 * 只被 music.html 引用。全部通过 AppShell.openDetail() 开层 ——
 * 和 TV / 日记 / 归档 用的是同一个机制（.detail-view + pushState 哨兵），
 * 所以返回键、下滑收起、左右滑都是现成的。
 *
 * 参照 Spotify Mobile UI Kit 里**这个站真有功能支撑**的那几屏：
 *   Album View  → 艺人 / 专辑详情（数据来自 data/playlist.json）
 *   Settings    → 设置页（把散落各处的开关收成一页）
 *   Song Share  → 分享卡片（canvas 生成可保存的图）
 *   Library     → 播放历史 / 我的收藏（复用 music-plus.js 的 listPage）
 *   歌词页       → 把真实歌词面板搬进独立一层
 * 没有对应功能的屏（Start / Signup / Choose Artists / Listening on /
 * Scanning for Spotify codes / Album Radio）**刻意不做** —— 照抄只会得到空壳。
 *
 * 播放策略：不自己解析音源，而是**点回 #playlistContainer 里已渲染的那一行**，
 * 复用 music-bundle.js 现成的官方曲库播放路径。music-plus.js 的 playEntry()
 * 对没有 platform/id 的官方歌曲会退化成「B 站按名搜索」，慢且不可靠。
 * ============================================================ */
(function () {
  'use strict';

  var DATA_URL = 'data/playlist.json';
  var songs = null;
  var waiting = null;

  function byId(id) { return document.getElementById(id); }
  function q(s, r) { return (r || document).querySelector(s); }
  function narrow() {
    try { return window.matchMedia('(max-width:768px)').matches; }
    catch (e) { return window.innerWidth <= 768; }
  }
  function toast(m) { if (window.MusicPlus && window.MusicPlus.toast) window.MusicPlus.toast(m); }

  function detailOpen() {
    return !!(window.AppShell && window.AppShell.detailOpen && window.AppShell.detailOpen());
  }
  /* 二级页同时只允许一层：已经在层里就先收起，等退场再开 */
  function open(opts) {
    if (!window.AppShell || !window.AppShell.openDetail) return null;
    if (detailOpen()) {
      window.AppShell.closeDetail();
      setTimeout(function () { open(opts); }, 320);
      return null;
    }
    return window.AppShell.openDetail(opts);
  }

  /* ---------- 数据：data/playlist.json ---------- */
  function loadSongs(cb) {
    if (songs) return cb(songs);
    if (waiting) { waiting.push(cb); return; }
    waiting = [cb];
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var l = d && d.lists && d.lists[0];
        songs = (l && l.songs) || [];
      })
      .catch(function () { songs = []; })
      .then(function () {
        var q = waiting; waiting = null;
        (q || []).forEach(function (f) { f(songs); });
      });
  }

  function groupByArtist(list) {
    var map = {}, order = [];
    list.forEach(function (s) {
      var a = (s.artist || '').trim() || '未知歌手';
      if (!map[a]) { map[a] = []; order.push(a); }
      map[a].push(s);
    });
    return order.map(function (a) { return { artist: a, songs: map[a] }; });
  }

  var THEMES = [
    ['#ffd9e6', '#ffb0ca'], ['#dbe9ff', '#b6d2ff'], ['#e8dcff', '#c9b6ff'],
    ['#d9f5e8', '#a9e8cd'], ['#fff0d6', '#ffd79b'], ['#ffe2e2', '#ffbcbc'],
    ['#e0f2ff', '#aadeff'], ['#f7e2ff', '#e0b3ff']
  ];
  function themeFor(t) {
    var h = 0;
    t = t || '';
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 9973;
    return THEMES[h % THEMES.length];
  }
  function grad(t) { var c = themeFor(t); return 'linear-gradient(140deg,' + c[0] + ',' + c[1] + ')'; }

  /* ---------- 播放：点回已有的列表行 ---------- */
  function ensureOfficialView(done) {
    var chip = document.querySelector('#plViews .pl-view[data-view="official"]');
    var isOn = chip && chip.classList.contains('active');
    if (isOn || !chip) { done(); return; }
    chip.click();
    setTimeout(done, 120);
  }
  function playByName(name, artist) {
    ensureOfficialView(function () {
      var box = byId('playlistContainer');
      if (!box) { toast('播放器还没就绪喵~'); return; }
      var items = box.querySelectorAll('.track-item');
      var loose = null;
      for (var i = 0; i < items.length; i++) {
        var info = q('.track-info', items[i]);
        var t = info ? (info.textContent || '').replace(/^\s+/, '').trim() : '';
        if (t === name) { items[i].click(); return; }
        if (!loose && t && name && (t.indexOf(name) >= 0 || name.indexOf(t) >= 0)) loose = items[i];
      }
      if (loose) { loose.click(); return; }
      toast('没在歌单里找到这首喵~');
    });
  }

  /* ---------- 通用：带渐变封面位的列表 ---------- */
  function songRow(song, sub) {
    var row = document.createElement('div');
    row.className = 'mp-item';
    var av = document.createElement('span');
    av.className = 'mp-art';
    av.style.background = grad(song.artist || song.name);
    av.innerHTML = '<i class="fas fa-music"></i>';
    var info = document.createElement('div');
    info.className = 'mp-item-info';
    var nm = document.createElement('div');
    nm.className = 'mp-item-name';
    nm.textContent = song.name || '未知歌曲';
    var sb = document.createElement('div');
    sb.className = 'mp-item-sub';
    sb.textContent = sub || song.artist || '';
    info.appendChild(nm);
    info.appendChild(sb);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mp-item-btn';
    btn.setAttribute('aria-label', '播放');
    btn.innerHTML = '<i class="fas fa-play"></i>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      playByName(song.name, song.artist);
    });
    row.appendChild(av);
    row.appendChild(info);
    row.appendChild(btn);
    row.addEventListener('click', function () { playByName(song.name, song.artist); });
    return row;
  }

  /* ============================================================
     1. 艺人列表（Album View 的入口）
     ============================================================ */
  function artists() {
    loadSongs(function (list) {
      var groups = groupByArtist(list);
      var wrap = document.createElement('div');
      wrap.className = 'mp-list mp-list-rich';
      if (!groups.length) {
        var e = document.createElement('div');
        e.className = 'mp-empty';
        e.innerHTML = '<i class="fas fa-user-astronaut"></i><p>曲库还没读出来喵~</p>';
        wrap.appendChild(e);
      }
      groups.forEach(function (g) {
        var row = document.createElement('div');
        row.className = 'mp-item';
        var av = document.createElement('span');
        av.className = 'mp-art mp-art-round';
        av.style.background = grad(g.artist);
        av.textContent = (g.artist || '?').slice(0, 1);
        var info = document.createElement('div');
        info.className = 'mp-item-info';
        var nm = document.createElement('div');
        nm.className = 'mp-item-name';
        nm.textContent = g.artist;
        var sb = document.createElement('div');
        sb.className = 'mp-item-sub';
        sb.textContent = g.songs.length + ' 首';
        info.appendChild(nm);
        info.appendChild(sb);
        var arrow = document.createElement('span');
        arrow.className = 'mp-arrow';
        arrow.innerHTML = '<i class="fas fa-chevron-right"></i>';
        row.appendChild(av);
        row.appendChild(info);
        row.appendChild(arrow);
        row.addEventListener('click', function () { artist(g.artist, true); });
        wrap.appendChild(row);
      });
      open({ title: '艺人 · ' + groups.length, content: wrap, swipeClose: true, allowDesktop: true });
    });
  }

  /* ============================================================
     2. 艺人 / 专辑详情
     ============================================================ */
  function artist(name, stacked) {
    loadSongs(function (list) {
      var mine = list.filter(function (s) { return ((s.artist || '').trim() || '未知歌手') === name; });
      var wrap = document.createElement('div');
      wrap.className = 'mp-artist';

      /* 英雄区：渐变底 + 大封面位 + 艺人名 + 曲目数 + 播放键 */
      var hero = document.createElement('div');
      hero.className = 'mp-hero';
      hero.style.background = grad(name);
      var art = document.createElement('span');
      art.className = 'mp-hero-art';
      art.innerHTML = '<i class="fas fa-compact-disc"></i>';
      var meta = document.createElement('div');
      meta.className = 'mp-hero-meta';
      var h = document.createElement('h2');
      h.className = 'mp-hero-name';
      h.textContent = name;
      var cnt = document.createElement('p');
      cnt.className = 'mp-hero-sub';
      cnt.textContent = mine.length + ' 首 · 官方推荐';
      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'mp-hero-play';
      play.innerHTML = '<i class="fas fa-play"></i> 播放';
      play.addEventListener('click', function () {
        if (!mine.length) return;
        playByName(mine[0].name, mine[0].artist);
      });
      meta.appendChild(h);
      meta.appendChild(cnt);
      meta.appendChild(play);
      hero.appendChild(art);
      hero.appendChild(meta);
      wrap.appendChild(hero);

      var box = document.createElement('div');
      box.className = 'mp-list';
      mine.forEach(function (s, i) { box.appendChild(songRow(s, '曲目 ' + (i + 1))); });
      wrap.appendChild(box);

      var title = name;
      if (!stacked && detailOpen()) {
        /* 直接点进来时先收当前层，避免一次开两层 */
        window.AppShell.closeDetail();
        setTimeout(function () {
          open({ title: title, content: wrap, swipeClose: true, allowDesktop: true });
        }, 320);
        return;
      }
      open({ title: title, content: wrap, swipeClose: true, allowDesktop: true });
    });
  }

  /* ============================================================
     3. 设置页
     ============================================================ */
  function rowGroup(title) {
    var g = document.createElement('div');
    g.className = 'mp-group';
    if (title) {
      var t = document.createElement('div');
      t.className = 'mp-group-title';
      t.textContent = title;
      g.appendChild(t);
    }
    return g;
  }
  function row(label, note) {
    var r = document.createElement('div');
    r.className = 'mp-row';
    var l = document.createElement('span');
    l.className = 'mp-row-name';
    l.textContent = label;
    r.appendChild(l);
    if (note) {
      var n = document.createElement('span');
      n.className = 'mp-row-note';
      n.textContent = note;
      r.appendChild(n);
    }
    return r;
  }
  function readLS(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

  function settings() {
    var wrap = document.createElement('div');
    wrap.className = 'mp-settings';

    /* --- 播放 --- */
    var g1 = rowGroup('播放');
    var vol = row('默认音量');
    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0'; slider.max = '1'; slider.step = '0.01';
    slider.className = 'mp-slider';
    var audio = byId('nativeAudio');
    slider.value = readLS('sakuraVol', String(audio ? audio.volume : 0.7));
    slider.addEventListener('input', function () {
      var v = parseFloat(slider.value);
      if (audio) audio.volume = v;
      var range = byId('volumeRange');
      if (range) { range.value = v; range.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    vol.appendChild(slider);
    g1.appendChild(vol);

    var g2 = rowGroup('播放倍速');
    var speeds = [0.75, 1, 1.25, 1.5, 2];
    var chipBox = document.createElement('div');
    chipBox.className = 'mp-chips';
    speeds.forEach(function (v) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mp-chip';
      b.textContent = v.toFixed(2).replace(/0$/, '') + 'x';
      var cur = audio ? (audio.playbackRate || 1) : 1;
      if (Math.abs(cur - v) < 0.01) b.classList.add('on');
      b.addEventListener('click', function () {
        if (audio) audio.playbackRate = v;
        var sv = byId('speedVal');
        if (sv) sv.textContent = v.toFixed(2) + 'x';
        chipBox.querySelectorAll('.mp-chip').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      });
      chipBox.appendChild(b);
    });
    g2.appendChild(chipBox);

    var g3 = rowGroup('播放模式');
    var rep = row('单曲循环');
    rep.classList.add('mp-row-btn');
    rep.addEventListener('click', function () {
      var b = byId('repeatModeBtn'); if (b) b.click();
      setTimeout(function () {
        rep.classList.toggle('on', !!(b && (b.classList.contains('on') || b.classList.contains('active'))));
      }, 60);
    });
    var shf = row('随机播放');
    shf.classList.add('mp-row-btn');
    shf.addEventListener('click', function () {
      var b = byId('shuffleModeBtn'); if (b) b.click();
      setTimeout(function () {
        shf.classList.toggle('on', !!(b && (b.classList.contains('on') || b.classList.contains('active'))));
      }, 60);
    });
    g3.appendChild(rep);
    g3.appendChild(shf);
    var sleep = row('睡眠定时', '播完当前曲或到点自动停');
    sleep.classList.add('mp-row-btn');
    sleep.addEventListener('click', function () {
      if (window.MusicPlus && window.MusicPlus.sleepSheet) window.MusicPlus.sleepSheet();
    });
    g3.appendChild(sleep);

    /* --- 内容 --- */
    var g4 = rowGroup('内容');
    var hist = row('播放历史');
    hist.classList.add('mp-row-btn');
    hist.addEventListener('click', function () {
      if (!window.MusicPlus || !window.MusicPlus.listPage) return;
      var items = [];
      try { items = JSON.parse(readLS('dsh-music-rec', '[]')) || []; } catch (e) {}
      window.AppShell.closeDetail();
      setTimeout(function () {
        window.MusicPlus.listPage('播放历史', items, {
          emptyIcon: 'fa-clock-rotate-left', emptyText: '还没有播放记录喵~'
        });
      }, 320);
    });
    var favs = row('我的收藏');
    favs.classList.add('mp-row-btn');
    favs.addEventListener('click', function () {
      if (!window.MusicPlus || !window.MusicPlus.listPage) return;
      var items = [];
      try { items = JSON.parse(readLS('dsh-music-fav', '[]')) || []; } catch (e) {}
      window.AppShell.closeDetail();
      setTimeout(function () {
        window.MusicPlus.listPage('我的收藏', items, {
          emptyIcon: 'fa-heart', emptyText: '还没有收藏的歌喵~'
        });
      }, 320);
    });
    g4.appendChild(hist);
    g4.appendChild(favs);
    var browse = row('按艺人浏览', '官方推荐 ' + '的全部曲目');
    browse.classList.add('mp-row-btn');
    browse.addEventListener('click', function () {
      window.AppShell.closeDetail();
      setTimeout(artists, 320);
    });
    g4.appendChild(browse);

    /* --- 存储 --- */
    var g5 = rowGroup('存储');
    var clrHis = row('清空播放历史');
    clrHis.classList.add('mp-row-btn', 'danger');
    clrHis.addEventListener('click', function () {
      try { localStorage.removeItem('dsh-music-rec'); } catch (e) {}
      toast('播放历史已清空');
    });
    var clrCache = row('清空上传缓存', '本地音乐记录');
    clrCache.classList.add('mp-row-btn', 'danger');
    clrCache.addEventListener('click', function () {
      var b = byId('clearUploadCacheBtn');
      if (b) { b.click(); return; }
      try { localStorage.removeItem('sakuraUserPlaylist'); } catch (e) {}
      toast('缓存已清空');
    });
    g5.appendChild(clrHis);
    g5.appendChild(clrCache);

    [g1, g2, g3, g4, g5].forEach(function (g) { wrap.appendChild(g); });
    open({ title: '设置', content: wrap, swipeClose: true, allowDesktop: true });
  }

  /* ============================================================
     4. 分享卡片：canvas 生成可保存的图
     ============================================================ */
  function currentSong() {
    var name = (byId('trackName') || {}).textContent || '';
    var artistEl = byId('trackArtist');
    var artist = artistEl ? (artistEl.textContent || '').replace(/^\s+/, '').trim() : '';
    /* 空状态的占位文案不是真歌手名，别把它印到分享卡片上 */
    if (artist.indexOf('点击') >= 0 && artist.indexOf('添加音乐') >= 0) artist = '';
    name = name.trim();
    if (!name || name.indexOf('空空的喵') >= 0) name = '本喵的音乐盒';
    return { name: name, artist: artist };
  }

  function drawCard(song) {
    var W = 750, H = 1000;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var th = themeFor(song.name + song.artist);

    /* 背景：主题渐变 + 一层柔光 */
    var bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, th[0]);
    bg.addColorStop(1, th[1]);
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    var glow = g.createRadialGradient(W * 0.5, H * 0.34, 40, W * 0.5, H * 0.34, W * 0.7);
    glow.addColorStop(0, 'rgba(255,255,255,.55)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    /* 封面位：圆角方块 + 唱片图标 */
    var S = 360, x = (W - S) / 2, y = 170;
    g.save();
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, S, S, 36); else g.rect(x, y, S, S);
    g.clip();
    var cg = g.createLinearGradient(x, y, x + S, y + S);
    cg.addColorStop(0, 'rgba(255,255,255,.92)');
    cg.addColorStop(1, 'rgba(255,255,255,.62)');
    g.fillStyle = cg;
    g.fillRect(x, y, S, S);
    g.fillStyle = 'rgba(232,93,134,.75)';
    g.beginPath(); g.arc(W / 2, y + S / 2, 74, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.arc(W / 2, y + S / 2, 20, 0, Math.PI * 2); g.fill();
    g.restore();

    /* 文字 */
    g.textAlign = 'center';
    g.fillStyle = '#7a3f52';
    g.font = '700 46px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    var nm = song.name;
    while (g.measureText(nm).width > W - 120 && nm.length > 4) nm = nm.slice(0, -2);
    if (nm !== song.name) nm += '…';
    g.fillText(nm, W / 2, y + S + 96);

    g.fillStyle = 'rgba(122,63,82,.72)';
    g.font = '400 30px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    g.fillText(song.artist || '未知歌手', W / 2, y + S + 146);

    /* 水印 */
    g.fillStyle = 'rgba(122,63,82,.5)';
    g.font = '400 24px "PingFang SC","Microsoft YaHei",system-ui,sans-serif';
    g.fillText('本喵的音乐盒 · zhaokening.ccwu.cc', W / 2, H - 90);
    return c;
  }

  function share() {
    var song = currentSong();
    var wrap = document.createElement('div');
    wrap.className = 'mp-share';

    var canvas = drawCard(song);
    canvas.className = 'mp-share-canvas';
    wrap.appendChild(canvas);

    var bar = document.createElement('div');
    bar.className = 'mp-share-bar';

    var save = document.createElement('button');
    save.type = 'button';
    save.className = 'mp-share-btn';
    save.innerHTML = '<i class="fas fa-download"></i> 保存图片';
    save.addEventListener('click', function () {
      try {
        var url = canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'music-card-' + Date.now() + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) { toast('保存失败，可长按图片另存喵~'); }
    });

    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'mp-share-btn ghost';
    copy.innerHTML = '<i class="fas fa-link"></i> 复制文案';
    copy.addEventListener('click', function () {
      var text = '🌸 ' + song.name + (song.artist ? ' - ' + song.artist : '') + ' ' + location.href;
      if (navigator.share) { navigator.share({ title: song.name, text: text, url: location.href }).catch(function () {}); return; }
      try {
        navigator.clipboard.writeText(text).then(function () { toast('已复制分享内容喵~'); });
      } catch (e) { toast('复制失败喵'); }
    });

    bar.appendChild(save);
    bar.appendChild(copy);
    wrap.appendChild(bar);

    var tip = document.createElement('p');
    tip.className = 'mp-share-tip';
    tip.textContent = '长按图片也可以直接保存到相册';
    wrap.appendChild(tip);

    open({ title: '分享', content: wrap, swipeClose: true, allowDesktop: true });
  }

  /* ============================================================
     5. 歌词页：把真实歌词面板搬进独立一层（不复制，复制会丢掉高亮与自动滚动）
     ============================================================ */
  function lyrics() {
    if (!window.AppShell || !window.AppShell.openDetail) return;
    var host = document.createElement('div');
    host.className = 'detail-lyric';
    var sh = open({ title: '歌词', allowDesktop: true, content: host, swipeClose: true });
    if (!sh || !sh.el) return;
    var panel = byId('lyricBox');
    if (panel) window.AppShell.adopt(panel, host);
  }

  window.MusicPages = {
    artists: artists,
    artist: artist,
    settings: settings,
    share: share,
    lyrics: lyrics,
    playByName: playByName
  };
})();
