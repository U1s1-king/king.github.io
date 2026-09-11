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
  'https://king.github.io',
  'http://localhost:8888',
  'http://127.0.0.1:8888',
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
async function weapiPost(path, payload) {
  const body = await weapiBody(payload)
  const res = await fetch('https://music.163.com/weapi' + path + '?csrf_token=', {
    method: 'POST',
    headers: neteaseHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' }),
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
  const allow = !origin || SITE_ORIGINS.indexOf(origin) >= 0 ? (origin || '*') : '*'
  return {
    'Access-Control-Allow-Origin': allow === '*' ? '*' : origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
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

// ============================================================ 各接口

const api = {
  /** 搜索 */
  async search(q, origin) {
    const keywords = (q.get('keywords') || q.get('s') || '').trim()
    if (!keywords) return fail('缺少 keywords', 400, origin)
    const limit = Math.min(parseInt(q.get('limit') || '30', 10) || 30, 100)
    const offset = Math.max(parseInt(q.get('offset') || '0', 10) || 0, 0)
    const type = parseInt(q.get('type') || '1', 10) || 1
    const key = 'search:' + type + ':' + limit + ':' + offset + ':' + keywords
    const body = await withCache(key, CACHE_TTL.search, async function () {
      /* 风控是概率性的，重试 3 次基本都能过；仍失败则抛错，绝不把假空结果写进缓存 */
      return await withRetry(async function () {
        const res = await weapiPost('/search/get', { s: keywords, type, limit, offset, csrf_token: '' })
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
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    const handler = ROUTES[url.pathname] || ROUTES[url.pathname.replace(/\/$/, '')]
    if (!handler) {
      // 非 API 路径交给静态资源（index.html 落地页）
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
