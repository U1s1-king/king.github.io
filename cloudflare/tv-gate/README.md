# tv-gate —— 影视页门卫

挡住 `TV.html` 和 `/api/tv*`，只让持有口令的人进来。

> 口令与内部密钥都走 **Worker Secret**，绝不出现在这个仓库里。

## 它做什么

| 路径 | 行为 |
| --- | --- |
| `/TV.html`（及 `/TV*`） | 没登录 → 返回自带登录页；已登录 → 透传给 GitHub Pages |
| `POST /api/tv/auth` | 校验口令，成功则下发 `HttpOnly` session cookie |
| `/api/tv*` | 验 cookie，通过后加 `X-Gate-Secret` 头转发给 `sakura-music-api.pages.dev` |

**为什么必须两道锁**：只锁页面挡不住 `curl` —— 数据在 `sakura-music-api.pages.dev`，
那不是本站的 zone，挂不了路由；只锁数据则页面骨架公开。两道一起才闭环。

**为什么坚持同源**：cookie 才能是 `HttpOnly`（JS / XSS 都偷不走），而且完全没有 CORS 这一层。

**失败策略**：门卫自己报错时 **不放行**（fail-closed），返回 503。「宁可锁死，也不漏」。

## 环境变量

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `TV_GATE_KEY` | Secret | 用户输入的口令。**换掉它 = 所有已发出的会话立刻失效**，这就是撤回手段 |
| `TV_GATE_SECRET` | Secret | 与 `sakura-music-api` 共享的内部头密钥，必须两边一致 |
| `UPSTREAM` | 可选 | 默认 `https://sakura-music-api.pages.dev` |
| `KING_KV` | KV 绑定 | 失败计数（复用留言板命名空间） |

## 限速

10 分钟窗口内输错 5 次 → 锁 1 小时。计数写在 KV 的 `tv:fail:<ip>`。

> KV 是最终一致的，跨边缘节点计数可能有秒级延迟，对「防脚本穷举」足够了；
> 真要更严可以再叠一条 Cloudflare 原生 Rate Limiting Rule。

## 会话

- session cookie（不写 `Max-Age`）→ **关浏览器即失效**
- 令牌 = `v1.<签发时间>.<HMAC-SHA256>`，签名密钥就是 `TV_GATE_KEY`
- 服务端另有 7 天绝对上限，兜住「浏览器一直不关」和被偷 cookie 的情况

## 部署

```powershell
cd cloudflare/tv-gate
npx wrangler deploy
npx wrangler secret put TV_GATE_KEY      # 输入口令
npx wrangler secret put TV_GATE_SECRET   # 输入随机串，两边要一致
```

然后去 `cloudflare/music-api` 那边，给 Pages 项目也设一个同名同值的
`TV_GATE_SECRET` 并重新部署 —— 数据锁才会真正生效。

## 路由注意

只挂 `/TV*` 和 `/api/tv*`。**绝不能用 `zhaokening.ccwu.cc/*`**：
那样整站静态资源都要过 Worker，免费版 10 万请求/天会烧光，
而且 Worker 一挂整站白屏。

## 和 Service Worker 的关系

`sw.js` 里做了两件事配合这道门：

1. 把 `/TV.html` 从预缓存清单里摘掉 —— 预缓存的 `addAll()` 只要碰到一个非 200
   （门卫 fail-closed 时就是 503）就会让**整个 Service Worker 安装失败**，把全站离线缓存拖下水。
2. 同源 `/api/*` 一律只走网络 —— 否则接口响应会落进「stale-while-revalidate」
   分支被缓存，等于本地绕过门卫。
