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

  /* 第三方公共桥（MusicSquare 同款），一律「桥优先 → Meting 回落」，不改原链路：
     - 酷我 oiapi.net：?msg=&page=&limit= 拿列表；?msg=&n=1&br=2 拿可播直链（br=1 的无损是 VIP 死链，实测 410）
     - s01s.cn：QQ 音乐的兜底搜索（?msg=&type=json） */
  var KUWO_API = 'https://oiapi.net/api/Kuwo';
  var S01S = 'https://tang.api.s01s.cn/music_open_api.php';

  var PLATFORMS = [
    ['all', '全部平台'],
    ['netease', '网易云'],
    ['tencent', 'QQ音乐'],
    ['kugou', '酷狗'],
    ['kuwo', '酷我'],
    ['migu', '咪咕'],
    ['bilibili', 'B站'],
    ['itunes', 'iTunes'],
    /* 这两个是**纯客户端直连**的新源：搜索响应里就带播放地址，
       而且都发 CORS 头（实测 access-control-allow-origin），
       不需要经过自建网关 —— 少一跳，也少一个会挂的依赖。 */
    ['audius', 'Audius'],
    ['ximalaya', '喜马拉雅']
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

  /* 网易云有些接口（新歌速递）返回的封面是 http:// 开头，
     浏览器同样会拦截混合内容 —— 表现就是「没封面」。统一升成 https。 */
  function fixUrl(u) {
    if (!u) return '';
    if (u.indexOf('http://') === 0) return 'https://' + u.slice(7);
    if (u.indexOf('//') === 0) return 'https:' + u;
    return u;
  }

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

  /* ============================================================
     网易云为什么放不出来：搜索结果里根本没有 url
     ------------------------------------------------------------
     网站在「网易云」这条路上一共有三个取链来源，全是死的：
       • 网关 /api/search  -> url 字段就是空串
       • 网关 /api/url     -> 期望镜像「返回一个地址字符串」，但 Meting 系
                              镜像的 type=url 是 **302 跳转**，网关解析不出来，
                              于是判定「所有镜像都拿不到播放地址」直接 502
       • GDStudio          -> 网易云也返回空
     唯一活着的路，是 **把 Meting 镜像的 type=url 当成播放地址本身**：
     它是一条会 302 跳到 m8xx.music.126.net 真实 CDN 的代理链，
     <audio> 和下载器都会自动跟随跳转，不需要我们去解析出最终直链。
     所以这里按 id 就地拼出来 —— makeSong 是所有来源的必经之路，
     搜索结果 / 排行榜 / 歌单曲目一次性全覆盖。
     ============================================================ */
  var PROXY_MIRROR = 'https://api.qijieya.cn/meting/';
  function proxyUrl(server, id) {
    if (!id) return '';
    return PROXY_MIRROR + '?server=' + encodeURIComponent(server) +
           '&type=url&id=' + encodeURIComponent(id);
  }

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
      cover: fixUrl(o.cover || o.pic || ''),
      duration: toSeconds(o.duration),
      url: o.url || '',
      lrc: o.lrc || o.lyric || '',
      fee: o.fee || 0,
      level: o.level || '',
      isTrial: !!o.isTrial,
      isLocal: !!o.isLocal
    };
    /* 只有网易云需要补：其余平台走 Meting 搜索，url 本来就有。
       没有 id 就补不了（个别老接口只回歌名），交给下面的 songUrlCandidates 兜底。 */
    if (!song.url && !song.isLocal && song.id && platform === 'netease') {
      song.url = proxyUrl('netease', song.id);
    }
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
      cover: fixUrl(s.cover),
      duration: s.duration, // 毫秒，toSeconds 会处理
      fee: s.fee,
      /* 网关偶尔也会给 url —— 以前这里**根本没往下传**，白丢一个候选。
         为空时 makeSong 会按 id 补代理链。 */
      url: s.url || '',
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
      cover: fixUrl(s.pic || s.cover),
      duration: s.duration || s.length,
      url: s.url,
      lrc: s.lrc || s.lyric
    });
  }

  /* ============================================================
     两个「零网关」新源
     ------------------------------------------------------------
     共同点：**搜索结果里直接带播放地址**，所以不用第二次请求；
     而且都带 CORS（实测 acao=*），浏览器可以直连。
     这两个源补的是我们原来完全没有的品类：
       • Audius    —— 独立音乐 / CC 授权，整曲可播，零鉴权
       • 喜马拉雅   —— 有声书 / 播客，整曲可播（免费节目）
     ============================================================ */
  var AUDIUS = 'https://api.audius.co/v1';
  var XIMA = 'https://www.ximalaya.com/revision/search';

  /** Audius 搜索（GET，无鉴权；app_name 随便填，只是标识来源） */
  function viaAudius(keywords, limit) {
    return getJSON(AUDIUS + '/tracks/search?query=' + encodeURIComponent(keywords) +
      '&app_name=SakuraMusic&limit=' + Math.min(limit || 20, 50)).then(function (j) {
      var arr = (j && j.data) || [];
      return arr.filter(function (t) {
        /* **只有 is_streamable 的曲目才拿得到流**（实测 false 的直接 404）。
           以前是「不过滤、拼个空地址」，结果列表里混进点了不响的歌。
           有 stream.url 的当然也算可播。 */
        return t.is_streamable === true || (t.stream && t.stream.url);
      }).map(function (t) {
        var art = t.artwork || {};
        return makeSong({
          platform: 'audius',
          id: t.id,
          name: t.title || '',
          artist: (t.user && t.user.name) || '',
          album: t.genre || '',
          cover: fixUrl(art['480x480'] || art['150x150'] || ''),
          duration: t.duration || 0,        // 秒，toSeconds 会原样保留
          /* stream.url 是**已经签好名的临时地址**（响应里还带 mirrors 做备份）。
             没有就按 id 现拼 —— 它会 302 到真实 CDN，播放器自己跟随。 */
          url: (t.stream && t.stream.url) ||
               (AUDIUS + '/tracks/' + t.id + '/stream?app_name=SakuraMusic')
        });
      }).filter(function (s) { return s.name && s.url; });
    });
  }

  /** 喜马拉雅搜索（GET，无鉴权）—— 有声书 / 播客 */
  function viaXimalaya(keywords, limit) {
    return getJSON(XIMA + '?core=track&kw=' + encodeURIComponent(keywords) +
      '&page=1&rows=' + Math.min(limit || 20, 30) +
      '&spellchecker=true&condition=relation&device=web').then(function (j) {
      var docs = (j && j.data && j.data.result && j.data.result.response &&
                  j.data.result.response.docs) || [];
      return docs.map(function (t) {
        return makeSong({
          platform: 'ximalaya',
          id: String(t.id == null ? '' : t.id),
          name: stripHtml(t.title || ''),
          artist: t.nickname || '',
          album: t.album_title || '',
          cover: fixUrl(t.album_cover_path || t.cover_path || ''),
          duration: t.duration || 0,        // 秒
          /* 搜索结果里**直接带播放地址**，省掉一次请求。
             ⚠️ 是 http://，必须 fixUrl 升 https —— 否则 https 页面下
             会被混合内容拦掉（实测 https 版 206 audio/mpeg，且带 CORS）。
             优先 64kbps，退化到 aac / 32kbps。 */
          url: fixUrl(t.play_path_64 || t.play_path_aacv164 || t.play_path_32 || '')
        });
      /* **没有地址的直接不列出来** —— 付费/受限的节目拿不到 play_path，
         放进去就是「点了不响」。宁可少给几条，也不要给点不动的。 */
      }).filter(function (s) { return s.url; });
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
      cover: fixUrl((s.artworkUrl100 || '').replace('100x100', '300x300')),
      duration: Math.round((s.trackTimeMillis || 0) / 1000),
      url: s.previewUrl || '',
      isTrial: true
    });
  }

  // ---------------------------------------------------------- 请求层

/** 酷我桥 -> Song */
  function fromKuwo(s) {
    return makeSong({
      platform: 'kuwo',
      id: s.rid || '',
      name: s.song || '',
      artist: s.singer || '',
      album: s.album || '',
      cover: fixUrl(s.picture || ''),
      url: s.url || '',
      lrc: s.lyric || s.lrc || ''
    });
  }

  /** 酷我桥列表搜索：?msg=&page=&limit= -> data[] */
  function viaKuwo(keywords, limit) {
    return getJSON(KUWO_API + '?msg=' + encodeURIComponent(keywords) + '&page=1&limit=' + limit).then(function (j) {
      var arr = (j && j.data) || [];
      if (!Array.isArray(arr) || !arr.length) throw new Error('kuwo bridge empty');
      return arr.map(fromKuwo);
    });
  }

  /** s01s 开放接口：QQ 音乐兜底搜索 -> [{song_title,singer_name,song_mid}] */
  function viaS01s(keywords, limit) {
    return getJSON(S01S + '?msg=' + encodeURIComponent(keywords) + '&type=json').then(function (j) {
      var arr = Array.isArray(j) ? j : ((j && j.data) || []);
      if (!Array.isArray(arr) || !arr.length) return [];
      return arr.slice(0, limit).map(function (it) {
        return makeSong({
          platform: 'tencent',
          id: it.song_mid || '',
          name: it.song_title || '',
          artist: it.singer_name || '',
          album: '', cover: '', url: '', lrc: ''
        });
      });
    }).catch(function () { return []; });
  }

  /** Meting 通用搜索（原逻辑原样抽出，行为不变） */
  function viaMeting(platform, keywords, limit) {
    return meting({ server: platform, type: 'search', id: keywords, limit: limit }).then(function (r) {
      var arr = null;
      try { arr = JSON.parse(r.text); } catch (e) { arr = null; }
      if (!Array.isArray(arr)) arr = arr && arr.data ? arr.data : [];
      return arr.map(function (s) { return fromMeting(s, platform); });
    });
  }

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
      var d = j.data;
      /* 有些接口把数组包在 {ok,total,songs} 里（/api/playlist/tracks 就是），
         而 /api/recommend/* 直接给数组。这里统一拆开 ——
         否则调用方对对象调 .map 会抛 TypeError，
         表现就是「排行榜/歌单点进去啥都没有」。 */
      if (d && !Array.isArray(d) && Array.isArray(d.songs)) return d.songs;
      return d;
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
          /* ⚠️ gateway() 内部**已经**把 {ok,total,songs} 拆成 songs 数组返回了，
             以前这里又取了一次 .songs —— 双重解包，对数组取 .songs 得到 undefined，
             于是网易云搜索**永远返回 0 条**，搜索页看着像「没搜到」。
             这里两种形状都认，网关以后改解包规则也不会再崩。 */
          var arr = Array.isArray(d) ? d : ((d && d.songs) || []);
          return arr.map(fromGateway);
        });
      }
      if (platform === 'itunes') {
        return getJSON(ITUNES + '?term=' + encodeURIComponent(keywords) + '&entity=song&limit=' + limit).then(function (j) {
          return (j.results || []).map(fromItunes);
        });
      }
      /* 这两个源不经过网关，直接打官方接口（它们发 CORS 头） */
      if (platform === 'audius') return viaAudius(keywords, limit);
      if (platform === 'ximalaya') return viaXimalaya(keywords, limit);
if (platform === 'kuwo') {
        /* 先 Meting：它的 id 能和歌词/直链接上；空结果再落桥。
           桥只负责在取直链时给无损地址（songUrl 里优先走桥），两条路互不冲突。 */
        return viaMeting('kuwo', keywords, limit).then(function (songs) {
          if (songs && songs.length) return songs;
          return viaKuwo(keywords, limit);
        }).catch(function () { return viaKuwo(keywords, limit); });
      }
      if (platform === 'tencent') {
        return viaMeting('tencent', keywords, limit).then(function (songs) {
          if (songs && songs.length) return songs;
          return viaS01s(keywords, limit);
        });
      }
      return viaMeting(platform, keywords, limit);
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

  /* GD Studio（music-api.gdstudio.xyz）：返回真实 CDN 直链、带 CORS、支持 Range，
     实测网易云可取到 200/206 可播地址。作第一顺位，失败再退下面的流式镜像与网关。
     它是「返回地址」型；下面的 STREAM_MIRRORS 是「直接吐音频」型，两者不能混。 */
  var GD_API = 'https://music-api.gdstudio.xyz/api.php';

  /* 流式镜像：这些镜像的 type=url 不返回 JSON 地址，而是 **302 跳转**到真实 CDN，
     所以要把「镜像地址本身」当成播放地址交给 <audio>（不要 fetch，顺带绕开 CORS）。
     实测 qijieya / injahow 都会 302 到 m8xx.music.126.net 并给出 audio/mpeg。
     （2026-09 复测：musicapi.qijieya.cn 已 521，meting.qjqq.cn 522，
        music.xianqiao.wang 只会返回一页 HTML —— 都不要再放进来了。） */
  var STREAM_MIRRORS = [
    'https://api.qijieya.cn/meting/',
    'https://api.injahow.cn/meting/',
    /* 2026-09-23 自己复测出来的可用镜像（302 到真实 CDN） */
    'https://api.msls1441.com/'
  ];

  function gdUrl(server, id) {
    if (!id) return Promise.resolve('');
    return getJSON(GD_API + '?types=url&source=' + encodeURIComponent(server) + '&id=' + encodeURIComponent(id) + '&br=320')
      .then(function (j) {
        var u = Array.isArray(j) ? (j[0] && j[0].url) : (j && j.url);
        return (u && /^https?:\/\//.test(u)) ? u : '';
      })
      .catch(function () { return ''; });
  }

  function streamUrls(platform, song) {
    var q = 'server=' + encodeURIComponent(platform) + '&type=url&br=320';
    if (song.id) q += '&id=' + encodeURIComponent(song.id);
    if (song.name) q += '&name=' + encodeURIComponent(song.name) + '&artist=' + encodeURIComponent(song.artist || '');
    return STREAM_MIRRORS.map(function (m) { return m + '?' + q; });
  }

  /**
   * 候选播放地址（按优先级排序的数组）。
   * 播放器应当逐个尝试：网易云很多曲目在某个镜像拿不到（VIP），
   * 换下一个候选常常就出了 —— 旧版只试一个就报「版权限制」。
   */
  function songUrlCandidates(song, opts) {
    opts = opts || {};
    var out = [];
    if (!song) return Promise.resolve(out);
    var platform = song.platform || 'netease';
    var level = opts.level || 'exhigh';
    if (song.url && /^https?:\/\//.test(song.url)) out.push(song.url);
    if (song.isLocal) return Promise.resolve(out);

    var jobs = [];
    if (platform === 'netease' && song.id) {
      jobs.push(gdUrl('netease', song.id));
      jobs.push(cached(cacheKey(['url', platform, song.id, level]), 600, function () {
        return gateway('/api/url', { id: song.id, server: 'netease' })
          .then(function (d) { return (d && d.url) || ''; })
          .catch(function () { return ''; });
      }));
    } else if (platform === 'kuwo') {
      jobs.push(cached(cacheKey(['url', 'kuwo-bridge', song.name, song.artist]), 600, function () {
        var msg = ((song.name || '') + ' ' + (song.artist || '')).trim();
        return getJSON(KUWO_API + '?msg=' + encodeURIComponent(msg) + '&n=1&br=2').then(function (j) {  // br=1 无损是 VIP 死链，br=2 实测可播
          var d = (j && j.data) || null;
          return (d && d.url) || '';
        }).catch(function () { return ''; });
      }));
    } else if (platform !== 'itunes') {
      jobs.push(cached(cacheKey(['url', platform, song.id || song.name, song.artist]), 600, function () {
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
        }).catch(function () { return ''; });
      }));
    }

    return Promise.all(jobs.map(function (p) { return p.catch(function () { return ''; }); })).then(function (urls) {
      urls.forEach(function (u) { if (u && out.indexOf(u) < 0) out.push(u); });
      /* 流式镜像地址放在真实直链之后：它们不需要 fetch，浏览器直接连 */
      if (platform !== 'itunes') streamUrls(platform, song).forEach(function (u) { if (out.indexOf(u) < 0) out.push(u); });
      return out;
    });
  }

  /** 取可播放地址（第一个候选）；多候选请用 songUrlCandidates */
  function songUrl(song, opts) {
    return songUrlCandidates(song, opts).then(function (list) { return list[0] || ''; });
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
    if (song.lrc) return Promise.resolve({ lrc: song.lrc, trans: '', roma: '' });
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
              if (!d || !d.lyric) return null;
              /* 网关其实同时给了翻译和罗马音，以前只取 lyric 把它们丢掉了。
                 一起带回去，交给 LyricHelper 按时间戳合并成副行。 */
              return { lrc: d.lyric, trans: d.translated || '', roma: d.roma || '' };
            }).catch(function () { return null; });
          });
        }
        if (id) {
          tries.push(function () {
            return meting({ server: platform, type: 'lrc', id: id }).then(function (r) {
              var t = unwrapLrcText(r.text);
              return t ? { lrc: t, trans: '', roma: '' } : null;
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

  /* 下载用的 MIME。原来一律拼 'audio/' + ext，会拼出 audio/mp3、audio/m4a
     这种根本没注册过的类型。浏览器一旦忽略 <a download>（在 iframe、沙箱、
     APP 壳里就会出现这种情况），它会当场导航去内联渲染这个 blob；渲染不出来
     就是一个「页面打不开」的错误页，看起来跟跳到 404 一模一样。
     这里给规范类型；认不出来的一律 application/octet-stream —— 这样最坏
     也只是老老实实下载，绝不会把页面跳走。 */
  var AUDIO_MIME = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', m4b: 'audio/mp4',
    aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg', oga: 'audio/ogg',
    opus: 'audio/ogg', wav: 'audio/wav', wma: 'audio/x-ms-wma', ape: 'audio/x-ape'
  };
  function mimeOf(ext) {
    return AUDIO_MIME[String(ext || '').toLowerCase()] || 'application/octet-stream';
  }

  function saveBlob(buffer, filename, ext) {
    var blob = new Blob([buffer], { type: mimeOf(ext) });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  /* ---------------------------------------------------------- 智能下载
     把一个「候选地址表」逐个试过去，谁先拿到真音频就用谁。

     为什么需要：songUrlCandidates() 从一开始就是按「候选表」设计的
     （注释里写得很清楚：网易云很多曲目在某个镜像拿不到，换下一个常常就出了），
     但两条下载路径都只 fetch 了 list[0]。而 list[0] 经常是：
       · 歌单里存了几天的过期签名直链（网易云 CDN 地址里带签发时间戳 /20260917191725/）
       · 某个平台刚好拿不到的死链
     于是「下载某些音乐会失败」。真正的候选表就摆在手边，没用上。
     这里把最后那几个「流式镜像」也吃进来（它们 302 到新鲜直链，服务端能跟）。 */

  function dlSay(m) {
    try { if (typeof global.showMsg === 'function') global.showMsg(m); } catch (e) {}
  }

  function tryEachUrl(urls, i, name, artist) {
    if (i >= urls.length) { dlSay('这首下载不了喵～换一首或稍后再试'); return Promise.resolve(false); }
    return withTimeout(urls[i], { redirect: 'follow' }).then(function (r) {
      return r.arrayBuffer();
    }).then(function (buf) {
      var ext = probeExt(buf);
      if (!ext || buf.byteLength < 4096) throw new Error('不是有效音频');
      var base = artist ? (name + ' - ' + artist) : name;
      saveBlob(buf, (base + '.' + ext).replace(/[\\/:*?"<>|]/g, '_'), ext);
      dlSay('下载完成喵～');
      return true;
    }).catch(function () {
      /* 这一条不行就试下一条，不要在第一条上认输 */
      return tryEachUrl(urls, i + 1, name, artist);
    });
  }

  /**
   * @param {{song?:Object, fallback?:string, name?:string, artist?:string}} opts
   *   song     —— 有 id / platform / name 时用它重新取一份最新的候选表
   *   fallback —— 调用方手上那条（通常是歌单里存的旧地址），排在候选表最后兜底
   */
  function downloadSmart(opts) {
    opts = opts || {};
    var name = opts.name || '音乐';
    var artist = opts.artist || '';
    var resolve = (opts.song && (opts.song.id || opts.song.name))
      ? songUrlCandidates(opts.song).catch(function () { return []; })
      : Promise.resolve([]);
    return resolve.then(function (list) {
      var urls = [];
      (list || []).forEach(function (u) { if (u && urls.indexOf(u) < 0) urls.push(u); });
      var fb = opts.fallback;
      if (fb && /^https?:\/\//.test(fb) && urls.indexOf(fb) < 0) urls.push(fb);
      if (!urls.length) { dlSay('拿不到下载地址喵～'); return false; }
      dlSay('开始下载喵…');
      return tryEachUrl(urls, 0, name, artist);
    });
  }

  // ---------------------------------------------------------- 导出

  global.MusicAPI = {
    GATEWAY: GATEWAY,
    songUrlAll: songUrlCandidates,
    STREAM_MIRRORS: STREAM_MIRRORS,
    PLATFORMS: PLATFORMS,
    LEVELS: LEVELS,
    makeSong: makeSong,
    fromGateway: fromGateway,
    fromMeting: fromMeting,
    fromItunes: fromItunes,

    search: search,
    searchOne: searchIt.one,
    searchMulti: searchIt.multi,
    viaAudius: viaAudius,
    viaXimalaya: viaXimalaya,
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
    downloadSmart: downloadSmart,
    saveBlob: saveBlob,
    probeExt: probeExt,
    mimeOf: mimeOf,

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
