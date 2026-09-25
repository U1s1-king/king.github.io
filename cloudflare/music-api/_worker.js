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

/* 可播放 URL 的镜像池（按优先级）。
   2026-09 实测（server=netease&type=url&id=…）：
     ✅ api.qijieya.cn     302 -> m8xx.music.126.net
     ✅ api.injahow.cn     302 -> m7xx.music.126.net
     ❌ music.xianqiao.wang 200 + 一页 HTML（不是音频也不是地址）
     ❌ meting.qjqq.cn     522
   所以把两个能用的排在前面，坏的分母留在后面兜底（将来复活也能自动用上）。 */
const METING_MIRRORS = [
  'https://api.qijieya.cn/meting/',
  'https://api.injahow.cn/meting/',
  /* 2026-09-23 复测新发现的可用镜像（302 -> 真实 CDN）。
     调研报告说它「已死」，实测是好的 —— 所以镜像存活一定要自己测。 */
  'https://api.msls1441.com/',
  /* 下面两个目前是坏的（qjqq 522 / xianqiao 只回 HTML），留着当分母，
     将来复活能自动用上；不会拖慢请求，因为拿到 HTML 错误页会立刻换下一个。 */
  'https://meting.qjqq.cn/',
  'https://music.xianqiao.wang/netease/',
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

/* 缓存分两级：
     L1 = 进程内 Map —— 只是为了省掉一次 await，isolate 一回收就没了；
     L2 = **Cloudflare 边缘缓存 caches.default** —— 跨 isolate、跨 PoP 共享。

   原来是**只有 L1**，问题很实在：每个 isolate 各存各的，命中全看运气
   （只有同一用户反复打到同一个 PoP 的同一个 isolate 才算命中），
   isolate 一被回收缓存就全丢。边缘缓存才是真正提高命中率的那一层，
   而且所有客户端（App + 网站）一起受益，不用改任何客户端代码。

   ⚠️ caches.default.put() 必须挂到 ctx.waitUntil()：响应一返回，
      没 await 的写入会被运行时取消，缓存就永远写不进去。
      所以下面用模块级 CURRENT_CTX 接住 fetch 的第三个参数。 */
const memCache = new Map()
let CURRENT_CTX = null

function cacheToRequest(key) {
  /* 用内部域名造 key，避免和真实请求撞上（serveMusic 里已经在用这招） */
  return new Request('https://sakura-music-cache.internal/api/' + encodeURIComponent(key))
}

function memCacheGet(key) {
  const hit = memCache.get(key)
  if (!hit) return null
  if (hit.expire < Date.now()) { memCache.delete(key); return null }
  return hit.value
}

function memCacheSet(key, value, ttlSeconds) {
  if (memCache.size > 500) memCache.clear()
  memCache.set(key, { value, expire: Date.now() + ttlSeconds * 1000 })
}

async function cacheGet(key) {
  const l1 = memCacheGet(key)
  if (l1) return l1
  if (typeof caches === 'undefined' || !caches.default) return null
  try {
    const hit = await caches.default.match(cacheToRequest(key))
    if (!hit) return null
    const value = await hit.json()
    /* 回填 L1：同 isolate 的后续请求连这次 await 都省了 */
    if (value) memCacheSet(key, value, 60)
    return value
  } catch (e) {
    return null
  }
}

function cacheSet(key, value, ttlSeconds) {
  memCacheSet(key, value, ttlSeconds)
  if (typeof caches === 'undefined' || !caches.default) return value
  const put = caches.default
    .put(cacheToRequest(key), new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=' + Math.max(1, Math.floor(ttlSeconds)),
      },
    }))
    .catch(function () { /* 写缓存失败不能影响正常响应 */ })
  /* CURRENT_CTX 是模块级变量：同一 isolate 里两个请求交错时（A 还在 await producer，
     B 已经进了 fetch），A 会把 put 挂到 B 的 ctx 上。Workers 下这是未定义行为，
     而且**抛出来的话会顺着 cacheSet -> withCache 冒出去，把正常响应变成 500**。
     所以整个包住：最坏情况只是这次没缓存上，绝不能连累响应。
     （这条不是理论风险：2026-09-23 线上就因为这儿的一个未声明赋值 500 过一回。） */
  try {
    if (CURRENT_CTX && typeof CURRENT_CTX.waitUntil === 'function') CURRENT_CTX.waitUntil(put)
  } catch (e) {
    /* 拿不到可用的 ctx 就算了，memCache 那一层还在 */
  }
  return value
}

async function withCache(key, ttlSeconds, producer, opts) {
  /* ⚠️ **必须 await**。cacheGet 是 async 的，少写一个 await 就会变成
     「hit 是个 Promise，永远为真 -> 直接 return -> producer 根本不执行」，
     而 Promise 解析出来的值在**缓存未命中时是 null** ——
     表现就是「命中缓存的请求正常、未命中的请求 500」，
     而且看代码完全看不出来。2026-09-23 线上就是这么挂的。 */
  const hit = await cacheGet(key)
  if (hit) return hit
  const value = await producer()
  /* opts.keep 用来挡「成功但是空」的结果 —— 见 proxy 里的说明 */
  const keep = !opts || typeof opts.keep !== 'function' || opts.keep(value)
  if (value && value.ok !== false && keep) cacheSet(key, value, ttlSeconds)
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
      /* rv: -1 才会返回 romalrc（罗马音）—— 少了它 roma 永远是空字符串。
   实测对比：lv/kv/tv 只给 lrc+klyric+tlyric；加上 rv 才多出 romalrc。 */
    const res = await weapiPost('/song/lyric', { id: Number(id), lv: -1, kv: -1, tv: -1, rv: -1, csrf_token: '' })
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
  /* 含糊响应（读不到跳转目标的 opaque / 空 body）的兜底候选。
     不立刻返回，先继续试后面的镜像 —— 能拿到真实直链就优先要真实直链。 */
  let ambiguous = null
  for (let i = 0; i < METING_MIRRORS.length; i++) {
    const mirror = METING_MIRRORS[i]
    const qs = new URLSearchParams(params).toString()
    const target = mirror + (mirror.indexOf('?') >= 0 ? '&' : '?') + qs
    try {
      const res = await fetch(target, {
        redirect: 'manual',
        headers: { 'User-Agent': UA, Referer: 'https://zhaokening.ccwu.cc/' },
      })

      /* ⚠️ Cloudflare Workers 上 redirect:'manual' 并不总能拿到 3xx ——
         跨域跳转会变成 **opaque 响应**（status 0、headers 读不到 Location），
         有时甚至表现为 status 200 + 空 body。这正是以前 /api/url 全盘 502、
         报「所有镜像都拿不到播放地址」的真正原因：镜像其实都是好的，
         只是我们读不到那个跳转目标，就把它们一律判死了。

         关键认识：**Meting 镜像的 type=url 地址本身就是一条可以播的地址**。
         它 302 到真实 CDN，客户端（<audio> / ExoPlayer / 下载器）都会自己
         跟随跳转。所以只要拿不到明确的「另一个地址」，就把镜像地址原样交出去，
         而不是报错。 */
      if (res.status === 0 || res.type === 'opaqueredirect') {
        if (!ambiguous) ambiguous = { ok: true, mirror, data: { url: target }, opaque: true }
        continue
      }
      // 302 -> 真实的音频 CDN 地址
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('Location')
        if (loc) return { ok: true, mirror, data: { url: loc } }
        // 有跳转但读不到 Location：先记下，继续试后面的镜像
        if (!ambiguous) ambiguous = { ok: true, mirror, data: { url: target }, opaque: true }
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
        /* 明显是 HTML 错误页 -> 这个镜像确实不能播，换下一个 */
        if (/^<\s*(!doctype|html)/i.test(trimmed)) {
          errors.push(mirror + ': 返回 HTML 错误页')
          continue
        }
        /* 其它情况（空 body / 非地址文本）：大概率是那个读不到 Location 的
           隐形跳转，但也可能是这个源真的没版权（实测 qijieya 的 netease
           就这样时好时坏，而 injahow 同一时刻是好的）。
           所以**只记下来当兜底**，继续试后面的镜像。 */
        if (!ambiguous) ambiguous = { ok: true, mirror, data: { url: target }, opaque: true }
        continue
      }
      return { ok: true, mirror, data: text }
    } catch (e) {
      errors.push(mirror + ': ' + (e && e.message ? e.message : 'error'))
    }
  }
  /* 所有镜像都含糊 -> 交出一条镜像地址让客户端自己跟随跳转（总比 502 强） */
  if (ambiguous) return ambiguous
  return { ok: false, errors }
}

/* ============================================================
   兜底音源（第三方，**只在主链路全挂时才请求**）
   ------------------------------------------------------------
   • 排在 Meting 镜像之后 —— 主链路成功时一次都不会请求到，不拖慢正常路径
   • 都是别人维护的免费服务，随时可能失效/加鉴权，所以任何异常都吞掉，
     绝不影响主路径；失败也**不缓存**，下次还会重试
   • 都**没有 CORS**，所以只能放在这里（App 和网站顺带一起受益）

   2026-09-23 实测：
     ✅ buguyy.top      搜索 + 取链，返回酷我 CDN 直链（206 audio/mpeg，ID3 头）
     ⚠️ ncm.landdy.cn   免费歌给直链，但同一天复测时出现过 522 —— 时好时坏，
                        所以它只能当兜底，绝不能进主链路
   ============================================================ */
const BACKUP_LANDDY = 'https://ncm.landdy.cn/song/url/v1'
const BACKUP_BUGUYY = 'https://buguyy.top/api'

/** 宽松的歌名比对：聚合站会用「同名翻唱」顶替版权受限曲，
    不核对就会「点 A 放 B」——GDStudio 就有这个毛病。 */
function backupNameMatch(a, b) {
  const norm = function (s) {
    return String(s || '').toLowerCase()
      .replace(/[\s()\[\]【】（）\-_·,，.。!！?？'"“”‘’/\\|~]/g, '')
  }
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  return x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0
}

/** 兜底地址统一升 https。
    网站是 https 页面，http 音频会被**混合内容**直接拦掉（表现就是「点了不出声」）。
    只对这两个兜底源这么做：它们的 CDN（m*.music.126.net / car-*.kuwo.cn）
    **实测 https 也能 206 audio/mpeg**。
    ⚠️ 绝不能推广成「所有媒体地址都升 https」—— B站 的 mcdn 那种就只有 http，
    强升会拉不到流（见 README 坑12）。 */
function backupHttps(u) {
  return /^http:\/\//i.test(u) ? 'https://' + u.slice(7) : u
}

/**
 * 主链路失败后的兜底取链。
 * @param {string} server 平台（netease / kuwo / tencent …）
 * @param {string} id     平台歌曲 id
 * @param {string} name   歌名（buguyy 是按关键词搜的，没有名字就用不了）
 * @param {string} artist 歌手
 */
async function backupUrl(server, id, name, artist) {
  const tried = []

  /* ① 网易云：别人的公共增强实例，有 id 就能用 */
  if (server === 'netease' && id) {
    try {
      const r = await fetch(BACKUP_LANDDY + '?id=' + encodeURIComponent(id) + '&level=exhigh', {
        headers: { 'User-Agent': UA },
      })
      if (r.ok) {
        const j = await r.json()
        const u = (j && j.data && j.data[0] && j.data[0].url) || ''
        if (/^https?:\/\//.test(u)) return { ok: true, url: backupHttps(u), mirror: 'ncm.landdy.cn（第三方兜底）' }
        tried.push('ncm.landdy.cn: 该曲没有可用地址')
      } else {
        tried.push('ncm.landdy.cn: HTTP ' + r.status)
      }
    } catch (e) {
      tried.push('ncm.landdy.cn: ' + (e && e.message ? e.message : 'error'))
    }
  }

  /* ② buguyy：返回酷我 CDN 直链，任何平台都能用它兜底（它本来就是个聚合站）。
        ⚠️ 它的搜索**只认单个关键词** —— 实测搜「晴天 周杰伦」返回 0 条，
        搜「晴天」返回 49 条。所以先用歌名搜，搜不到再带上歌手重试。 */
  const tries = []
  if (name) tries.push(name)
  if (name && artist) tries.push(name + ' ' + artist)
  for (let i = 0; i < tries.length; i++) {
    if (i > 0) tried.push('buguyy.top: 「' + tries[0] + '」没搜到，换关键词重试')
    try {
      const s = await fetch(BACKUP_BUGUYY + '/search?keyword=' + encodeURIComponent(tries[i]), {
        headers: { 'User-Agent': UA },
      })
      if (!s.ok) { tried.push('buguyy.top: HTTP ' + s.status); continue }
      const j = await s.json()
      const list = (j && j.data) || []
      /* **必须核对歌名**：聚合站会用「同名翻唱」顶替版权受限曲，
         不核对就会「点 A 放 B」——GDStudio 就有这个毛病。 */
      const hit = list.find(function (x) { return x && x.id && backupNameMatch(x.title, name) })
      if (!hit) { tried.push('buguyy.top: 「' + tries[i] + '」没找到同名曲目（不做翻唱顶替）'); continue }
      const g = await fetch(BACKUP_BUGUYY + '/geturl?id=' + encodeURIComponent(hit.id), {
        headers: { 'User-Agent': UA },
      })
      if (!g.ok) { tried.push('buguyy.top: 取链 HTTP ' + g.status); continue }
      const gj = await g.json()
      const u = (gj && gj.url) || ''
      if (/^https?:\/\//.test(u)) return { ok: true, url: backupHttps(u), mirror: 'buguyy.top（第三方兜底）' }
      tried.push('buguyy.top: 拿到结果但没有可用地址')
    } catch (e) {
      tried.push('buguyy.top: ' + (e && e.message ? e.message : 'error'))
    }
  }

  return { ok: false, errors: tried }
}

const metingApi = {
  /** 取可播放地址 */
  async url(q, origin) {
    const id = (q.get('id') || '').trim()
    if (!id) return fail('缺少 id', 400, origin)
    const server = q.get('server') || 'netease'
    const br = q.get('br') || '320'
    const key = 'url:' + server + ':' + id + ':' + br
    const name = q.get('name') || ''
    const artist = q.get('artist') || ''
    const result = await withCache(key, CACHE_TTL.url, async function () {
      const r = await resolveMeting({ server, type: 'url', id, br })

      /* 拿到**确凿**的地址（302 目标 / 正文是 URL / 直接吐音频）-> 直接用 */
      if (r.ok && !r.opaque) return { ok: true, url: r.data.url, mirror: r.mirror }

      /* 没拿到确凿地址（全部镜像含糊，或者全挂）-> 才轮到第三方兜底。
         它给的是**真实直链**，比「镜像地址本身」这种含糊候选更值得用。
         name 是可选的：不给时只有网易云那条能试（landdy 按 id 取）。 */
      const b = await backupUrl(server, id, name, artist)
      if (b.ok) return { ok: true, url: b.url, mirror: b.mirror, backup: true }

      /* 兜底也没成，退回含糊候选（客户端会自己跟随跳转，总比 502 强）。
         注意这个**不缓存**（见下面的 keep）——否则一个「可能播不了」的结果
         会被钉在缓存里，之后连兜底都不会再试。 */
      if (r.ok) return { ok: true, url: r.data.url, mirror: r.mirror, opaque: true }

      return { ok: false, errors: (r.errors || []).concat(b.errors || []) }
    }, {
      keep: function (v) { return !!(v && v.ok && !v.opaque) },
    })
    if (!result || !result.ok) {
      return fail('所有镜像都拿不到播放地址：' + ((result && result.errors) || []).join(' | '), 502, origin)
    }
    return ok({ url: result.url, mirror: result.mirror, id, server, backup: !!result.backup }, origin)
  },

  /**
   * 兜底源自检。排查用：直接看**网关这个出口 IP** 能不能访问那两个第三方。
   * 为什么需要它：第三方站对某些网段/地区会拒（比如 JOOX 就只对港台开放），
   * 「本机能通」不等于「Worker 能通」——这类判断只能从 Worker 里做。
   */
  async backupCheck(q, origin) {
    const server = q.get('server') || 'netease'
    const r = await backupUrl(server, (q.get('id') || '').trim(), q.get('name') || '', q.get('artist') || '')
    return ok({
      hit: !!r.ok,
      url: (r.url || '').slice(0, 140),
      mirror: r.mirror || '',
      errors: r.errors || [],
    }, origin)
  },

  /** 歌词（网易云优先走 /api/lyric，这里只作为兜底） */  async lyric(q, origin) {
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
    if (!result || !result.ok) return fail('所有镜像都拿不到歌词', 502, origin)
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
    }, {
      /* **空结果不缓存**。网易云被限流/风控时会返回「成功但 0 条」，
         而 `ok:true` 的空壳照样会被缓存 —— 一缓存就是 5 分钟（CACHE_TTL.search），
         期间用户怎么搜都是空的，看着像站坏了。
         今天就踩了这个：一次上游抖动把空结果写进了缓存，后面所有搜索全是 0 条。 */
      keep: function (v) {
        if (!v || !v.ok || !v.text) return false
        try {
          const j = JSON.parse(v.text)
          if (Array.isArray(j)) return j.length > 0
          if (j && typeof j === 'object' && Array.isArray(j.songs)) return j.songs.length > 0
        } catch (e) { /* 解析不了的就照常缓存，交给调用方处理 */ }
        return true
      },
    })
    if (!result || !result.ok) return fail('所有镜像都不可用：' + ((result && result.errors) || []).join(' | '), 502, origin)
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
  '/api/backup-check': metingApi.backupCheck,
  '/api/url/lyric': metingApi.lyric,
  '/api/meting': metingApi.proxy,
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    /* 缓存写入要靠 ctx.waitUntil()，但各个 handler 的签名只有 (params, origin)，
       不想为了这个把 ctx 一路透传下去，所以在这里存一份模块级引用。 */
    CURRENT_CTX = ctx

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // 音频走 Range 代理（曲库源站不支持 Range）
  if (url.pathname.indexOf('/music/') === 0) {
    return serveMusic(request, ctx)
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
