/* ============================================================
 * 樱花音乐 · 统一音乐 API 网关  (js/music-api.js)
 * ------------------------------------------------------------
 * 把三套原本互不相干的音源合并成一套接口：
 *   1. 自建网易云网关  https://sakura-music-api.pages.dev
 *      —— 搜索 / 歌曲详情 / 歌词 / 歌单 / 排行榜 / 推荐 / 歌手
 *   2. Meting 多平台镜像（原有）
 *      —— 网易云 / QQ / 酷狗 / 咪咕 / B站 的搜索与可播放地址
 *   3. iTunes Search API（原有）
 *      —— 免费、无 key、带 30 秒试听
 *
 * 统一模型：任何音源的结果都归一成同一个 Song 结构，都带 uid / id，
 * 这样点开任意一首歌都能再去取高音质地址和逐行歌词。
 * ============================================================ */
(function (global) {
  'use strict';

  // ---------------------------------------------------------- 配置

  var GATEWAY = 'https://sakura-music-api.pages.dev';

  // Meting 镜像。qijieya 是站点原有主镜像；backup 已失效（521）故移除，
  // 换成自建网关的 /api/meting（它内部会依次尝试所有镜像）。
  var METING = ['https://api.qijieya.cn/meting/'];

  var ITUNES = 'https://itunes.apple.com/search';

  var PLATFORMS = [
    ['all', '全部平台'],
    ['netease', '网易云'],
    ['tencent', 'QQ音乐'],
    ['kugou', '酷狗'],
    ['migu', '咪咕'],
    ['bilibili', 'B站'],
    ['itunes', 'iTunes']
  ];

  // 音质档位（仅网易云自建网关支持）
  var LEVELS = [
    ['standard', '标准'],
    ['higher', '较高'],
    ['exhigh', '极高'],
    ['lossless', '无损']
  ];

  var TIMEOUT = 12000;

  // ---------------------------------------------------------- 小工具

  function stripHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toSeconds(v) {
    var n = Number(v) || 0;
    if (n > 100000) return Math.round(n / 1000); // 毫秒
    return Math.round(n);
  }

  function formatTime(sec) {
    sec = Math.floor(Number(sec) || 0);
    if (!isFinite(sec) || sec < 0) return '0:00';
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  /** 归一化后的「歌手 + 歌名」指纹，用于去重 */
  function fingerprint(name, artist) {
    return String(name || '')
      .toLowerCase()
      .replace(/[\s\-_()（）[\]【】·、,，.。!！?？'"~～]/g, '')
      .slice(0, 40) + '|' + String(artist || '')
      .toLowerCase()
      .split(/[\/,&，、]/)[0]
      .replace(/\s/g, '')
      .slice(0, 20);
  }

  // ---------------------------------------------------------- 统一歌曲模型

  function makeSong(o) {
    o = o || {};
    var platform = o.platform || 'netease';
    var id = o.id != null && o.id !== '' ? String(o.id) : '';
    var name = stripHtml(o.name || o.title || '未知歌曲');
    var artist = stripHtml(o.artist || o.author || '');
    var song = {
      platform: platform,
      id: id,
      name: name,
      artist: artist,
      album: stripHtml(o.album || ''),
      cover: o.cover || o.pic || '',
      duration: toSeconds(o.duration),
      url: o.url || '',
      lrc: o.lrc || o.lyric || '',
      fee: o.fee || 0,
      level: o.level || '',
      isTrial: !!o.isTrial,
      isLocal: !!o.isLocal
    };
    song.uid = platform + ':' + (id || fingerprint(name, artist));
    return song;
  }

  /** 网易云自建网关 -> Song */
  function fromGateway(s) {
    return makeSong({
      platform: s.platform || 'netease',
      id: s.id,
      name: s.name,
      artist: s.artist,
      album: s.album,
      cover: s.cover,
      duration: s.duration, // 毫秒，toSeconds 会处理
      fee: s.fee,
      lrc: s.lrc || ''
    });
  }

  /** Meting -> Song */
  function fromMeting(s, platform) {
    return makeSong({
      platform: platform,
      id: s.id || s.songid || s.song_id || '',
      name: s.name || s.title,
      artist: s.artist || s.author,
      album: s.album || '',
      cover: s.pic || s.cover,
      duration: s.duration || s.length,
      url: s.url,
      lrc: s.lrc || s.lyric
    });
  }

  /** iTunes -> Song */
  function fromItunes(s) {
    return makeSong({
      platform: 'itunes',
      id: s.trackId,
      name: s.trackName,
      artist: s.artistName,
      album: s.collectionName,
      cover: (s.artworkUrl100 || '').replace('100x100', '300x300'),
      duration: Math.round((s.trackTimeMillis || 0) / 1000),
      url: s.previewUrl || '',
      isTrial: true
    });
  }

  // ---------------------------------------------------------- 请求层

  function withTimeout(url, opts) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    if (ctrl) {
      timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
      opts = Object.assign({}, opts || {}, { signal: ctrl.signal });
    }
    return fetch(url, opts).then(
      function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) {
          var err = new Error('HTTP ' + res.status);
          err.status = res.status;
          throw err;
        }
        return res;
      },
      function (e) {
        if (timer) clearTimeout(timer);
        throw e;
      }
    );
  }

  function getJSON(url) {
    return withTimeout(url).then(function (r) { return r.json(); });
  }

  function getText(url) {
    return withTimeout(url).then(function (r) { return r.text(); });
  }

  /** 自建网关调用：统一解包 {ok, data} */
  function gateway(path, params) {
    var qs = new URLSearchParams(params || {}).toString();
    return getJSON(GATEWAY + path + (qs ? '?' + qs : '')).then(function (j) {
      if (!j || j.ok === false) throw new Error((j && j.error) || '网关返回失败');
      return j.data;
    });
  }

  /** Meting 调用（本地镜像优先，失败落到自建网关的代理） */
  function meting(params) {
    var qs = new URLSearchParams(params).toString();
    var urls = METING.map(function (m) { return m + '?' + qs; });
    urls.push(GATEWAY + '/api/meting?' + qs);

    return new Promise(function (resolve, reject) {
      var i = 0;
      (function step() {
        if (i >= urls.length) return reject(new Error('所有音源镜像都不可用'));
        var u = urls[i++];
        getText(u).then(
          function (text) {
            if (!text || !text.trim()) return step();
            resolve({ text: text, url: u });
          },
          function () { step(); }
        );
      })();
    });
  }

  // ---------------------------------------------------------- 缓存

  var CACHE_PREFIX = 'sakuraMusicCache:';

  function cacheKey(parts) {
    return CACHE_PREFIX + parts.join('|');
  }

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || obj.expire < Date.now()) {
        localStorage.removeItem(key);
        return null;
      }
      return obj.value;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, value, ttlSeconds) {
    try {
      localStorage.setItem(key, JSON.stringify({ value: value, expire: Date.now() + ttlSeconds * 1000 }));
    } catch (e) {
      /* 配额满就放弃缓存，不影响功能 */
    }
    return value;
  }

  function cached(key, ttl, producer) {
    var hit = cacheGet(key);
    if (hit !== null && hit !== undefined) return Promise.resolve(hit);
    return Promise.resolve(producer()).then(function (v) {
      /* 空结果绝不入缓存。原来只判断 null/undefined，空字符串会被当成有效结果
         存 24 小时——歌词一旦取失败（比如网关风控），这一整天里每次播放都「没有歌词」。 */
      var empty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
      if (!empty) cacheSet(key, v, ttl);
      return v;
    });
  }

  /* 历史上被写进缓存的空歌词要清掉，否则修了写入逻辑它们还会继续生效一天。 */
  (function purgeEmptyLyricCache() {
    try {
      var dead = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(CACHE_PREFIX + 'lyric') !== 0) continue;
        var raw = localStorage.getItem(k);
        if (!raw) continue;
        var obj = null;
        try { obj = JSON.parse(raw); } catch (e) { dead.push(k); continue; }
        if (!obj || obj.value === '' || obj.value === null || obj.value === undefined) dead.push(k);
      }
      for (var n = 0; n < dead.length; n++) { try { localStorage.removeItem(dead[n]); } catch (e) {} }
    } catch (e) {}
  })();

  // ---------------------------------------------------------- 搜索

  var searchIt = {};

  /** 单平台搜索 */
  searchIt.one = function (platform, keywords, opts) {
    opts = opts || {};
    var limit = opts.limit || 30;
    var offset = opts.offset || 0;
    var key = cacheKey(['search', platform, keywords, limit, offset]);

    return cached(key, 300, function () {
      if (platform === 'netease') {
        return gateway('/api/search', { keywords: keywords, limit: limit, offset: offset }).then(function (d) {
          return (d.songs || []).map(fromGateway);
        });
      }
      if (platform === 'itunes') {
        return getJSON(ITUNES + '?term=' + encodeURIComponent(keywords) + '&entity=song&limit=' + limit).then(function (j) {
          return (j.results || []).map(fromItunes);
        });
      }
      return meting({ server: platform, type: 'search', id: keywords, limit: limit }).then(function (r) {
        var arr = null;
        try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
        if (!Array.isArray(arr)) arr = arr && arr.data ? arr.data : [];
        return arr.map(function (s) { return fromMeting(s, platform); });
      });
    });
  };

  /** 多平台并行搜索 + 去重 */
  searchIt.multi = function (keywords, opts) {
    opts = opts || {};
    var limit = opts.limit || 20;
    var platforms = opts.platforms && opts.platforms.length
      ? opts.platforms
      : PLATFORMS.map(function (p) { return p[0]; }).filter(function (p) { return p !== 'all'; });

    return Promise.all(
      platforms.map(function (p) {
        return searchIt.one(p, keywords, { limit: p === 'netease' ? limit : Math.min(limit, 20) })
          .then(function (songs) { return { platform: p, songs: songs || [], ok: true }; })
          .catch(function () { return { platform: p, songs: [], ok: false }; });
      })
    ).then(function (groups) {
      var seen = Object.create(null);
      var merged = [];
      var stats = [];
      groups.forEach(function (g) {
        stats.push({ platform: g.platform, count: g.songs.length, ok: g.ok });
        g.songs.forEach(function (s) {
          var fp = s.platform + ':' + fingerprint(s.name, s.artist);
          if (seen[fp]) return;
          seen[fp] = true;
          merged.push(s);
        });
      });
      return { songs: merged, stats: stats };
    });
  };

  function search(keywords, opts) {
    opts = opts || {};
    var platform = opts.platform || 'netease';
    if (platform === 'all') return searchIt.multi(keywords, opts).then(function (r) { return r.songs; });
    return searchIt.one(platform, keywords, opts);
  }

  // ---------------------------------------------------------- 播放地址

  /** 取可播放地址；网易云优先走自建网关（内部多镜像聚合） */
  function songUrl(song, opts) {
    opts = opts || {};
    if (!song) return Promise.reject(new Error('缺少歌曲'));
    if (song.url && !opts.force) return Promise.resolve(song.url);
    if (song.isLocal) return Promise.resolve(song.url || '');

    var level = opts.level || 'exhigh';
    var platform = song.platform || 'netease';

    if (platform === 'netease' && song.id) {
      var gkey = cacheKey(['url', platform, song.id, level]);
      return cached(gkey, 600, function () {
        return gateway('/api/url', { id: song.id, server: 'netease' }).then(function (d) {
          return d.url || '';
        });
      }).catch(function () { return ''; });
    }

    if (platform === 'itunes') return Promise.resolve(song.url || '');

    var key = cacheKey(['url', platform, song.id || song.name, song.artist]);
    return cached(key, 600, function () {
      var params = { server: platform, type: 'url' };
      if (song.id) params.id = song.id;
      else { params.name = song.name; params.artist = song.artist; }
      return meting(params).then(function (r) {
        var t = (r.text || '').trim();
        if (/^https?:\/\//.test(t)) return t;
        try {
          var j = JSON.parse(t);
          var first = Array.isArray(j) ? j[0] : (j && j.data ? j.data[0] : j);
          if (first && first.url) return first.url;
        } catch (e) { /* 落空 */ }
        return '';
      });
    });
  }

  // ---------------------------------------------------------- 歌词

  /** Meting / 网关代理的响应可能是一层 {ok, data:{raw}} 信封，这里统一拆出来 */
  function unwrapLrcText(text) {
    var t = (text || '').trim();
    if (!t || t.charAt(0) !== '{') return t;
    try {
      var j = JSON.parse(t);
      if (j && j.data) {
        if (typeof j.data === 'string') return j.data;
        if (j.data.raw) return String(j.data.raw);
        if (j.data.lyric) return String(j.data.lyric);
      }
      if (j && j.lyric) return String(j.lyric);
    } catch (e) {}
    return t;
  }

  /**
   * 取歌词（带时间轴的 LRC 文本）。
   * 注意：Meting 的 type=lrc 用 name/artist 查会返回一个 HTML 页面，必须用 id；
   * 官方/本地曲目没有 id，所以先搜一个 id 出来再取。
   */
  function lyric(song) {
    if (!song) return Promise.resolve('');
    if (song.lrc) return Promise.resolve(song.lrc);
    var platform = song.platform || 'netease';
    var key = cacheKey(['lyric2', platform, song.id || song.name, song.artist]);
    return cached(key, 86400, function () {
      var idP = song.id
        ? Promise.resolve(String(song.id))
        : (song.name
            ? searchIt.one(platform, (song.name + ' ' + (song.artist || '')).trim(), { limit: 1 })
                .then(function (arr) { return (arr && arr[0] && arr[0].id) || ''; })
                .catch(function () { return ''; })
            : Promise.resolve(''));

      return idP.then(function (id) {
        var tries = [];
        if (id && platform === 'netease') {
          tries.push(function () {
            return gateway('/api/lyric', { id: id }).then(function (d) {
              return d && d.lyric ? d.lyric : null;
            }).catch(function () { return null; });
          });
        }
        if (id) {
          tries.push(function () {
            return meting({ server: platform, type: 'lrc', id: id }).then(function (r) {
              var t = unwrapLrcText(r.text);
              return t || null;
            }).catch(function () { return null; });
          });
        }
        /* 依次尝试，取第一个拿到内容的 */
        return tries.reduce(function (p, fn) {
          return p.then(function (got) { return got || fn(); });
        }, Promise.resolve(null)).then(function (got) { return got || ''; });
      });
    }).catch(function () { return ''; });
  }

  // ---------------------------------------------------------- 其余接口

  var rest = {
    songDetail: function (ids) {
      var arr = Array.isArray(ids) ? ids : String(ids).split(',');
      return cached(cacheKey(['detail', arr.join(',')]), 3600, function () {
        return gateway('/api/song/detail', { ids: arr.join(',') }).then(function (list) {
          return (list || []).map(fromGateway);
        });
      });
    },
    playlist: function (id) {
      return cached(cacheKey(['playlist', id]), 1800, function () {
        return gateway('/api/playlist', { id: id });
      });
    },
    playlistTracks: function (id, opts) {
      opts = opts || {};
      return cached(cacheKey(['playlistTracks', id, opts.limit || 1000, opts.offset || 0]), 1800, function () {
        return gateway('/api/playlist/tracks', { id: id, limit: opts.limit || 1000, offset: opts.offset || 0 });
      });
    },
    toplist: function () {
      return cached(cacheKey(['toplist']), 1800, function () { return gateway('/api/toplist'); });
    },
    recommendPlaylist: function (limit) {
      return cached(cacheKey(['recPlaylist', limit || 12]), 1800, function () {
        return gateway('/api/recommend/playlist', { limit: limit || 12 });
      });
    },
    recommendNewSong: function (limit) {
      return cached(cacheKey(['recNewSong', limit || 12]), 1800, function () {
        return gateway('/api/recommend/newsong', { limit: limit || 12 }).then(function (list) {
          return (list || []).map(fromGateway);
        });
      });
    },
    catalogue: function () {
      return cached(cacheKey(['catalogue']), 86400, function () { return gateway('/api/catalogue'); });
    },
    artist: function (id) {
      return cached(cacheKey(['artist', id]), 86400, function () { return gateway('/api/artist', { id: id }); });
    },
    artistSongs: function (id, limit) {
      return cached(cacheKey(['artistSongs', id, limit || 50]), 86400, function () {
        return gateway('/api/artist/songs', { id: id, limit: limit || 50 }).then(function (list) {
          return (list || []).map(fromGateway);
        });
      });
    },
    health: function () {
      return getJSON(GATEWAY + '/api/health');
    }
  };

  // ---------------------------------------------------------- 下载

  function probeExt(buf) {
    var b = new Uint8Array(buf.slice(0, 12));
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
    if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'mp3';
    if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return 'flac';
    if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'ogg';
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'wav';
    if (b[0] === 0x4d && b[1] === 0x34 && b[2] === 0x41) return 'm4a';
    return '';
  }

  function download(song) {
    if (!song) return Promise.reject(new Error('缺少歌曲'));
    return songUrl(song, { force: true }).then(function (url) {
      if (!url) throw new Error('拿不到播放地址，可能受版权/VIP限制');
      return withTimeout(url, { redirect: 'follow' }).then(function (r) { return r.arrayBuffer(); });
    }).then(function (buf) {
      var ext = probeExt(buf);
      if (!ext || buf.byteLength < 4096) throw new Error('该曲受版权/VIP限制，下载不了');
      return { buffer: buf, ext: ext, filename: (song.name + ' - ' + song.artist + '.' + ext).replace(/[\\/:*?"<>|]/g, '_') };
    });
  }

  function saveBlob(buffer, filename, ext) {
    var blob = new Blob([buffer], { type: 'audio/' + ext });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // ---------------------------------------------------------- 导出

  global.MusicAPI = {
    GATEWAY: GATEWAY,
    PLATFORMS: PLATFORMS,
    LEVELS: LEVELS,
    makeSong: makeSong,
    fromGateway: fromGateway,
    fromMeting: fromMeting,
    fromItunes: fromItunes,

    search: search,
    searchOne: searchIt.one,
    searchMulti: searchIt.multi,
    songUrl: songUrl,
    lyric: lyric,
    songDetail: rest.songDetail,
    playlist: rest.playlist,
    playlistTracks: rest.playlistTracks,
    toplist: rest.toplist,
    recommendPlaylist: rest.recommendPlaylist,
    recommendNewSong: rest.recommendNewSong,
    catalogue: rest.catalogue,
    artist: rest.artist,
    artistSongs: rest.artistSongs,
    health: rest.health,

    download: download,
    saveBlob: saveBlob,
    probeExt: probeExt,

    formatTime: formatTime,
    escapeHtml: escapeHtml,
    fingerprint: fingerprint,
    clearCache: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0; })
          .forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }
    }
  };
})(typeof window !== 'undefined' ? window : this);
