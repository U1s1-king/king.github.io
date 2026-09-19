/**
 * sakura-music-api
 * 樱花音乐 API —— 网易云音乐元数据网关（Cloudflare Pages Functions / Advanced Mode）
 *
 * 设计要点：
 *  - 只做「元数据」：搜索 / 歌曲详情 / 歌词 / 歌单 / 排行榜 / 推荐 / 歌手
 *  - 不碰「播放地址」：可播放 URL 交给 Meting 镜像（见 /api/url），本 Worker 只做多镜像聚合与代理
 *  - 加密：WEAPI（AES-128-CBC + 裸 RSA 模幂），全部用 WebCrypto + BigInt 实现，
 *          因此【不需要 nodejs_compat】，也没有任何 Node 内置模块依赖
 *  - 无登录、无 Cookie、不保存任何用户数据（你明确要求不做登录 / 扫码）
 */

// ============================================================ 常量

const IV = '0102030405060708'
const PRESET_KEY = '0CoJUm6Qyw8W8jud'
const BASE62 = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const MOD_HEX =
  'e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
const MODULUS = BigInt('0x' + MOD_HEX)
const PUB_EXP = 65537n

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// 可播放 URL 的镜像池（按优先级）。qijieya 的两个是站点原有镜像，后面几个是补充。
const METING_MIRRORS = [
  'https://api.qijieya.cn/meting/',
  'https://music.xianqiao.wang/netease/',
  'https://api.injahow.cn/meting/',
  'https://meting.qjqq.cn/',
]

const SITE_ORIGINS = [
  'https://zhaokening.ccwu.cc',
  'https://www.zhaokening.ccwu.cc',
  // GitHub Pages 的用户站地址是 <user>.github.io，原来的 king.github.io 不是本站域名
  'https://u1s1-king.github.io',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
  // 本站本地预览常用端口（js/tv.js 的开发联调也用它）
  'http://localhost:8899',
  'http://127.0.0.1:8899',
]

const CACHE_TTL = {
  search: 300,
  detail: 3600,
  lyric: 86400,
  playlist: 1800,
  toplist: 1800,
  recommend: 1800,
  artist: 86400,
  url: 600,
}

// ============================================================ 加解密

const encoder = new TextEncoder()

function modPow(base, exp, mod) {
  let result = 1n
  base %= mod
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    exp >>= 1n
    base = (base * base) % mod
  }
  return result
}

function bytesToBigInt(bytes) {
  let n = 0n
  for (let i = 0; i < bytes.length; i++) n = (n << 8n) | BigInt(bytes[i])
  return n
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function bytesToHex(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/** 网易 weapi 的 RSA：对「反转后的 16 位密钥」做裸模幂，然后左侧补零到 256 位十六进制 */
function rsaEncryptSecretKey(reversedKey) {
  const m = bytesToBigInt(encoder.encode(reversedKey))
  return modPow(m, PUB_EXP, MODULUS).toString(16).padStart(256, '0')
}

async function aesCbcBase64(text, key) {
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'AES-CBC' }, false, ['encrypt'])
  const buf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: encoder.encode(IV) }, cryptoKey, encoder.encode(text))
  return bytesToBase64(new Uint8Array(buf))
}

let cachedSecretKey = ''
function secretKey() {
  if (!cachedSecretKey) {
    const rnd = crypto.getRandomValues(new Uint8Array(16))
    let key = ''
    for (let i = 0; i < 16; i++) key += BASE62[rnd[i] % 62]
    cachedSecretKey = key
  }
  return cachedSecretKey
}

/** 把对象加密成 weapi 的 params + encSecKey */
async function weapiBody(payload) {
  const text = JSON.stringify(payload)
  const sk = secretKey()
  const params = await aesCbcBase64(await aesCbcBase64(text, PRESET_KEY), sk)
  const encSecKey = rsaEncryptSecretKey(sk.split('').reverse().join(''))
  return 'params=' + encodeURIComponent(params) + '&encSecKey=' + encSecKey
}

// ============================================================ 请求网易云

let deviceCookie = ''
function neteaseCookie() {
  if (!deviceCookie) {
    const hex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
    deviceCookie =
      'os=pc; appver=3.1.17.204416; channel=netease; _ntes_nuid=' + hex + '; NMTID=' + hex.slice(0, 16)
  }
  return deviceCookie
}

function neteaseHeaders(extra) {
  const h = {
    'User-Agent': UA,
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
    Cookie: neteaseCookie(),
  }
  if (extra) for (const k in extra) h[k] = extra[k]
  return h
}

/** POST /weapi/<path> */
async function weapiPost(path, payload, extraHeaders) {
  const body = await weapiBody(payload)
  const res = await fetch('https://music.163.com/weapi' + path + '?csrf_token=', {
    method: 'POST',
    headers: neteaseHeaders(Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, extraHeaders || {})),
    body,
  })
  return res
}

/** GET /api/<path>（少量老接口不需要加密） */
async function plainGet(path, params) {
  const qs = new URLSearchParams(params || {}).toString()
  const res = await fetch('https://music.163.com/api' + path + (qs ? '?' + qs : ''), {
    headers: neteaseHeaders(),
  })
  return res
}

async function readJson(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch (e) {
    return { code: -1, message: '上游返回非 JSON', raw: text.slice(0, 400) }
  }
}

/**
 * 上游结果校验。
 * 网易云会对可疑请求返回 code 50000005 之类的风控响应（没有 result），
 * 早期版本会把这种「假空结果」写进缓存，导致某首歌搜不到且 5 分钟内一直搜不到。
 * 这里直接抛错 -> withCache 不写缓存 -> 客户端收到明确错误而不是假的空列表。
 */
function assertUpstream(body, label) {
  if (!body) throw new Error('上游无响应：' + label)
  if (body.code !== undefined && body.code !== 200) {
    throw new Error('上游风控/异常（code ' + body.code + '）：' + label)
  }
  return body
}

/** 失败重试（风控是概率性的，重试一次往往就过了） */
async function withRetry(fn, times) {
  let lastErr = null
  for (let i = 0; i < (times || 2); i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

// ============================================================ 缓存

const memCache = new Map()

function cacheGet(key) {
  const hit = memCache.get(key)
  if (!hit) return null
  if (hit.expire < Date.now()) {
    memCache.delete(key)
    return null
  }
  return hit.value
}

function cacheSet(key, value, ttlSeconds) {
  if (memCache.size > 500) memCache.clear()
  memCache.set(key, { value, expire: Date.now() + ttlSeconds * 1000 })
  return value
}

async function withCache(key, ttlSeconds, producer) {
  const hit = cacheGet(key)
  if (hit) return hit
  const value = await producer()
  if (value && value.ok !== false) cacheSet(key, value, ttlSeconds)
  return value
}

// ============================================================ 归一化

function pickCover(url, size) {
  if (!url) return ''
  return String(url).split('?')[0] + (size ? '?param=' + size + 'y' + size : '')
}

/** 网易云 song -> 统一歌曲模型 */
function normSong(s) {
  if (!s) return null
  const artists = s.ar || s.artists || []
  const album = s.al || s.album || {}
  return {
    platform: 'netease',
    id: String(s.id),
    name: s.name || '',
    artist: artists.map(function (a) { return a.name }).filter(Boolean).join(' / '),
    artistIds: artists.map(function (a) { return a.id }).filter(Boolean),
    album: album.name || '',
    albumId: album.id ? String(album.id) : '',
    cover: pickCover(album.picUrl || s.picUrl, 300),
    duration: s.dt || s.duration || 0,
    fee: s.fee == null ? 0 : s.fee,
    mv: s.mv || 0,
    url: '',
    lyric: '',
  }
}

/** 网易云 playlist -> 统一歌单模型 */
function normPlaylist(p) {
  if (!p) return null
  return {
    platform: 'netease',
    id: String(p.id),
    name: p.name || '',
    cover: pickCover(p.coverImgUrl || p.picUrl, 400),
    description: p.description || '',
    trackCount: p.trackCount || 0,
    playCount: p.playCount || 0,
    creator: (p.creator && (p.creator.nickname || p.creator.name)) || '网易云音乐',
    creatorId: p.creator ? String(p.creator.userId || '') : '',
    tags: p.tags || [],
    updateTime: p.updateTime || 0,
    tracks: Array.isArray(p.tracks) ? p.tracks.map(normSong).filter(Boolean) : [],
    trackIds: Array.isArray(p.trackIds) ? p.trackIds.map(function (t) { return String(t.id) }) : [],
  }
}

// ============================================================ 响应

function corsHeaders(origin) {
  /* 只对白名单内的来源回显 Access-Control-Allow-Origin；名单外的来源不带该响应头，
     浏览器会自行拦截跨域读取。
     原先写的是
       const allow = !origin || SITE_ORIGINS.indexOf(origin) >= 0 ? (origin || '*') : '*'
     两个分支最终都落到 '*'，等于任何第三方站点都能白嫖这个网关，和 README 里
     「CORS Allowlist」的说法不符。 */
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && SITE_ORIGINS.indexOf(origin) >= 0) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function jsonResponse(data, status, origin, extraHeaders) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
    corsHeaders(origin),
    extraHeaders || {},
  )
  return new Response(JSON.stringify(data), { status: status || 200, headers })
}

function fail(message, status, origin) {
  return jsonResponse({ ok: false, error: message }, status || 502, origin)
}

function ok(data, origin, headers) {
  return jsonResponse({ ok: true, source: 'netease', data }, 200, origin, headers)
}

/* 网易云对机房 IP 的风控很凶（code -462）。带上一个国内 IP 提示能明显降低触发率。 */
const SEARCH_REAL_IP = '116.25.146.177'

/**
 * Meting 镜像搜索兜底。
 * 网易云的搜索接口在 Cloudflare 这类机房 IP 上经常整段返回 -462，
 * 以前这里直接把错误抛给前端，结果是：搜索页报「网络或接口问题」，
 * 而且官方推荐 / 本地曲目拿不到 id，歌词永远取不到。
 * Meting 返回的对象里没有 id 字段，但 url / lrc 带着 `...&id=XXXX`，从这里抠出来。
 */
async function metingSearchSongs(keywords, limit, offset) {
  try {
    const r = await resolveMeting({ server: 'netease', type: 'search', id: keywords, limit })
    if (!r || !r.ok) return []
    let list = null
    try { list = JSON.parse(r.data) } catch (e) { list = null }
    if (!Array.isArray(list)) list = list && list.data ? list.data : []
    const idOf = function (u) {
      const m = /[?&]id=([0-9A-Za-z_-]+)/.exec(String(u || ''))
      return m ? m[1] : ''
    }
    return list.map(function (x) {
      if (!x) return null
      const id = String(x.id || x.songid || x.song_id || idOf(x.url) || idOf(x.lrc) || '')
      if (!id) return null
      return {
        platform: 'netease',
        id: id,
        name: x.name || x.title || '',
        artist: x.artist || x.author || '',
        artistIds: [],
        album: x.album || '',
        albumId: '',
        cover: x.pic || x.cover || '',
        duration: Number(x.duration || x.length || 0),
        fee: 0,
        mv: 0,
        url: '',
        lyric: '',
      }
    }).filter(Boolean)
  } catch (e) {
    return []
  }
}
// ============================================================ 各接口

const api = {
  /** 搜索 */
  async search(q, origin) {
    const keywords = (q.get('keywords') || q.get('s') || '').trim()
    const limit = Math.min(parseInt(q.get('limit') || '30', 10) || 30, 100)
    const offset = Math.max(parseInt(q.get('offset') || '0', 10) || 0, 0)
    /* 网易云在机房 IP 上会整段返回 -462（风控）。这里兜一层 Meting 镜像，
       否则搜索页直接报错，而且官方推荐 / 本地曲目拿不到 id，歌词永远拉不到。 */
    try {
      const res = await api.searchNetease(q, origin)
      if (res && res.status < 400) return res
    } catch (e) { /* 落到下面的兜底 */ }
    const fb = await metingSearchSongs(keywords, limit, offset)
    if (fb.length) {
      return ok({ keywords, count: fb.length, songs: fb, albums: [], artists: [], playlists: [], fallback: 'meting' }, origin)
    }
    return fail('搜索失败：网易云风控且镜像也不可用', 502, origin)
  },

  /** 原来的网易云搜索（由上面的 search 包装调用） */
  async searchNetease(q, origin) {
    const keywords = (q.get('keywords') || q.get('s') || '').trim()
    if (!keywords) return fail('缺少 keywords', 400, origin)
    const limit = Math.min(parseInt(q.get('limit') || '30', 10) || 30, 100)
    const offset = Math.max(parseInt(q.get('offset') || '0', 10) || 0, 0)
    const type = parseInt(q.get('type') || '1', 10) || 1
    const key = 'search:' + type + ':' + limit + ':' + offset + ':' + keywords
    const body = await withCache(key, CACHE_TTL.search, async function () {
      /* 风控是概率性的，重试 3 次基本都能过；仍失败则抛错，绝不把假空结果写进缓存 */
      return await withRetry(async function () {
        const res = await weapiPost('/search/get', { s: keywords, type, limit, offset, csrf_token: '', realIP: SEARCH_REAL_IP }, { 'X-Real-IP': SEARCH_REAL_IP })
        return assertUpstream(await readJson(res), '搜索')
      }, 3)
    })
    const result = (body && body.result) || {}
    let songs = (result.songs || []).map(normSong).filter(Boolean)
    // 老版搜索接口不返回封面/专辑，补一次 v3/song/detail 把它们填上
    if (songs.length && songs.some(function (s) { return !s.cover })) {
      const ids = songs.map(function (s) { return Number(s.id) })
      const detail = await withCache('searchDetail:' + ids.join(','), CACHE_TTL.detail, async function () {
        const r = await weapiPost('/v3/song/detail', {
          c: JSON.stringify(ids.map(function (id) { return { id } })),
          ids: JSON.stringify(ids),
          csrf_token: '',
        })
        return readJson(r)
      })
      const map = {}
      ;((detail && detail.songs) || []).forEach(function (s) {
        if (s && s.id != null) map[String(s.id)] = normSong(s)
      })
      songs = songs.map(function (s) {
        const d = map[s.id]
        if (!d) return s
        return Object.assign({}, s, {
          cover: d.cover || s.cover,
          album: d.album || s.album,
          albumId: d.albumId || s.albumId,
          duration: d.duration || s.duration,
          fee: d.fee,
        })
      })
    }
    return ok(
      {
        keywords,
        count: result.songCount || 0,
        songs,
        albums: (result.albums || []).map(function (a) {
          return { id: String(a.id), name: a.name, artist: (a.artists || []).map(function (x) { return x.name }).join(' / '), cover: pickCover(a.picUrl, 300), size: a.size || 0 }
        }),
        artists: (result.artists || []).map(function (a) {
          return { id: String(a.id), name: a.name, cover: pickCover(a.picUrl, 300), albumSize: a.albumSize || 0, alias: a.alias || [] }
        }),
        playlists: (result.playlists || []).map(normPlaylist).filter(Boolean),
      },
      origin,
    )
  },

  /** 歌曲详情（支持批量） */
  async songDetail(q, origin) {
    const raw = (q.get('ids') || q.get('id') || '').trim()
    if (!raw) return fail('缺少 ids', 400, origin)
    const ids = raw.split(',').map(function (s) { return s.trim() }).filter(Boolean).slice(0, 100)
    const key = 'detail:' + ids.join(',')
    const body = await withCache(key, CACHE_TTL.detail, async function () {
      const res = await weapiPost('/v3/song/detail', {
        c: JSON.stringify(ids.map(function (id) { return { id: Number(id) } })),
        ids: JSON.stringify(ids.map(Number)),
        csrf_token: '',
      })
      return assertUpstream(await readJson(res), "netease")
    })
    return ok((body && body.songs || []).map(normSong).filter(Boolean), origin)
  },

  /** 歌词 */
  async lyric(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const key = 'lyric:' + id
    const body = await withCache(key, CACHE_TTL.lyric, async function () {
      const res = await weapiPost('/song/lyric', { id: Number(id), lv: -1, kv: -1, tv: -1, csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    return ok(
      {
        id,
        lyric: (body && body.lrc && body.lrc.lyric) || '',
        translated: (body && body.tlyric && body.tlyric.lyric) || '',
        roma: (body && body.romalrc && body.romalrc.lyric) || '',
        noLyric: !!(body && body.nolyric),
      },
      origin,
    )
  },

  /** 歌单详情（含前 N 首） */
  async playlist(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const key = 'playlist:' + id
    const body = await withCache(key, CACHE_TTL.playlist, async function () {
      const res = await weapiPost('/v6/playlist/detail', { id: Number(id), n: 1000, s: 8, csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    if (!body || body.code !== 200 || !body.playlist) {
      return fail('歌单不存在或不可访问' + (body ? '（code ' + body.code + '）' : ''), 404, origin)
    }
    return ok(normPlaylist(body.playlist), origin)
  },

  /** 歌单全部歌曲（trackIds -> 分批 song/detail） */
  async playlistTracks(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const limit = Math.min(parseInt(q.get('limit') || '1000', 10) || 1000, 1000)
    const offset = Math.max(parseInt(q.get('offset') || '0', 10) || 0, 0)
    const key = 'playlistTracks:' + id + ':' + offset + ':' + limit
    const data = await withCache(key, CACHE_TTL.playlist, async function () {
      const res = await weapiPost('/v6/playlist/detail', { id: Number(id), n: 100000, s: 8, csrf_token: '' })
      const body = await readJson(res)
      if (!body || !body.playlist || !body.playlist.trackIds) return { ok: false }
      const slice = body.playlist.trackIds.slice(offset, offset + limit).map(function (t) { return t.id })
      const songs = []
      for (let i = 0; i < slice.length; i += 100) {
        const chunk = slice.slice(i, i + 100)
        const r2 = await weapiPost('/v3/song/detail', {
          c: JSON.stringify(chunk.map(function (x) { return { id: x } })),
          ids: JSON.stringify(chunk),
          csrf_token: '',
        })
        const b2 = await readJson(r2)
        if (b2 && b2.songs) songs.push.apply(songs, b2.songs)
      }
      return { ok: true, total: body.playlist.trackCount || slice.length, songs: songs.map(normSong).filter(Boolean) }
    })
    if (!data || data.ok === false) return fail('歌单不存在或不可访问', 404, origin)
    return ok(data, origin)
  },

  /** 排行榜列表 */
  async toplist(q, origin) {
    const body = await withCache('toplist', CACHE_TTL.toplist, async function () {
      const res = await weapiPost('/toplist', { csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    return ok(
      (body && body.list || []).map(function (t) {
        return { id: String(t.id), name: t.name, cover: pickCover(t.coverImgUrl, 300), updateFrequency: t.updateFrequency || '', trackCount: t.trackCount || 0, description: t.description || '' }
      }),
      origin,
    )
  },

  /** 推荐歌单 */
  async recommendPlaylist(q, origin) {
    const limit = Math.min(parseInt(q.get('limit') || '12', 10) || 12, 50)
    const key = 'recPlaylist:' + limit
    const body = await withCache(key, CACHE_TTL.recommend, async function () {
      const res = await weapiPost('/personalized/playlist', { limit, total: true, n: 1000, csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    return ok(
      (body && body.result || []).map(function (p) {
        return { id: String(p.id), name: p.name || '', cover: pickCover(p.picUrl, 400), playCount: p.playCount || 0, trackCount: p.trackCount || 0, type: p.type || 0 }
      }),
      origin,
    )
  },

  /** 推荐新歌 */
  async recommendNewSong(q, origin) {
    const limit = Math.min(parseInt(q.get('limit') || '12', 10) || 12, 50)
    const key = 'recNewSong:' + limit
    const body = await withCache(key, CACHE_TTL.recommend, async function () {
      const res = await weapiPost('/personalized/newsong', { limit, areaId: 0, csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    return ok((body && body.result || []).map(function (x) { return normSong(x.song || x) }).filter(Boolean), origin)
  },

  /** 歌单分类 */
  async catalogue(q, origin) {
    const body = await withCache('catalogue', 86400, async function () {
      const res = await weapiPost('/playlist/catalogue', { csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    let categories = (body && body.categories) || []
    if (categories && !Array.isArray(categories)) {
      categories = Object.keys(categories).map(function (k) { return categories[k] })
    }
    return ok(
      {
        categories,
        sub: (body && body.sub || []).map(function (s) { return { name: s.name, category: s.category, hot: s.hot || false } }),
      },
      origin,
    )
  },

  /** 歌手详情 */
  async artist(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const key = 'artist:' + id
    const body = await withCache(key, CACHE_TTL.artist, async function () {
      const res = await weapiPost('/v1/artist/' + id, { csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    const a = body && body.artist
    if (!a) return fail('歌手不存在', 404, origin)
    return ok(
      {
        id: String(a.id),
        name: a.name || '',
        alias: a.alias || [],
        cover: pickCover(a.picUrl || (a.cover && a.cover.url), 400),
        briefDesc: a.briefDesc || '',
        albumSize: a.albumSize || 0,
        musicSize: a.musicSize || 0,
        mvSize: a.mvSize || 0,
      },
      origin,
    )
  },

  /** 歌手热门歌曲 */
  async artistSongs(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const limit = Math.min(parseInt(q.get('limit') || '50', 10) || 50, 100)
    const key = 'artistSongs:' + id + ':' + limit
    const body = await withCache(key, CACHE_TTL.artist, async function () {
      const res = await weapiPost('/artist/top/song', { id: Number(id), csrf_token: '' })
      return assertUpstream(await readJson(res), "netease")
    })
    return ok((body && body.songs || []).slice(0, limit).map(normSong).filter(Boolean), origin)
  },
}

// ============================================================ 可播放 URL（Meting 聚合）

/** 依次尝试镜像，返回第一个可用的地址；type=url 时只取重定向目标，不转发音频流 */
async function resolveMeting(params) {
  const errors = []
  for (let i = 0; i < METING_MIRRORS.length; i++) {
    const mirror = METING_MIRRORS[i]
    const qs = new URLSearchParams(params).toString()
    const target = mirror + (mirror.indexOf('?') >= 0 ? '&' : '?') + qs
    try {
      const res = await fetch(target, {
        redirect: 'manual',
        headers: { 'User-Agent': UA, Referer: 'https://zhaokening.ccwu.cc/' },
      })
      // 302 -> 真实的音频 CDN 地址
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('Location')
        if (loc) return { ok: true, mirror, data: { url: loc } }
        errors.push(mirror + ': 重定向缺少 Location')
        continue
      }
      if (res.status !== 200) {
        errors.push(mirror + ': HTTP ' + res.status)
        continue
      }
      const ctype = res.headers.get('Content-Type') || ''
      // 直接把音频流吐回来的镜像：把这个镜像地址本身当作播放地址
      if (ctype.indexOf('audio') >= 0 || ctype.indexOf('octet-stream') >= 0) {
        return { ok: true, mirror, data: { url: target } }
      }
      const text = await res.text()
      if (params.type === 'url') {
        const trimmed = text.trim()
        if (/^https?:\/\//.test(trimmed)) return { ok: true, mirror, data: { url: trimmed } }
        errors.push(mirror + ': 返回内容不是地址')
        continue
      }
      return { ok: true, mirror, data: text }
    } catch (e) {
      errors.push(mirror + ': ' + (e && e.message ? e.message : 'error'))
    }
  }
  return { ok: false, errors }
}

const metingApi = {
  /** 取可播放地址 */
  async url(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const server = q.get('server') || 'netease'
    const br = q.get('br') || '320'
    const key = 'url:' + server + ':' + id + ':' + br
    const result = await withCache(key, CACHE_TTL.url, async function () {
      const r = await resolveMeting({ server, type: 'url', id, br })
      return r.ok ? { ok: true, url: r.data.url, mirror: r.mirror } : { ok: false, errors: r.errors }
    })
    if (!result.ok) return fail('所有镜像都拿不到播放地址：' + (result.errors || []).join(' | '), 502, origin)
    return ok({ url: result.url, mirror: result.mirror, id, server }, origin)
  },

  /** 歌词（网易云优先走 /api/lyric，这里只作为兜底） */
  async lyric(q, origin) {
    const id = (q.get('id') || '').trim()
    const name = q.get('name') || ''
    if (!id && !name) return fail('缺少 id 或 name', 400, origin)
    const server = q.get('server') || 'netease'
    const params = { server, type: 'lrc' }
    if (id) params.id = id
    else params.name = name
    const key = 'metingLrc:' + server + ':' + (id || name)
    const result = await withCache(key, CACHE_TTL.lyric, async function () {
      const r = await resolveMeting(params)
      return r.ok ? { ok: true, lyric: r.data, mirror: r.mirror } : { ok: false, errors: r.errors }
    })
    if (!result.ok) return fail('所有镜像都拿不到歌词', 502, origin)
    return ok({ lyric: result.lyric, mirror: result.mirror }, origin)
  },

  /** 通用 JSON 代理：song / playlist / search 等 */
  async proxy(q, origin) {
    const type = q.get('type') || 'song'
    const server = q.get('server') || 'netease'
    const params = { server, type }
    q.forEach(function (v, k) {
      if (['server', 'type'].indexOf(k) < 0) params[k] = v
    })
    const key = 'meting:' + JSON.stringify(params)
    const result = await withCache(key, CACHE_TTL.search, async function () {
      const r = await resolveMeting(params)
      return r.ok ? { ok: true, text: r.data, mirror: r.mirror } : { ok: false, errors: r.errors }
    })
    if (!result.ok) return fail('所有镜像都不可用：' + (result.errors || []).join(' | '), 502, origin)
    let parsed = null
    try {
      parsed = JSON.parse(result.text)
    } catch (e) {
      parsed = null
    }
    return ok({ raw: result.text, json: parsed, mirror: result.mirror }, origin)
  },
}

// ============================================================ 音频代理（补 Range 支持）

/** 曲库托管在 sakura-music.pages.dev，但那边不实现 HTTP Range：
    无论带不带 Range 头都回 200 + 整个文件。浏览器于是把 <audio> 判定为不可 seek
    （实测 audio.seekable 恒为 [[0,0]]，设 currentTime 会被打回 0），进度条完全拖不动。
    这里做一层代理：整首读进内存 → 写进边缘缓存 → 自己实现 206 分片。*/
const MUSIC_ORIGIN = 'https://sakura-music.pages.dev/music/'

const MUSIC_MEM = new Map() // 单个 isolate 内的小缓存，最多留 4 首
const MUSIC_MEM_MAX = 4

function parseRange(header, total) {
  if (!header) return null
  const m = /bytes=(\d*)-(\d*)/.exec(String(header))
  if (!m) return null
  let start, end
  if (m[1] === '') {
    const n = Number(m[2])
    if (!n) return null
    start = Math.max(0, total - n)
    end = total - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? total - 1 : Number(m[2])
  }
  if (isNaN(start) || isNaN(end) || start > end || start >= total) return { invalid: true }
  return { start: start, end: Math.min(end, total - 1) }
}

async function serveMusic(request, ctx) {
  const url = new URL(request.url)
  let name = ''
  try { name = decodeURIComponent(url.pathname.slice('/music/'.length)) } catch (e) { name = '' }
  if (!name || name.indexOf('/') >= 0 || name.indexOf('..') >= 0) {
    return new Response('文件名不合法', { status: 400 })
  }
  const headers = {
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
  }
  let buf = MUSIC_MEM.get(name) || null
  if (!buf) {
    const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null
    const cacheKey = new Request('https://sakura-music-cache.internal/' + encodeURIComponent(name))
    let hit = null
    if (cache) { try { hit = await cache.match(cacheKey) } catch (e) { hit = null } }
    if (hit) {
      buf = await hit.arrayBuffer()
    } else {
      const up = await fetch(MUSIC_ORIGIN + encodeURIComponent(name))
      if (!up.ok) {
        return new Response('音频不存在：' + name, { status: up.status, headers: { 'Access-Control-Allow-Origin': '*' } })
      }
      buf = await up.arrayBuffer()
      if (cache) {
        const put = cache.put(cacheKey, new Response(buf, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength) } }))
        if (ctx && ctx.waitUntil) ctx.waitUntil(put.catch(function () {}))
        else { try { await put } catch (e) {} }
      }
    }
    if (MUSIC_MEM.size >= MUSIC_MEM_MAX) { MUSIC_MEM.delete(MUSIC_MEM.keys().next().value) }
    MUSIC_MEM.set(name, buf)
  }
  const total = buf.byteLength
  const range = parseRange(request.headers.get('Range'), total)
  if (range && range.invalid) {
    return new Response(null, { status: 416, headers: Object.assign({}, headers, { 'Content-Range': 'bytes */' + total }) })
  }
  if (range) {
    const slice = buf.slice(range.start, range.end + 1)
    return new Response(request.method === 'HEAD' ? null : slice, {
      status: 206,
      headers: Object.assign({}, headers, {
        'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + total,
        'Content-Length': String(slice.byteLength),
      }),
    })
  }
  return new Response(request.method === 'HEAD' ? null : buf, {
    status: 200,
    headers: Object.assign({}, headers, { 'Content-Length': String(total) }),
  })
}

// ============================================================ 路由

const ROUTES = {
  '/api/health': async function (q, origin) {
    return jsonResponse({ ok: true, service: 'sakura-music-api', version: 1, mirrors: METING_MIRRORS.length, time: new Date().toISOString() }, 200, origin)
  },
  '/api/search': api.search,
  '/api/song/detail': api.songDetail,
  '/api/lyric': api.lyric,
  '/api/playlist': api.playlist,
  '/api/playlist/tracks': api.playlistTracks,
  '/api/toplist': api.toplist,
  '/api/recommend/playlist': api.recommendPlaylist,
  '/api/recommend/newsong': api.recommendNewSong,
  '/api/catalogue': api.catalogue,
  '/api/artist': api.artist,
  '/api/artist/songs': api.artistSongs,
  '/api/url': metingApi.url,
  '/api/url/lyric': metingApi.lyric,
  '/api/meting': metingApi.proxy,
  '/api/tv': tvList,
  '/api/tv/img': tvImage,
}

// ============================================================ 影视（苹果 CMS 采集）
/* 实测 12 个公开采集接口：只要请求带 Origin，响应里就没有 Access-Control-Allow-Origin
   （不带 Origin 反而给 *）—— 浏览器直连必定被 CORS 拦死，页面只能一片空白。
   这里由 Worker 转发：服务端请求不带 Origin，上游照常返回数据，再按白名单回给本站。
   视频流同理：hls.js 取 m3u8 和分片都是 XHR，所以播放列表和分片也一起代理，
   并把播放列表里的相对/绝对地址重写回本代理，前端不需要知道上游域名。 */
/* 这批源是 2026-09-16 在 TVBox/Fongmi 配置里挖出来后逐个实测的：
   列表 20 条、每条都带 .m3u8 直链、响应 1.1~2.6 秒。支持 wd 关键词搜索的排前面，
   不支持搜索的（实测回「暂不支持搜索」）只在列表/详情时兜底，避免搜索白等一轮。 */
const TV_SEARCH_SOURCES_RAW = [
  'https://api.guangsuapi.com/api.php/provide/vod/', // 光速 gsyun/gsm3u8
  'https://api.ukuapi.com/api.php/provide/vod/', // ukyun/ukm3u8
  'https://cj.lziapi.com/api.php/provide/vod/', // 量子 liangzi/lzm3u8
  'https://cj.ffzyapi.com/api.php/provide/vod/', // 非凡 feifan/ffm3u8
  'https://api.apibdzy.com/api.php/provide/vod/', // 百度 dbm3u8
  'https://caiji.dyttzyapi.com/api.php/provide/vod/', // 电影天堂 dytt/dyttm3u8
  'https://api.zuidapi.com/api.php/provide/vod/', // 最大 zuidam3u8
]

const TV_LIST_ONLY_RAW = [
  'https://api.wsyzy.net/api.php/provide/vod/', // 无损云 wsym3u8（88lin/video_vip 用的那个）
  'https://tyyszy.com/api.php/provide/vod/', // 同源 tym3u8
  'https://suoniapi.com/api.php/provide/vod/', // 索尼 snm3u8
]

/* 给用户看的源名，和 TV_SOURCES_RAW 一一对应，顺序不能动 */
const TV_NAMES_RAW = ['光速', 'uku', '量子', '非凡', '百度', '电影天堂', '最大', '无损云', '同源', '索尼']

/* ---------------- 临时停用的源 ----------------
   只动这一行：写上源名＝彻底不调用它的接口，删掉＝立刻恢复。
   暂停做法是「从列表里摘掉」而不是打个标记跳过，所以 id 会自动重排成新的连续下标，
   前端「片源」那排按钮、_src 参数、详情页的线路都跟着新列表走，不会串位。
   2026-11-11 用户要求先停 光速、uku，随后追加 同源、索尼。
   2026-11-11 稍后用户要求四个源全部恢复，故清空本列表：TV_OFF = []。
   想再停某个源，往下面的方括号里写源名即可（源名见 TV_NAMES_RAW）。 */
const TV_OFF = []
const TV_ALL_RAW = TV_SEARCH_SOURCES_RAW.concat(TV_LIST_ONLY_RAW)
const TV_KEEP = TV_NAMES_RAW.map(function (n, i) { return TV_OFF.indexOf(n) < 0 ? i : -1 })
  .filter(function (i) { return i >= 0 })
const TV_SOURCES = TV_KEEP.map(function (i) { return TV_ALL_RAW[i] })
const TV_NAMES = TV_KEEP.map(function (i) { return TV_NAMES_RAW[i] })
/* 支持 wd 搜索的源（同样按上面的开关过滤） */
const TV_SEARCH_SOURCES = TV_SOURCES.filter(function (b) { return TV_SEARCH_SOURCES_RAW.indexOf(b) >= 0 })

/* 前端「片源」那排按钮用这个列表 */
function tvSourceList() {
  return TV_SOURCES.map(function (b, i) {
    return { id: i, name: TV_NAMES[i] || '源 ' + (i + 1), search: TV_SEARCH_SOURCES.indexOf(b) >= 0 }
  })
}

/* 采集站几乎都挂着一个成人栏目；本站不展示，直接在网关里摘干净（前端 js/tv.js 还有一层） */
const TV_ADULT = /伦理|福利|里番|情色|成人|无码|色情|自拍|偷拍|人妖|淫/

function tvClean(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return text
  }
  if (data && Array.isArray(data['class'])) {
    data['class'] = data['class'].filter(function (c) {
      return !TV_ADULT.test(String(c.type_name || ''))
    })
  }
  if (data && Array.isArray(data.list)) {
    data.list = data.list.filter(function (it) {
      return !TV_ADULT.test(String(it.type_name || ''))
    })
  }
  return JSON.stringify(data)
}

const TV_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/* 单次上游超时：某个源挂了不能把整页卡住（实测有源会 30s 不响应） */
function tvSignal(ms) {
  try {
    if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms)
  } catch (e) {
    /* 走下面的兜底 */
  }
  try {
    const c = new AbortController()
    setTimeout(function () {
      try {
        c.abort()
      } catch (e) {}
    }, ms)
    return c.signal
  } catch (e) {
    return undefined
  }
}

/* 命中的源记在 isolate 里，后续请求先打它，少绕弯路 */
let TV_ACTIVE = ''

/* 这些站的 ac=list 里 class[].type_id 和 videolist 真正认的 type_id 不是一个编号空间：
   实测拿 class 的 id 去筛，电影=1 条甚至 0 条；拿列表条目自带的 type_id 去筛，同一个
   分类能出 4044 条。所以分类表自己造——扫几页最新列表，按条目里的 type_id/type_name 归类，
   并按源缓存一小时。 */
const TV_CATS = {}

/* 固定分类档：以前整排分类是「当前活跃源临时扫出什么就显示什么」，活跃源一变整排就变，
   用户看着就是每次都不一样。现在写死这一排，所有源用同一套名字；
   点的时候网关再把这个名字翻译成当前源自己的 type_id（各站编号不是一套）。
   括号里的数字是 10 个源里能对上的数量：电影/电视剧/动漫/综艺/纪录片/短剧 10/10、
   预告片 8/10、体育 7/10（体育把足球/篮球/网球/斯诺克/台球并在一起）。 */
/* 每档对应上游哪些子类型。上游只认单个编号（实测 t=6,7,10 只取第一个），
   而且真正能出片的编号是这些子类型（「电影=1」「电视剧=2」这两个顶层编号各站都几乎是空的），
   所以一档要并几个编号，见下面 tvMergeTypes。 */
const TV_CANON = [
  ['电影', /^(电影片?|动作片|喜剧片|爱情片|科幻片|剧情片|恐怖片|战争片|奇幻片|犯罪片|悬疑片|冒险片|动画电影|动漫电影|4K电影|邵氏电影|Netflix电影)$/],
  ['电视剧', /^(电视剧|连续剧|其他剧|Netflix自制剧|大陆剧|国产剧|欧美剧|港澳剧|香港剧|港台剧|韩剧|韩国剧|日剧|日本剧|泰剧|泰国剧|台湾剧|台剧|海外剧)$/],
  ['动漫', /^(动漫片?|动画片|动画电影|动漫电影|中国动漫|国产动漫|日本动漫|日韩动漫|欧美动漫|港台动漫|海外动漫|漫剧|AI漫剧|有声动漫)$/],
  ['综艺', /^(综艺片?|大陆综艺|日韩综艺|港台综艺|欧美综艺)$/],
  ['纪录片', /^(纪录片|记录片|科普学习)$/],
  /* 短剧那些「古装仙侠/现代都市/反转爽剧」其实是竖屏短剧的子类型，并进来，
     它们就不会再各自占一格、每次刷新换个样子 */
  ['短剧', /^(短剧|爽文短剧|擦边短剧|反转爽剧|古装仙侠|现代都市|穿越年代|重生民国|言情总裁|脑洞悬疑|女频恋爱)$/],
  ['体育', /^(体育|体育赛事|足球|篮球|网球|斯诺克|台球|其他赛事)$/],
  ['预告片', /^(预告片|预告解说)$/],
]

function tvCanonHit(name, nm) {
  for (let i = 0; i < TV_CANON.length; i++) {
    if (TV_CANON[i][0] === name) return TV_CANON[i][1].test(String(nm || ''))
  }
  return false
}

/* 一档对应多个上游编号时，并行拉同一页再合并去重（上游不认逗号，只能自己并） */
async function tvMergeTypes(base, ids, q) {
  const res = await Promise.all(
    ids.map(function (id) {
      const qq = new URLSearchParams(q)
      qq.set('t', id)
      return fetch(base + '?' + qq.toString(), {
        headers: { 'User-Agent': TV_UA, Referer: base, Accept: 'application/json,text/plain,*/*' },
        signal: tvSignal(6000),
        cf: { cacheTtl: 120, cacheEverything: true },
      })
        .then(function (r) {
          return r.ok ? r.text() : ''
        })
        .then(function (t) {
          if (!t || (t.indexOf('"list"') < 0 && t.indexOf('"class"') < 0)) return null
          return JSON.parse(t)
        })
        .catch(function () {
          return null
        })
    }),
  )
  const ok = res.filter(Boolean)
  if (!ok.length) return ''
  const seen = {}
  const list = []
  let total = 0
  ok.forEach(function (j) {
    total += parseInt(j.total || 0, 10) || 0
    ;(j.list || []).forEach(function (it) {
      const k = String(it.vod_id || '') + '|' + String(it.vod_name || '')
      if (seen[k]) return
      seen[k] = 1
      list.push(it)
    })
  })
  const first = ok[0]
  first.list = list
  first.total = total
  first.pagecount = Math.max(1, Math.ceil(total / (parseInt(first.limit, 10) || 20)))
  return JSON.stringify(first)
}

/* 固定档 -> 该源真实编号（可能好几个）。只用扫列表得到的编号：
   ac=list 里那套 class 编号上游基本不认（实测「电影=1」各站都只出 0~1 条）。结果按 源+档 记一小时。 */
const TV_CID = {}

async function tvCanonIds(idx, name) {
  const key = idx + '|' + name
  const hit = TV_CID[key]
  if (hit && Date.now() - hit.at < 3600000) return hit.ids
  const ids = []
  const cats = await tvCategories(idx)
  cats.forEach(function (c) {
    const id = String(c.type_id || '')
    if (id && tvCanonHit(name, c.type_name) && ids.indexOf(id) < 0) ids.push(id)
  })
  /* 一页最多并 4 个编号：再多请求太多，够撑起首屏 */
  const out = ids.slice(0, 4)
  TV_CID[key] = { at: Date.now(), ids: out }
  return out
}

async function tvCategories(idx) {
  const hit = TV_CATS[idx]
  if (hit && Date.now() - hit.at < 3600000) return hit.list
  const base = TV_SOURCES[idx]
  if (!base) return []
  const map = new Map()
  /* 并行扫 6 页（串行太慢，首屏等不起）：每页 20 条，凑出几十个真实分类；
     结果按源缓存一小时，之后就是内存命中 */
  /* 光看最新几页不够：光速最新几页几乎全是短剧，电影/电视剧的子类型编号根本不会出现。
     掺几个深页（各站列表都是按时间倒排的，深页类型才杂），才能把「动作片=6、大陆剧=13」
     这些真编号扫出来。 */
  const pages = [1, 2, 3, 20, 60, 200]
  const results = await Promise.all(
    pages.map(async function (pg) {
      try {
        const r = await fetch(base + '?ac=videolist&pg=' + pg, {
          headers: { 'User-Agent': TV_UA, Referer: base, Accept: 'application/json,text/plain,*/*' },
          signal: tvSignal(7000),
        })
        if (!r.ok) return []
        const j = JSON.parse(await r.text())
        return j.list || []
      } catch (e) {
        return []
      }
    }),
  )
  results.forEach(function (list) {
    list.forEach(function (it) {
      const id = String(it.type_id || '')
      const nm = String(it.type_name || '')
      if (!id || !nm || TV_ADULT.test(nm)) return
      if (!map.has(id)) map.set(id, nm)
    })
  })
  const list = []
  map.forEach(function (nm, id) {
    list.push({ type_id: id, type_name: nm })
  })
  /* 扫空也记一下（TTL 只留 1 分钟）：冷启动并发扫描容易失败，不记住就会反复重扫白耗子请求额度 */
  TV_CATS[idx] = { at: Date.now() - (list.length ? 0 : 3540000), list: list }
  return list
}

/* 分类表：优先用扫描出来的真实 type_id；扫不到再退回上游原始 class 表 */
async function tvClassList(params, origin) {
  const pin = parseInt(params.get('_src') || '', 10)
  const idx = !isNaN(pin) && TV_SOURCES[pin] ? pin : TV_SOURCES.indexOf(TV_ACTIVE) >= 0 ? TV_SOURCES.indexOf(TV_ACTIVE) : 0
  /* 返回写死的那一排（不是扫出来的），所以不管当前活跃源是哪个、刷新几次，这一排都一样。
     type_id 这里放的就是分类名，前端点它、网关再翻译成各源真实编号。
     等这张表扫出来（最多 3 秒）：分类按钮晚一两秒出无所谓，但用户第一次点分类时
     表还没热就会空手（冷启动实测过：电影/电视剧点了没反应，等会儿再点又好了）。 */
  await Promise.race([
    tvCategories(idx).catch(function () {}),
    new Promise(function (r) {
      setTimeout(r, 3000)
    }),
  ])
  const list = TV_CANON.map(function (c) { return { type_id: c[0], type_name: c[0] } })
  return jsonResponse({ code: 1, msg: '数据列表', class: list, _src: idx, sources: tvSourceList() }, 200, origin, {
    'Cache-Control': 'public, max-age=600',
  })
}

/* 多源并起来：浏览打全部 10 个源、搜索只打支持 wd 的 7 个。
   并行发、最多等 4.2 秒，谁先回来算谁的；按片名去重，每条塞上它自己的源编号 _src，
   前端点进详情时带着这个编号回去单点那一个源，各站编号不会串。
   轮转着取（每个源先出 1 条再取第 2 条），首页看起来是混着的，不会被第一个源占满。
   一条都没回来就返回 null，交给下面那套单源接力兜底。 */
/* 有的采集站压根不认 wd：你搜「蜘蛛侠」，它把最新片单整页塞给你，用户就看到完全不相关的片。
   搜索时让每个源先自证：这一页里连一条都不沾关键词的，判定它没在搜，整页丢掉。 */
function tvHit(it, kw) {
  const s = [
    it && it.vod_name,
    it && it.vod_sub,
    it && it.vod_en,
    it && it.vod_actor,
    it && it.vod_director,
    it && it.vod_tag,
  ]
    .join(' ')
    .toLowerCase()
  return s.indexOf(kw) >= 0
}

async function tvAggregate(params, origin, bases, ac) {
  const wd = params.get('wd') || ''
  const kw = wd.trim().toLowerCase()
  const pg = params.get('pg') || '1'
  const per = wd ? 60 : 6
  const got = []
  const jobs = bases.map(function (base, i) {
    const q = new URLSearchParams({ ac: ac, pg: pg })
    if (wd) q.set('wd', wd)
    const t0 = Date.now()
    return fetch(base + '?' + q.toString(), {
      headers: { 'User-Agent': TV_UA, Referer: base, Accept: 'application/json,text/plain,*/*' },
      signal: tvSignal(6000),
      cf: { cacheTtl: 120, cacheEverything: true },
    })
      .then(function (r) {
        return r.ok ? r.text() : ''
      })
      .then(function (text) {
        if (!text || text.indexOf('"list"') < 0) return
        const j = JSON.parse(text)
        let items = j.list || []
        if (kw) {
          items = items.filter(function (it) {
            return tvHit(it, kw)
          })
          /* 这个源这一页一条都不沾关键词 —— 它没在搜，别拿最新片单冒充结果 */
          if (!items.length) return
        }
        got.push({
          i: i,
          base: base,
          list: items,
          total: j.total || 0,
          pagecount: j.pagecount || 1,
          /* 顺手记下这次每个源花了多久，前端会把它标在「片源」按钮上，方便挑快的 */
          ms: Date.now() - t0,
          n: items.length,
        })
      })
      .catch(function () {
        /* 这个源没赶上就算了 */
      })
  })
  await Promise.race([
    Promise.all(jobs),
    new Promise(function (res) {
      setTimeout(res, 4200)
    }),
  ])
  if (!got.length) return null
  const seen = Object.create(null)
  const list = []
  let total = 0
  let pagecount = 0
  got.forEach(function (g) {
    total += Number(g.total) || 0
    pagecount = Math.max(pagecount, Number(g.pagecount) || 0)
  })
  for (let round = 0; round < per; round++) {
    for (let k = 0; k < got.length; k++) {
      const it = got[k].list[round]
      if (!it) continue
      const nm = String(it.vod_name || '')
      const tn = String(it.type_name || '')
      if (!nm || seen[nm] || TV_ADULT.test(nm) || TV_ADULT.test(tn)) continue
      seen[nm] = 1
      it._src = got[k].i
      list.push(it)
    }
  }
  if (!list.length) return null
  TV_ACTIVE = got[0].base
  return jsonResponse(
    {
      code: 1,
      msg: '数据列表',
      page: Number(pg) || 1,
      pagecount: Math.max(pagecount, 1),
      limit: list.length,
      /* 聚合结果的 total 没有意义，别再编一个出来。
         以前这里是「每页条数 × 最深那个源的页数」（封顶 2000）：实测首页
         list=37、total=74000 → 前端算出 2000 页，用户翻到第 2 页看到的
         其实是各采集源自己的第 2 页，和首页完全不连续、去重后大片重复 ——
         一个永远翻不到底、每翻一页都换一批片的假分页。
         现在如实标记成聚合：total = 本页条数（于是前端算出的页数恒为 1），
         再给一个 _agg: true 让前端明确知道「这一批不能按页翻，只能用加载更多」。
         真实相加值仍然放 _total 备查。 */
      total: list.length,
      _agg: true,
      _total: total,
      list: list,
      _src: got[0].i,
      _srcs: got.length,
      sources: tvSourceList(),
      _stats: got.map(function (g) {
        return { i: g.i, ms: g.ms, n: g.n }
      }),
    },
    200,
    origin,
    { 'Cache-Control': 'public, max-age=60' },
  )
}

async function tvList(params, origin) {
  const ac = params.get('ac') === 'videolist' ? 'videolist' : 'list'
  if (ac === 'list') return tvClassList(params, origin)
  const q = new URLSearchParams({ ac })
  /* t 现在可能是固定档的名字（电影/动漫…），也可能还是老编号（前端缓存/手改链接）。
     名字不直接下发，等下按每个源翻译成它自己的 type_id。 */
  const tRaw = params.get('t') || ''
  const tCanon = tRaw && !/^[0-9]+$/.test(tRaw) ? tRaw : ''
  ;['t', 'pg', 'wd', 'ids'].forEach(function (k) {
    const v = params.get(k)
    if (v && !(k === 't' && tCanon)) q.set(k, v)
  })
  const errors = []
  const wd = params.get('wd') || ''
  const pin = parseInt(params.get('_src') || '', 10)
  /* 分类和详情必须只问一个源（各站 type_id 不是一套编号，串了就会点错片），
     其余情况（首页最新、搜索）把多个源并起来，见上面的 tvAggregate */
  /* pick=1：用户在「片源」里手动指定了某一个源，那就只问他，别聚合 */
  if (!params.get('t') && !params.get('ids') && !params.get('pick')) {
    const merged = await tvAggregate(params, origin, wd ? TV_SEARCH_SOURCES : TV_SOURCES, ac)
    if (merged) return merged
  }
  /* 各站 type_id 编号不一样（同一部「电影」在 A 站是 1、在 B 站可能是 27），
     所以前端会带上上次分类列表来自哪号源 _src。搜索时只打支持 wd 的源
     （不支持的那些会回「暂不支持搜索」，白等一轮）。 */
  /* ⚠ 详情（ids=）必须【只问指定的那一个源】，不能像分类那样换源重试。
     vod_id 只在单个源内唯一，跨源同号往往是另一部片：一旦指定的源没返回
     （超时/空 list），接力到下一个源就会拿「同号的另一部片」当结果返回，
     用户看到的就是「点这部海报，打开的却是完全不同的东西」；
     若都没命中，则返回空 list，前端报「没拿到该资源」—— 就是「点不进去」。
     分类/列表可以换源（t 是各站自己的编号，换了要删掉重拉），
     详情不行：宁可明确报错，也不能给错片。 */
  const onlyIds = !!params.get('ids') && !isNaN(pin) && TV_SOURCES[pin]
  const order = onlyIds
    ? [TV_SOURCES[pin]]
    : !isNaN(pin) && TV_SOURCES[pin]
      ? [TV_SOURCES[pin]].concat(
          TV_SOURCES.filter(function (b) {
            return b !== TV_SOURCES[pin]
          }),
        )
      : wd
        ? TV_SEARCH_SOURCES
        : TV_ACTIVE
          ? [TV_ACTIVE].concat(
              TV_SOURCES.filter(function (b) {
                return b !== TV_ACTIVE
              }),
            )
          : TV_SOURCES
  let tCanonTried = 0
  for (const base of order) {
    try {
      if (tCanon) {
        /* 固定档 -> 这个源的几个真编号，并起来返回；这个源没有这一档就换下一个源试
           （体育只有 7 个源有）。最多试 4 个源，免得挨个试 10 个源撞 Worker 子请求上限。 */
        if (tCanonTried >= 4) break
        tCanonTried++
        const ids = await tvCanonIds(TV_SOURCES.indexOf(base), tCanon)
        if (!ids.length) {
          errors.push(base + ': 没有「' + tCanon + '」分类')
          continue
        }
        const merged = await tvMergeTypes(base, ids, q)
        if (!merged) {
          errors.push(base + ': 该分类没取到数据')
          continue
        }
        TV_ACTIVE = base
        let out = tvClean(merged)
        try {
          const o = JSON.parse(out)
          o._src = TV_SOURCES.indexOf(base)
          o.sources = tvSourceList()
          out = JSON.stringify(o)
        } catch (e) {
          /* 不是 JSON 就原样返回 */
        }
        return new Response(out, {
          headers: Object.assign(
            { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
            corsHeaders(origin),
          ),
        })
      }
      const qq = new URLSearchParams(q)
      if (base !== order[0] && qq.get('t')) {
        /* 换了源以后原来那个编号 t 就没意义了，去掉它按最新拉 */
        qq.delete('t')
      }
      const r = await fetch(base + '?' + qq.toString(), {
        headers: { 'User-Agent': TV_UA, Referer: base, Accept: 'application/json,text/plain,*/*' },
        signal: tvSignal(6000),
        cf: { cacheTtl: 120, cacheEverything: true },
      })
      if (!r.ok) {
        errors.push(base + ': HTTP ' + r.status)
        continue
      }
      const text = await r.text()
      if (text.indexOf('"list"') < 0 && text.indexOf('"class"') < 0) {
        errors.push(base + ': 返回内容不是片单')
        continue
      }
      TV_ACTIVE = base
      /* 顺带告诉前端这次的源编号，后续分类/翻页带上它，编号才对得上 */
      let out = tvClean(text)
      try {
        const o = JSON.parse(out)
        /* ⚠ 详情请求必须校验命中，不能「有 list 就算成功」：
           上游找不到该 id 时返回的是 {"list":[]}，照直返回会让前端报
           「没拿到该资源」= 用户点不进去；而继续换源又会撞上跨源同号的
           另一部片 = 打开完全不同的东西。所以这里要求 list 非空且 id 对得上，
           对不上就当这个源没命中，继续找（或最终明确报错）。 */
        const wantIds = String(params.get('ids') || '')
        if (wantIds) {
          const want = wantIds.split(',')[0].trim()
          const hit = (o.list || []).filter(function (x) {
            return String(x && x.vod_id) === want
          })
          if (!hit.length) {
            errors.push(base + ': 没有该 id')
            continue
          }
          o.list = hit
        }
        o._src = TV_SOURCES.indexOf(base)
        o.sources = tvSourceList()
        out = JSON.stringify(o)
      } catch (e) {
        /* 不是 JSON 就原样返回 */
      }
      return new Response(out, {
        headers: Object.assign(
          { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' },
          corsHeaders(origin),
        ),
      })
    } catch (e) {
      errors.push(base + ': ' + (e && e.message))
    }
  }
  return fail('所有片源都不可用：' + errors.join(' | '), 502, origin)
}

async function tvImage(params, origin) {
  /* 海报图床普遍有热链保护（直连会 418），一起代理掉，卡片才有图 */
  const target = params.get('u') || ''
  if (!/^https?:\/\//i.test(target)) return fail('u 参数不合法', 400, origin)
  let host = ''
  try {
    host = new URL(target).origin + '/'
  } catch (e) {
    host = ''
  }
  let r
  try {
    r = await fetch(target, { headers: { 'User-Agent': TV_UA, Referer: host }, signal: tvSignal(9000) })
  } catch (e) {
    return fail('拉图失败：' + (e && e.message), 502, origin)
  }
  if (!r.ok) return fail('上游 ' + r.status, 502, origin)
  /* 整张取回来再吐：这些图床对数据中心 IP 起步很慢，直接流式转发会把
     Content-Length 拖着走（实测 17KB 的图 30 秒才到 11KB），缓冲后正常 */
  let buf
  try {
    buf = await r.arrayBuffer()
  } catch (e) {
    return fail('读图失败：' + (e && e.message), 502, origin)
  }
  const headers = Object.assign({ 'Cache-Control': 'public, max-age=86400' }, corsHeaders(origin))
  const ct = r.headers.get('Content-Type')
  headers['Content-Type'] = ct && ct.indexOf('image/') === 0 ? ct : 'image/jpeg'
  headers['Content-Length'] = String(buf.byteLength)
  return new Response(buf, { status: 200, headers })
}

async function tvStream(params, origin, request) {
  const target = params.get('u') || ''
  if (!/^https?:\/\//i.test(target)) return fail('u 参数不合法', 400, origin)
  const upstreamHeaders = { 'User-Agent': TV_UA, Referer: target }
  const range = request && request.headers.get('Range')
  if (range) upstreamHeaders.Range = range
  let r
  try {
    r = await fetch(target, { headers: upstreamHeaders })
  } catch (e) {
    return fail('拉流失败：' + (e && e.message), 502, origin)
  }
  if (!r.ok && r.status !== 206) return fail('上游 ' + r.status, 502, origin)

  const ct = (r.headers.get('Content-Type') || '').toLowerCase()
  const looksM3u8 = ct.indexOf('mpegurl') >= 0 || /\.m3u8(\?|$)/i.test(target)
  if (looksM3u8) {
    let text = await r.text()
    if (text.indexOf('#EXTM3U') >= 0) {
      const base = new URL(target)
      text = text
        .split('\n')
        .map(function (line) {
          const t = line.trim()
          if (!t) return line
          if (t.charAt(0) === '#') {
            /* 加密流的 key 也在上游，顺手代理；其余标签原样保留 */
            return line.replace(/URI="([^"]+)"/g, function (m, u) {
              let abs = u
              try {
                abs = new URL(u, base).href
              } catch (e) {
                /* 解析不了就原样 */
              }
              return 'URI="/api/tv/stream?u=' + encodeURIComponent(abs) + '"'
            })
          }
          let abs = t
          try {
            abs = new URL(t, base).href
          } catch (e) {
            return line
          }
          return '/api/tv/stream?u=' + encodeURIComponent(abs)
        })
        .join('\n')
    }
    return new Response(text, {
      headers: Object.assign(
        { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' },
        corsHeaders(origin),
      ),
    })
  }

  const headers = Object.assign({}, corsHeaders(origin))
  ;['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified', 'ETag'].forEach(function (h) {
    const v = r.headers.get(h)
    if (v) headers[h] = v
  })
  if (!headers['Accept-Ranges']) headers['Accept-Ranges'] = 'bytes'
  return new Response(r.body, { status: r.status, headers })
}

/* 定长比较：长度不同直接否，长度相同逐字节异或累加（不提前 return）。
   用来比对门卫密钥，避免用 === 时泄露「前几位对了」的时间差。 */
function safeEqualStr(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    /* ---------------- 影视接口门卫 ----------------
       影视数据现在必须经由 zhaokening.ccwu.cc/api/tv* 的 tv-gate Worker 转发，
       它在转发时会带上内部头 X-Gate-Secret。没有这个头的一律拒绝 ——
       这样公开的 sakura-music-api.pages.dev/api/tv* 直连就作废了。
       （README 里那个地址本来是写给浏览器直连的，加了门禁之后它就是漏洞。）

       只拦 /api/tv*，音乐那一整套接口（/api/search、/api/url…）完全不受影响。
       密钥缺失时按「失败关闭」处理：宁可 503，也不把数据漏出去。 */
    if (url.pathname.indexOf('/api/tv') === 0) {
      const gateSecret = env && env.TV_GATE_SECRET
      if (!gateSecret) {
        return jsonResponse(
          { ok: false, error: '影视接口未配置门卫密钥（TV_GATE_SECRET 缺失）' },
          503,
          origin,
        )
      }
      if (!safeEqualStr(request.headers.get('X-Gate-Secret') || '', gateSecret)) {
        return jsonResponse({ ok: false, error: '影视接口需要门卫授权' }, 403, origin)
      }
    }

    // 音频走 Range 代理（曲库源站不支持 Range）
  if (url.pathname.indexOf('/music/') === 0) {
    return serveMusic(request, ctx)
  }

  /* 视频流要带 Range 头，handler 签名只有 (params, origin)，所以单独在这里分发 */
  if (url.pathname === '/api/tv/stream') {
    return tvStream(url.searchParams, origin, request)
  }

  const handler = ROUTES[url.pathname] || ROUTES[url.pathname.replace(/\/$/, '')]
    if (!handler) {
      // 非 API 路径交给静态资源（静态资源含首页外壳 index.html）
      if (env && env.ASSETS) {
        try {
          return await env.ASSETS.fetch(request)
        } catch (e) {
          /* 落到下面的 404 */
        }
      }
      return jsonResponse(
        {
          ok: false,
          error: 'Not Found: ' + url.pathname,
          endpoints: Object.keys(ROUTES),
        },
        404,
        origin,
      )
    }

    try {
      return await handler(url.searchParams, origin)
    } catch (e) {
      return fail('内部错误：' + (e && e.message ? e.message : String(e)), 500, origin)
    }
  },
}
