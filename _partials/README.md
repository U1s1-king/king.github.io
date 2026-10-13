# _partials —— 页面里重复结构的唯一来源

这个目录**不是站点内容，但它是公开可读的**。仓库根目录原先没有 `.nojekyll`，
GitHub Pages 会跑 Jekyll、而 Jekyll 忽略 `_` 开头的目录 —— 但那个前提已经不成立：
`.nojekyll` 补上之后 `_` 前缀路径会被原样发布（实测 `/_partials/sidebar.html`
返回 200）。补 `.nojekyll` 是为了救 `games/` 下的 `_site-skin.css`、`_back.js`、
`_lib/*`（41 个游戏页因此全丢样式与返回入口），代价就是这里跟着公开。

所以这里只放**没有秘密的结构片段**：两个 `.html` 模板加这份说明，内容与各页面里
生成出来的那块完全一样，公开可读不构成影响。**密钥、内部路径、未上线内容一律
不要放在这个目录**。

## 同样的规矩适用于 tools/、scripts/、cloudflare/、server.js

上面那条规矩原先只写给了本目录，但它要管得宽得多。实测（2026-10-13）下列路径在
`zhaokening.ccwu.cc` 上**都可以直接下载**：

    /tools/check-worker.js        /tools/test-netease.js
    /tools/SOURCES-TRIED.md       /scripts/gh_sync.py
    /scripts/pages_deploy.ps1     /scripts/bump_version.py
    /server.js                    /cloudflare/music-api/_worker.js
    /README.md                    /data/playlist.json

原因是 `zhaokening.ccwu.cc` 是本仓库的 **GitHub Pages 自定义域名**（见根目录
`CNAME`），而 `.nojekyll` 关掉了 Jekyll → **整个仓库原样发布，没有任何 exclude
机制可用**。好消息是 `.git/`、`.github/workflows/`、`__pycache__/*.pyc` 是 404；
但 `.gitignore` 对已入库文件不起任何发布层面的作用（它自己都能被下载）。

Cloudflare Pages 镜像 `sakura-blog-8dv.pages.dev` 是例外：它靠
`pages-deploy.yml` / `pages_deploy.ps1` 用**白名单**暂存目录推上去，所以那边
`/tools/*`、`/server.js`、`/screenshots/*` 都是 404。

**真正要当心的是假安全感**：那两份部署脚本里都写着「绝不整仓库推…cloudflare/、
scripts/、tools/ 都不该进静态托管」，但那只保护了镜像站 —— 主站是整仓发布的。
所以任何**将来**写进 `tools/*.js` 或 `scripts/*.py` 的 token、账号口令、私有地址，
都会在 push 的瞬间变成 `zhaokening.ccwu.cc/tools/xxx.js` 上的公开文本；而且正因为
大家都以为这些目录不会被发布，这类提交不会在 review 时被拦住。

放进去之前先问一句：这段东西能不能直接贴到公网上？

（已知的一个例外是 `js/tv.js` 里的 `TV_APP_TOKEN`：它**有意**随站点 JS 发出，
注释里写明了「隔离靠的是两端密钥不通用」。那属于设计取舍，不是这里的疏漏。）

## 为什么存在

侧边栏（`.site-sidebar`）和底部导航（`.bot-tab`）的 HTML 结构
原先在 7 个页面里各写一份，改一处导航要改 7 个文件。实际已经漂移过一次：
`music.html` 的侧边栏图片漏了 `loading="lazy"`，其余 6 页都有。

现在结构与链接的唯一来源是本目录的两个模板 + `scripts/sync_nav.py` 里的
`NAV` 数据。

## 怎么改

1. 改导航项（增删 / 改名 / 换图标）→ 改 `scripts/sync_nav.py` 顶部的 `NAV`
2. 改结构（外层 div / class / 装饰图）→ 改本目录的 `.html` 模板
3. 然后执行 `python scripts/sync_nav.py`

脚本会用 `<!-- nav:sidebar:start -->` / `<!-- nav:bot-tab:start -->`
标记定位并整块替换，可重复执行。**不要直接编辑页面里那两块**，下次同步会被覆盖。

只检查是否已同步（不同步则退出码 1）：

    python scripts/sync_nav.py --check

## 占位符

| 占位符 | 含义 |
| --- | --- |
| `{{NAV}}` | 导航链接列表，由脚本按 `NAV` 数据展开 |
| `{{PREFIX}}` | 链接前缀。普通页面为空；`404.html` 为 `/`——它会在任意深度的路径下被命中，必须用根绝对路径 |

## 注意

- 「当前页高亮」由脚本按 `PAGES` 里的 `active` 决定；`404.html` 没有当前页，故为 `None`。
- 底部导航不做静态高亮，`js/common.js` 会在运行时按 `location.pathname` 处理。
- 改链接后记得跑一次；CI 里已经有这一步（`.github/workflows/repo-check.yml`
  的「导航结构与 _partials/ 是否同步」），忘了跑会在流水线上失败而不是悄悄漂移。
