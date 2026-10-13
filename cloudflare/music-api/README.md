# 自建网易云音乐 API（Cloudflare Worker）

调用地址：**https://zhaokening.ccwu.cc**（`/api/*` 元数据、`/music/*` 音频）

| | |
| --- | --- |
| Worker 名 | `music-api` |
| 路由 | `zhaokening.ccwu.cc/api/*`、`zhaokening.ccwu.cc/music/*`（含 www） |
| 部署 | `wrangler deploy`（配置见同目录 `wrangler.toml`） |
| 旧地址 | ~~https://sakura-music-api.pages.dev~~（Pages 项目已删除） |
| **备用入口** | **https://sakura-music-gw.pages.dev**（Pages 项目 `sakura-music-gw`，Advanced Mode） |

**为什么又开了一个 Pages 入口**（2026-09-29）：实测确认封锁匹配的是 `ccwu.cc`
这个**字符串** —— 换 IP 无效（强制走 162.159.140.1 香港节点同样被 RST）、换 zone 也无效。
所以 `zhaokening.ccwu.cc` 一被锁，音乐搜索 / 歌词 / 曲库音频 / 影视数据会**同时**死。
App 侧现在有「网关候选池」，主入口不可用时自动切到这个 Pages 入口
（真机日志：`[link] 网关入口=https://sakura-music-gw.pages.dev`）。

> ⚠️ **备用入口也不能用 `*.workers.dev`。** 2026-09-29 真机实测：整个
> `*.workers.dev` 在大陆移动网络下不可达 —— 连一个**已知存活**的 worker
> 都 15s 超时。而 `*.pages.dev` 可达（实测 `/api/health` 200、
> `/music/*` **206 且 Range 生效**、`/api/meting` 200、`/api/url` 200）。
> `/api/search` 在该入口上是 502 —— CF 机房 IP 触发网易云风控，这条不该走网关。

```powershell
# 备用入口的部署（同一个 _worker.js，不复制代码）
wrangler pages project create sakura-music-gw --production-branch=main   # 仅首次
wrangler pages deploy 'D:\za\GitHub\king.github.io\cloudflare\music-api' `
  --project-name=sakura-music-gw --branch=main --commit-dirty=true
```

> ⚠️ **绝不要部署到 `sakura-music` 项目** —— 那个托管着全部 MP3 副本。

**为什么从 Pages 搬到 Worker**（2026-09-24）：`*.pages.dev` 在国内时通时不通 ——
本项目姊妹仓库 `sakura-music-app/FINDINGS.md` 实测该域名 ping **50% 丢包**，用户反馈
「必须开代理才看得到」；TV 走同一域名时中位 **2102ms**、并出现过一次 **92s 超时**，
换自定义域名后降到 **212ms**。音乐这条链路当时没有一起改，于是它成了唯一还在
依赖 pages.dev 的入口。

代码本身没改：这个 Worker 的加密全部用 WebCrypto + BigInt 实现，文件头写明
「不需要 `nodejs_compat`」，也没有任何 `require` / `process` / `Buffer` / `node:` 依赖，
所以同一个 `_worker.js` 既能当 Pages Function 也能当普通 Worker 跑。
唯一沾 Pages 的是 `env.ASSETS`，那是可选兜底，Worker 里为 `undefined` 会自然跳过。

> ⚠️ **`/api/*` 与 tv-gate 的 `/api/tv*` 路由重叠**，靠 Cloudflare「更具体路由优先」区分。
> 每次改动 `wrangler.toml` 后必须回归验证：
> `curl -i https://zhaokening.ccwu.cc/api/tv?ac=list` 期望 **401 + application/json**。
> 若变成 403/404，说明 `/api/*` 把影视路由抢走了，立即回滚。

这是一个跑在 Cloudflare 上的网易云音乐接口服务，作为音乐页的「元数据大脑」，
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

未匹配的路径会回退到 `env.ASSETS.fetch`（静态资源）。影视接口**不在这里**，见下一节。

## 影视接口不在本 Worker 内

`/api/tv`、`/api/tv/img`、`/api/tv/stream` **不属于本 Worker**。本节原先描述的是影视
代码还留在这里时的行为。`c6edf81`（2026-09-25，「清理 music-api 里的影视死代码」）把
756 行影视代码整段删掉、`_worker.js` 从 1898 行降到 1095 行，**但当时没有同步改这份
README**，于是留下了一段指向已不存在的东西的文档。实测确认：

- `_worker.js` 的 `ROUTES`（约 1204-1223 行）共 16 条，**没有任何 `/api/tv*`**；
  在本目录全量 grep `api/tv|Gate-Secret|TV_GATE_SECRET|tv-gate` 命中数为 **0**。
- 未知路径落到 `env.ASSETS.fetch`，而部署成 Worker 时 `env.ASSETS` 是 undefined，
  于是返回 **404 JSON**（不是 403，也不是 503）。
- 线上 `GET https://zhaokening.ccwu.cc/api/tv?ac=list` → **401
  `{"ok":false,"error":"需要影视口令","needGate":true}`**，正是门卫 tv-gate 的响应体；
  同时 `GET /api/health` → 200 `{"ok":true,"service":"sakura-music-api",...}`，
  说明本 Worker 活着、只是不碰影视。

实际链路：

    浏览器 / TV.html
      → zhaokening.ccwu.cc/api/tv*      （Cloudflare 按「更具体的路由优先」交给 tv-gate）
      → SakuraTV-app/cloudflare/tv-gate （校验会话 cookie，转发时带上内部头 X-Gate-Secret）
      → SakuraTV-app/cloudflare/tv-api  （Service Binding TV_API；真正的数据层）

三个 Worker 都在姊妹仓库 `SakuraTV-app`。前端 `js/tv.js` 在生产域用**同源**
`location.origin` 作网关、请求带 `credentials: 'same-origin'`（浏览器不带、也不该带
`X-Gate-Secret`）；只有走备用入口 `sakura-tv-api.pages.dev/tv-api` 时才改用
`X-App-Token` / `?_t=`。

几点原先写错、值得单独记下的：

- 说「`/api/tv*` 不再允许浏览器直连」不准确 —— 浏览器**确实**直连同源 `/api/tv*`，
  只是必须先过 tv-gate 的会话。准确说法是「不再允许**未经门卫**的直连」。
- 说「这个 Worker 只认 `X-Gate-Secret`，其余一律 403」有两处错：本 Worker 根本不校验
  任何东西（收到只会 404 JSON）；真正校验的 tv-api **两把钥匙都认**（`X-Gate-Secret`
  或 `X-App-Token`/`?_t=` 任一匹配即放行）。
- 说「这个 Pages 项目必须配置 `TV_GATE_SECRET`」是**反的**：本 Worker 故意不配
  （见 `wrangler.toml` 末尾）。该 secret 属于 **tv-api**，且必须与 tv-gate 里那份
  完全一致。tv-api 在 `TV_APP_TOKEN` 与 `TV_GATE_SECRET` **两者都缺**时才 503，
  只缺/错 gate secret 是 **403**。
- 「Pages 的环境变量改完要重新部署」属旧架构说法：本 Worker 现在是 `wrangler deploy`，
  secret 走 `wrangler secret put`。

### 唯一仍需注意的：路由重叠

tv-gate 占 `/api/tv*`，本 Worker 占 `/api/*`，Cloudflare 按「更具体的路由优先」匹配，
所以 `/api/tv*` 仍归 tv-gate。**改动任一 `wrangler.toml` 之后都要回归一次**：

    curl -i https://zhaokening.ccwu.cc/api/tv?ac=list
    # 期望 401 + application/json

音乐那一整套接口（`/api/search`、`/api/url`…）完全不受影响。

## 部署

部署方式与账号凭据见项目私有凭据文档（不入库）。

> ⚠️ **不要**往 `sakura-music` 项目部署 —— 那个项目托管着全部 MP3，
> 本地仓库已 `.gitignore` 掉 `music/`，直接上传式部署会把唯一的音频副本覆盖掉。
