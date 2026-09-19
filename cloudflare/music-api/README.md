# 自建网易云音乐 API（Cloudflare Pages Functions）

部署地址：**https://sakura-music-api.pages.dev**

这是一个跑在 Cloudflare Pages Functions 上的网易云音乐接口服务，作为音乐页的「元数据大脑」，
配合前端统一网关 `js/music-api.js` 使用。

## 为什么需要它

原来的音乐页完全依赖第三方 Meting 镜像，问题有三个：

1. **单点依赖**：镜像一挂（例如 `musicapi.qijieya.cn` 已实测 521）整个第三方搜索就废了；
2. **没有 id**：Meting 搜出来的歌没有网易云 id，导致无法取歌词、无法精确去重、换源困难；
3. **封面质量差**：搜索结果普遍没有封面。

自建网关直接对接网易云 WEAPI，解决以上三点。

## 技术要点

- **纯 WebCrypto 实现 WEAPI 加密**，不依赖 `nodejs_compat`，不需要任何 Node 内置模块：
  - AES-128-CBC（WebCrypto）
  - RSA 用 BigInt 做**裸模幂运算**（网易要的是 `int(hex(secretKeyReversed)) ** e mod n`，
    补零到 256 位十六进制，**不能**用 PKCS#1 填充 —— 用 WebCrypto 的 RSAES-PKCS1-v1_5 会拿到空响应）
  - 不需要 AES-ECB，不需要 MD5
- **播放地址**：网易云新版播放地址接口需要 `xeapi` 方案
  （X25519 密钥交换 + AES-GCM + HMAC-SHA256 + 服务端下发 `publicKeyState` + 匿名 token 注册），
  移植成本过高。因此本服务**只负责元数据**，可播放 URL 由 `/api/url` 聚合 Meting 多镜像解决。
- **失败不缓存**：网易云会对可疑请求返回风控响应（`code: 50000005`，没有 `result`）。
  早期版本会把这种「假空结果」写进缓存，导致某首歌 5 分钟内一直搜不到。
  现在 `assertUpstream()` 会直接抛错，`withCache()` 不写缓存，并且搜索带 3 次重试。

## 接口一览

| 路径 | 说明 |
| --- | --- |
| `/api/health` | 健康检查 + 可用镜像列表 |
| `/api/search` | 搜索（`keywords` `limit` `offset` `type`），自动补全封面/专辑 |
| `/api/song/detail` | 歌曲详情（`ids` 逗号分隔） |
| `/api/lyric` | 歌词（`id`） |
| `/api/playlist` | 歌单详情 |
| `/api/playlist/tracks` | 歌单全部歌曲 |
| `/api/toplist` | 排行榜列表 |
| `/api/recommend/playlist` | 推荐歌单 |
| `/api/recommend/newsong` | 推荐新歌 |
| `/api/catalogue` | 歌单分类 |
| `/api/artist` | 歌手信息 |
| `/api/artist/songs` | 歌手热门歌曲 |
| `/api/url` | **可播放地址**（多 Meting 镜像轮询，返回真实 CDN 直链，不代理音频流） |
| `/api/url/lyric` | 备用歌词源 |
| `/api/meting` | Meting 通用代理 |
| `/api/tv` | 影视片单/详情/搜索（`ac` `t` `pg` `wd` `ids`），代理公开苹果 CMS 采集接口 |
| `/api/tv/img` | 影视海报代理（海报图床普遍有热链保护，浏览器直连会 418） |
| `/api/tv/stream` | m3u8/分片代理**兜底**（返回的播放列表里地址会重写回本代理） |

未匹配的路径会回退到 `env.ASSETS.fetch`（静态资源）。

## 影视代理（`/api/tv*`）

`TV.html` 直连 `cj.lziapi.com` 这类公开采集接口时会失败：实测 12 个接口
**只要请求带 `Origin` 就不回 `Access-Control-Allow-Origin`**（不带反而给 `*`），
浏览器被 CORS 一拦就是空页面。所以片单/详情/搜索由 Worker 转发（服务端请求不带 Origin，
上游照常返回数据），再按本站白名单回 CORS；上游依次尝试、命中后记住该源，
单次请求 8 秒超时，避免某个源挂了把整页卡住。

视频流**默认不走代理**：实测视频 CDN 对带 Origin 的请求照样回 `Access-Control-Allow-Origin: *`，
master / variant / TS 分片全部 200，浏览器直连即可；同时也避开了「CDN 按客户端指纹判掉非浏览器
请求」的坑——Cloudflare 与 Node 侧实测都会拿到上游 404，因此 `/api/tv/stream` 只作为
直连失败后的兜底重试（对这类会判指纹的 CDN 兜底可能仍失败，此时换线路即可）。

## 影视接口门禁（/api/tv*）

从 2026-09-17 起 `/api/tv*` **不再允许浏览器直连**。所有影视请求必须经由
`zhaokening.ccwu.cc` 上的独立门卫 Worker（`cloudflare/tv-gate`）转发，
门卫会带上内部头 `X-Gate-Secret`；这个 Worker 只认该头，其余一律 403。

因此这个 Pages 项目**必须**配置环境变量：

| 变量 | 类型 | 说明 |
| --- | --- | --- |
| `TV_GATE_SECRET` | Secret | 与 `cloudflare/tv-gate` 的 `TV_GATE_SECRET` 完全一致 |

**缺少它会让 `/api/tv*` 直接返回 503（fail-closed），影视页会打不开。**
注意 Pages 的环境变量改完必须重新部署才生效。

音乐那一整套接口（`/api/search`、`/api/url`…）完全不受影响。

## 部署

部署方式与账号凭据见项目私有凭据文档（不入库）。

> ⚠️ **不要**往 `sakura-music` 项目部署 —— 那个项目托管着全部 MP3，
> 本地仓库已 `.gitignore` 掉 `music/`，直接上传式部署会把唯一的音频副本覆盖掉。
