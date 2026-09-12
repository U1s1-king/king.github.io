# _partials —— 页面里重复结构的唯一来源

这个目录**不是站点内容**，不会被访问。仓库没有 `.nojekyll`，
GitHub Pages 会跑 Jekyll，而 Jekyll 会忽略 `_` 开头的目录，
所以这里天然是私有的。

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
- 改链接后记得跑一次；若想让它自动兜底，可在 CI 里加一步 `python scripts/sync_nav.py --check`。
