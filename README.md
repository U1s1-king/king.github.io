# king.github.io — 樱花物语 · 个人博客 🌸

> 樱花粉风格的纯静态个人博客：日记、归档、音乐、工具箱、留言板与 GitHub Discussions 论坛，配有一只可互动换装的 Live2D 看板娘。

🌐 **在线访问**：https://zhaokening.ccwu.cc

---

## ✨ 功能特性

- 📖 **多页面站点**：首页 / 日记 / 归档 / 音乐 / 工具箱 / 留言板 / 404 页
- 🎀 **Live2D 看板娘**：常驻显示，支持 **5 位角色**（高松燈、千早愛音、要楽奈、長崎そよ、椎名立希）与多套立绘换装，可拖拽摆放、点击互动台词、快照拍照、隐藏
- 💬 **留言板**：由 Cloudflare Worker 后端驱动（JSONBin 云端存储 + KV 速率限制 + Turnstile 人机验证），留言持久化不丢失
- 🗨️ **论坛讨论区**：**giscus（GitHub Discussions 驱动）**，并配有定制樱花粉主题，评论内容与仓库 Issues 同步
- 🎵 **在线音乐**：外接多个免费 API（网易云/QQ/咪咕等聚合 + iTunes 官方试听 + 备用源）实现免登录听歌
- 🧰 **工具箱**：集成多款常用小工具与部分 API 工具调用，支持自定义背景
- 🗂️ **归档页**：收藏整理大量优质网站与项目链接
- 🌸 **沉浸视觉**：樱花飘落动画、粒子背景、Font Awesome 图标、农历(Lunar)、彩带特效、自定义心情表情
- ⚡ **性能与体验**：Service Worker 离线/缓存策略、统一版本号缓存刷新机制、响应式移动端适配

---

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 前端 | 原生 HTML + CSS + JavaScript（无框架） |
| 托管 | GitHub Pages + Cloudflare（CDN 加速 / SSL / 安全响应头） |
| 留言板后端 | Cloudflare Worker（无服务器） + JSONBin 存储 + KV 限流 |
| 人机验证 | Cloudflare Turnstile |
| 论坛 | giscus（GitHub Discussions） |
| 看板娘 | Live2D（Cubism 模型，同源静态加载） |
| 自动化 | GitHub Actions（定时同步 Bilibili 数据） |

---

## 📁 目录结构（核心）

```text
king.github.io/
├─ index.html / Journal.html / Archives.html / music.html
├─ Tools.html / Guestbook.html / 404.html   # 各页面
├─ css/            # 全站样式（style/sidebar/mobile + 各页面样式）
├─ js/             # 页面脚本、公共逻辑、version.js 版本管理
├─ live2d/         # 看板娘引擎与角色模型（waifu.js / widget.js / model/）
├─ css/giscus-theme.css# 论坛(giscus) 樱花粉定制主题
├─ sw.js           # Service Worker（离线缓存）
├─ server.js       # 本地开发服务器
├─ scripts/        # bili_sync.py 等自动化脚本
├─ .github/workflows/  # GitHub Actions 工作流
└─ data/bili/      # 自动化同步的数据
```

---

## 🚀 本地运行

```bash
node server.js        # 默认 http://127.0.0.1:8888
# 可选：HOST=0.0.0.0 PORT=3000 node server.js（注意：勿暴露到公网）
```

> 本地调试时留言板仍走线上的 Cloudflare Worker（CORS 已允许 localhost），功能可直接测试。

---

## ☁️ 部署

- 推送到 `main` 分支即触发 GitHub Pages 自动构建发布
- 自定义域名 `zhaokening.ccwu.cc` 经 Cloudflare 代理（SSL 模式 Full，暂未开 Strict，等待 GitHub Pages 签发站点证书）
- **全站缓存刷新**：修改 `js/version.js` 中的 `__DSH_VERSION` 后推送，所有页面资源自动换版本号；`sw.js` 缓存名同步更新即可强制访客取新内容

### 留言板 Worker（维护备忘，不含密钥）

- Worker：`orange-limit-3254.kaneking114.workers.dev`
- 存储：JSONBin（Master Key 存储为 Worker 的 `API_KEY` secret 绑定）
- 限流：KV 命名空间 `KING_KV`（留言 6 次 / 10 分钟 + 50 次 / 天；删除密码错误 5 次锁定 30 分钟）
- 人机验证：Turnstile `TURNSTILE_SECRET` secret 绑定；令牌校验失败返回 403「请完成人机验证」
- 关键点：重新部署 Worker 时必须**一次性带上全部绑定**（KING_KV / BIN_ID / API_KEY / ADMIN_KEY / TURNSTILE_SECRET），否则留言存储会失效

---

## 🔒 安全加固摘要

- 全站安全响应头（经 Cloudflare Transform Rules）：HSTS、X-Content-Type-Options、X-Frame-Options、Referrer-Policy、Permissions-Policy、CSP
- 留言板：CORS 来源白名单（仅本站域名与 localhost）、IP 速率限制、输入清洗与长度限制、删除口令 timing-safe 比较、错误锁定
- 本地服务器：默认仅绑 127.0.0.1、目录穿越防护、禁止任意跨域请求
- 所有机密（JSONBin 主密钥、删除口令、Turnstile 密钥）仅存于 CF 控制台/Worker 绑定，**不入库、不进前端代码**

---

## 🏷 关键词

个人博客 · 樱花主题 · 静态站 · GitHub Pages · Cloudflare · giscus · Live2D · 看板娘 · 留言板 · GitHub Actions

<p align="center">🌸 春风同花皆闻汝等之声 🌸</p>