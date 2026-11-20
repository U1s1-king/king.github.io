# king.github.io · 模块化拆分开发规范

> 提取自 `D:\za\GitHub\king.github.io` 现有代码（纯静态站，无构建步骤）。
> 用途：指导后续模块化拆分，保证拆分后视觉、状态、组件契约与原站一致。
> 本文只做规范提取，不涉及任何代码改动。

---

## 一、UI 风格与视觉规范 (UI Guidelines)

### 1.1 技术栈事实

- **没有 Tailwind**。全站零构建，样式是手写 CSS + Font Awesome 子集。
- 不存在 `tsconfig.json` / `.d.ts` / `*.ts`，纯 ES5 风格 IIFE 脚本。
- 样式入口按页拆：`css/style.css`（基础）、`css/home-app.css`、`css/Tools.css`、`css/music.css`、`css/tv.css`…
  移动端覆盖单独成文件：`css/mobile.css`、`css/music-mobile.css`。
- `css/all.min.css`(82KB) 是 Font Awesome 主体，**不要改**；每页另有 `fa.<Page>.subset.css` 做子集裁剪。

### 1.2 主题色（樱花粉）

| 用途 | 色值 | 说明 |
|---|---|---|
| 主粉（强调） | `#e982a2` | 图标、链接 hover、`--an-pink` |
| 深粉（标题文字） | `#b1627d` | `--an-deep` |
| 主粉渐变起 | `#f0a0ba` / `#f4a9c1` | `linear-gradient(145deg, …)` |
| 主粉渐变止 | `#e06a8f` | 按钮、激活态 |
| 卡片浅粉底 | `#fff6f9` / `#fff5f8` | 列表、表单块 |
| 页面底 | `#fff9f7` | `html.shell` iframe 背景 |
| 描边粉 | `#ffd6e0` / `#ffe2ec` / `#ffdbe3` | 边框、分割线 |
| 正文 | `#7d5462` / `#6b4453` | 深棕粉，不是纯黑 |
| 次要字 | `#b5768c` / `#b98ba0` | 描述、时间 |
| 弱提示 | `#c88fa4` / `#d3a7b7` | 占位、箭头 |

**规则**：所有文字都用带粉调的褐色系，禁止 `#000` / `#333` 灰。

### 1.3 CSS 变量（`css/anim.css` 的 `:root`）

```css
--d-1:.12s; --d-2:.2s; --d-3:.32s; --d-4:.5s; --d-5:.85s;   /* 时长阶梯 */
--e-out:cubic-bezier(.22,.61,.36,1);    /* 出场，默认缓动 */
--e-inout:cubic-bezier(.4,0,.2,1);
--e-in:cubic-bezier(.4,0,1,1);
--e-spring:cubic-bezier(.34,1.56,.64,1); /* 弹一下 */
--an-ease:var(--e-out);
--an-pink:#e982a2; --an-deep:#b1627d;
--an-soft:rgba(224,106,143,.20);        /* 卡片阴影色 */
```

布局相关（`html.has-appbar` / `html.shell`）：
`--appbar-h:48px`、`--mini-h:56px`、`--tab-h`、`--sat`(安全区上)、`--sab`(安全区下)、
`--z-appbar:9990`、`--z-mini-player:9980`、`--z-detail:9999`。

### 1.4 圆角 / 边框 / 阴影

| 元素 | 圆角 | 边框 | 阴影 |
|---|---|---|---|
| 卡片 / 列表项 | `12–16px` | `1px solid #ffe2ec` | 无（靠边框分层） |
| 胶囊 chip / 状态标 | `999px` 或 `19px` | `1px solid #ffd0de` | 无 |
| 按钮（主） | `12–14px` | 无 | `0 4px 12px rgba(224,106,143,.28)` |
| 圆形图标按钮 | `50%` | 无 | `0 2px 10px rgba(214,122,156,.2)` |
| 底部抽屉 / Sheet | `22px 22px 0 0` | 顶部 `1px solid #ffd6e0` | `0 -12px 32px rgba(180,100,130,.25)` |
| 悬浮条（续播） | `999px` | `1px solid #ffd6e0` | `0 6px 20px rgba(200,120,150,.22)` |

**阴影一律用粉色系 rgba，不用黑色。**

### 1.5 关键组件类名（复用清单）

- 导航/框架：`.app-bar` `.app-bar-home` `.app-bar-title` `.app-bar-share` `.bar-hidden` `.detail-mode`
- 二级页：`.detail-view` `.in` `.iv-wrap` `.iv-bar` `.iv-btn` `.detail-head` `.detail-head-close`
- 分段切换：`.page-tabs` `.page-tab` `.active`、`.ns-subtabs` `.ns-subtab`
- 卡片：`.post-card` `.pc-foot` `.pc-teaser` `.pc-more`、`.work-card` `.card-cover` `.card-title`
- 列表行：`.arc-row` `.arc-row-thumb` `.arc-row-tx` `.arc-row-go`、`.mgrid-item` `.mg-arrow`
- 弹层：`.mp-mask` `.mp-sheet` `.mp-row` `.mp-list` `.mp-item` `.mp-empty`
- 播放器：`.fs-wrap` `.fs-lyrics` `.lyr-line` `.lyr-line.active` `.progress-area` `.ctrl-btn.play-main`
- 动画工具类（`anim.css`）：`.an-lift` `.an-fade` `.an-underline` `.an-title-in` `.an-nav-in` `.reveal-in`

### 1.6 移动端/桌面端断点

- 唯一断点：`@media (max-width:768px)` 为移动端，`min-width:769px` 为桌面端。
- 移动端由 `html.has-appbar` / `html.is-app` / `html.shell` 三个根类开关控制，
  桌面端二级页默认被 `AppShell.openDetail` 拒绝创建（需显式 `allowDesktop:true`）。
- 触摸目标最小 `44×44px`（`.iv-btn`、`.ctrl-btn`、`.mp-item-btn` 均如此）。

### 1.7 字型

- 正文：系统栈（`PingFang SC` / `Microsoft YaHei` 一类）。
- 标题：`'Noto Serif SC', serif`（`.app-bar-title`、`.pc-detail-title`）。
- 图标全部 Font Awesome 6（`font-family:'Font Awesome 6 Free'`）。

---

## 二、数据结构与状态契约 (Data & State Contracts)

### 2.1 前提说明

> **本仓库没有 TypeScript，也没有 Zustand / Pinia / Vuex。**
> 状态全部是「IIFE 内闭包私有变量 + `window.XXX` 单例对象」形式，
> 持久化统一走 `localStorage`。以下是从实际代码反推出的**事实契约**，
> 拆分时若引入 TS，应以此为准写成 `interface`。

### 2.2 持久化存储契约（`js/tv-store.js`）

**模块**：`window.TVStore`（零依赖，不引用 TVPlayer / AppShell）

| 键 | 类型 | 上限 | 数据结构 |
|---|---|---|---|
| `tv.progress.v1` | `Record<string, Progress>` | 300 条 | 见下 |
| `tv.fav.v1` | `Fav[]` | 200 条 | 见下 |
| `tv.url.v1` | `Record<string, {u:string, at:number}>` | 120 条 | 直链记忆 |

```ts
interface Progress {
  t: number;        // 秒：观看进度
  d: number;        // 秒：总时长
  at: number;       // 时间戳：最近观看
  name: string;     // 片名
  pic: string;      // 海报 URL（只存字符串，不存图片）
  remark: string;   // 更新备注，如「更新至 12 集」
  src: number | ''; // 源编号
  ep: string;       // 集数名
  id?: string;      // vod_id（早期记录可能缺失，按 name 兜底）
}

interface Fav {
  key: string;      // `${src}|${vod_id}`，唯一键
  id: string;
  name: string;
  pic: string;
  remark: string;
  src: number | '';
  at: number;
}
```

**键规则（跨源不串台的关键）**：
- `vodKey(it)` = `` `${srcOf(it)}|${it.vod_id}` ``
- `epKey(it, epName)` = `` `${srcOf(it)}|${it.vod_id}|${epName}` ``
- `srcOf(it)` 必须兼容三种形态：`it._src`（列表条目，网关 `tvAggregate` 注入）→ `it.src`（追剧回读）→ `''`。
  **详情接口返回的条目没有 `_src`**，调用方须先用 `srcOf()` 把信封上的 `_src` 补到条目上。

**Action 方法（完整对外 API）**：

```ts
TVStore.saveProgress(it, epName, t, d): void
TVStore.getProgress(it, epName): Progress | null
TVStore.getVodProgress(it): Progress | null      // 同一部片取最近一集
TVStore.clearProgress(it, epName): void
TVStore.clearAllProgress(): void                 // 不动追剧列表
TVStore.recent(limit?: number): Progress[]       // 默认 12，按 vodKey 去重
TVStore.favList(): Fav[]
TVStore.isFav(it): boolean
TVStore.toggleFav(it): boolean                   // true=已收藏 false=已取消
TVStore.removeFav(key): void
TVStore.saveUrl(it, epName, url): void
TVStore.getUrl(it, epName): string
TVStore._keys: { epKey, vodKey, srcOf }          // 键规则注入点，供调试/换格式
```

**容错约定**：读坏数据一律 `try/catch` 回退默认值；`QuotaExceededError` 时先把进度砍半再重试一次，
追剧列表优先级高于进度（进度是最不值钱的数据）。

### 2.3 其他 localStorage 键

| 键 | 归属 | 含义 |
|---|---|---|
| `sakuraVol` | 播放器 | 音量 |
| `sakuraUserPlaylist` | 音乐 | 自建歌单 |
| `sakuraFavs` | 音乐 | 收藏歌曲 |
| `sakuraNsView` / `sakuraPlView` | 音乐 | 上次视图（搜索/歌单） |
| `customBg` | 全局外观 | 自定义背景 |

### 2.4 全局单例清单（拆分时就是模块边界候选）

| 全局对象 | 文件 | 职责 |
|---|---|---|
| `AppShell` | `app-shell.js` | 应用外壳：二级页栈、顶栏、模式切换 |
| `TVStore` | `tv-store.js` | 影视本地数据层（见上） |
| `TVPlayer` | `tv-player.js` | 播放器内核 |
| `SVGIcon` | `svg-icon.js` | 线性 SVG 图标库 |
| `MusicAppSearch` / `MusicPages` / `MusicPlus` | `music-*.js` | 音乐子模块 |
| `LyricHelper` / `loadLyrics` | `music-*.js` | 歌词解析与加载 |
| `UnlockCore` | `tools-*.js` | 工具解锁逻辑 |
| `GuestbookAppInit` | `guestbook-app.js` | 留言板 |
| `waifuSing` / `waifuSingInfo` / `waifuSingNow` | `live2d-sing.js` | Live2D 点歌联动 |
| `sharePage` / `showMsg` / `showFloatingTip` / `escapeHtml` | `common.js` | 通用工具 |
| `fetchCachedJSON` | `common.js` | 带缓存的 JSON 拉取 |

### 2.5 外部数据

- `data/playlist.json` — 音乐页歌单种子数据。
- `manifest.json` / `sw.js` — PWA 安装与离线缓存。
- 音乐源接口封装在 `music-api.js`（47KB），TV 聚合网关在 `cloudflare/` 目录的 Worker 里。

---

## 三、跨页面/组件联动接口 (Interactions & Events)

### 3.1 `AppShell` —— 二级页与顶栏（最重要的跨页契约）

```ts
AppShell.el                     // 当前容器节点
AppShell.isApp: boolean         // 是否 PWA 独立窗口
AppShell.isNarrow(): boolean    // 是否窄屏
AppShell.openDetail(opts): void
AppShell.closeDetail(): void
AppShell.detailOpen(): boolean
AppShell.detailDepth(): number
AppShell.adopt(el, opts)        // 把已有 DOM 接管为二级页
AppShell.releaseAdopted()
AppShell.setTitle(t: string): void
AppShell.setBarDetail(on: boolean, title: string): void
AppShell.onMode(cb: (isApp: boolean) => void): () => void   // 返回取消订阅
```

**约束**：`openDetail` 在桌面端默认拒绝创建；确实需要时传 `{ allowDesktop: true }`。
拆分后任何新模块开二级页都必须走它，不要自己 `appendChild`。

### 3.2 `TVPlayer` —— 播放器对外接口

```ts
init(opts); play(url, title, epName); stop(); classify(url)
toast(msg); showErr(msg)
setTitle(t); setEpisode(t); setNav(prev, next); setQualities(list)
seekBy(sec)
setRate(r); getRate(): number          // 必须成对用，直接改 video.playbackRate 会与内部 S.rate 失步
enterLandscape(); toggleFull(); isFull(): boolean
getVideo(): HTMLVideoElement
```

### 3.3 URL / Hash / 查询参数

| 形式 | 用途 | 出现位置 |
|---|---|---|
| `location.hash === '#guestbook'` | Journal 页切到留言板视图 | `journal-app.js` |
| `location.hash` 前缀匹配 detail id | 二级页深链（`HASH + id`） | `app-shell.js` |
| `location.hash === '#guestbook'` | 留言板独立视图切换 | `tools-app.js` / `tools-hub.js` |
| `location.search + '&' + location.hash` 拼成 `signal` | 监听地址变化统一刷新 | `shell.js` |
| 查询参数 `_t` | 时间戳缓存击穿，只作用于 `fetchCachedJSON` | `common.js` |

### 3.4 跨 iframe 通信（`postMessage`）

`html.shell` 模式下面板用 iframe 加载（`#page-frame` / `#player-frame`），消息 `type` 约定：

| type | 载荷 | 方向 |
|---|---|---|
| `lrc` | 歌词文本/对象 | 播放器 ↔ 外壳 |
| `url` | 当前音频地址 | 播放器 → 外壳 |
| `circle` | 唱片旋转状态 | 播放器 → 外壳 |
| `oneByOne` | 单曲循环/播完切下一首 | 播放器 → 外壳 |

**约束**：拆分时这些 type 字符串是协议，不能改名；新增类型需两侧同步。

### 3.5 事件回调惯例

- 全站**不用 `CustomEvent` / 事件总线**，跨模块靠：
  1. 直接调用全局单例方法（`AppShell.openDetail(...)`）；
  2. `AppShell.onMode(cb)` 这种「注册回调 + 返回取消函数」的订阅；
  3. `postMessage` 跨 iframe。
- 拆分后若要引入事件总线，需在此文档补一节协议，且不能破坏上面三条既有通道。

### 3.6 模块间禁止事项（沿用现有约定）

- `tv-store.js` 不依赖 `TVPlayer` / `AppShell`（保持零依赖，可单独替换）。
- `app-shell.js` 不管业务数据，只管壳与栈。
- 各页 `*-app.js` 是页面装配层，**只装配、不实现存储**；数据读写一律下沉到 `*-store.js`。
- `common.js` 只放纯函数与轻工具，不引业务状态。
- 所有图标走 `SVGIcon` 或 Font Awesome 子集，不允许内联 emoji 当图标。

---

## 附：拆分建议顺序（按依赖倒序，风险低→高）

1. `common.js` / `svg-icon.js` / `anim.css` —— 纯工具，无依赖，先拆。
2. `tv-store.js` —— 已零依赖，直接平移到独立模块。
3. `app-shell.js` —— 依赖仅 DOM，拆出后其余页面才有稳定宿主。
4. `tv-player.js` —— 依赖 shell 的容器约定。
5. 各页 `*-app.js`（home / music / tv / tools / journal / archives / guestbook）。
6. `live2d-*`、`particles-config.js` —— 装饰层，最后接入。

---

**输出位置**：`D:\za\GitHub\king.github.io\MODULE-SPLIT-GUIDELINES.md`
