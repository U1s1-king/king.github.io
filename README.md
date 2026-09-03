# 🌸 king.github.io

> **樱花物语 · 个人博客**
>
> 一个以樱花粉为主题的纯静态个人站点，记录日常、音乐、收藏与折腾，也提供工具箱、留言板和社区讨论等功能。

<p align="center">
  <a href="https://zhaokening.ccwu.cc">🌐 在线访问</a>
  ·
  <a href="https://github.com/U1s1-king/king.github.io">📦 GitHub</a>
</p>

---

## ✨ 关于本站

**king.github.io** 是一个以原生 Web 技术构建的个人博客/个人主页。

没有复杂的前端框架，尽可能保持页面轻量、直观，同时加入 Live2D、音乐播放器、留言板、论坛、工具箱以及各种细节动画，让网站既能用于记录，也能作为一个长期维护的个人空间。

### 🎀 主要功能

- 🏠 **个人主页**：樱花主题首页与动态视觉效果
- 📖 **日记**：记录日常、想法与生活片段
- 🗂️ **归档**：整理文章、收藏的网站与项目
- 🎵 **音乐**：支持多个音乐来源的在线试听
- 🧰 **工具箱**：集成各种实用小工具与 API 工具
- 💬 **留言板**：基于 Cloudflare Worker 的云端留言系统
- 🗨️ **讨论区**：使用 giscus + GitHub Discussions 实现社区评论
- 🌸 **Live2D**：可互动、拖拽、隐藏与换装的看板娘
- 📱 **响应式布局**：适配桌面端与移动端
- ⚡ **离线缓存**：Service Worker + 版本化资源缓存
- 🤖 **自动化**：GitHub Actions 自动同步部分数据

---

## 🌸 Live2D 看板娘

本站集成 Live2D 看板娘，并提供多角色、多服装以及交互功能。

目前包含：

- 高松燈
- 千早愛音
- 要楽奈
- 長崎そよ
- 椎名立希

支持拖拽摆放、点击互动、快照拍照以及隐藏看板娘等操作。

---

## 🛠️ 技术栈

| 模块 | 技术 |
| --- | --- |
| 前端 | HTML5 + CSS3 + JavaScript |
| 框架 | 无前端框架，以原生 Web 为主 |
| 静态托管 | GitHub Pages |
| CDN / HTTPS | Cloudflare |
| 留言板 | Cloudflare Workers + JSONBin + KV |
| 人机验证 | Cloudflare Turnstile |
| 评论系统 | giscus + GitHub Discussions |
| 看板娘 | Live2D / Cubism |
| 图标 | Font Awesome |
| 本地开发 | Node.js |
| 自动化 | GitHub Actions |
| 缓存 | Service Worker |

---

## 📁 项目结构

```text
king.github.io/
├── index.html              # 首页
├── Journal.html            # 日记
├── Archives.html           # 归档
├── music.html              # 音乐
├── Tools.html              # 工具箱
├── Guestbook.html          # 留言板
├── 404.html                # 404 页面
│
├── css/                    # 全站样式
│   ├── style.css
│   ├── sidebar.css
│   ├── mobile.css
│   └── giscus-theme.css
│
├── js/                     # 页面与公共脚本
│   └── version.js          # 全站资源版本管理
│
├── live2d/                 # Live2D 引擎与模型
│   ├── model/
│   ├── waifu.js
│   └── widget.js
│
├── data/                   # 网站数据
│   └── bili/               # Bilibili 同步数据
│
├── scripts/                # 自动化脚本
│   └── bili_sync.py
│
├── .github/
│   └── workflows/          # GitHub Actions
│
├── sw.js                   # Service Worker
└── server.js               # 本地开发服务器
```

---

## 🚀 本地运行

项目不需要复杂的构建流程，可以直接使用 Node.js 启动本地服务器：

```bash
node server.js
```

默认访问地址：

```text
http://127.0.0.1:8888
```

也可以自定义监听地址和端口：

```bash
HOST=0.0.0.0 PORT=3000 node server.js
```

> ⚠️ 如果只是在本机开发，建议保持 `127.0.0.1`，不要直接把本地服务器暴露到公网。

---

## ☁️ 部署

本站主要通过 **GitHub Pages + Cloudflare** 部署。

### GitHub Pages

将修改推送到 `main` 分支后，由 GitHub Pages 自动发布站点。

### Cloudflare

Cloudflare 主要用于：

- CDN 加速
- HTTPS / SSL
- DNS
- 安全响应头
- 缓存与访问优化

当前站点：

**https://zhaokening.ccwu.cc**

### 资源缓存更新

项目使用统一版本号管理静态资源缓存。

修改网站代码后，如果需要强制访客获取最新资源，可以更新：

```text
js/version.js
```

中的 `__DSH_VERSION`，并同步更新 `sw.js` 中的缓存版本。

---

## 💬 留言板架构

留言板采用 Serverless 架构，不需要单独维护传统服务器：

```text
浏览器
   │
   ▼
Cloudflare Worker
   │
   ├── Turnstile 人机验证
   ├── CORS 校验
   ├── IP 速率限制
   ├── 输入清洗 / 长度限制
   │
   ├── KV ──────── 限流数据
   │
   └── JSONBin ─── 留言数据
```

主要能力：

- Cloudflare Worker 无服务器后端
- JSONBin 云端持久化
- Cloudflare KV 限流
- Turnstile 人机验证
- CORS 来源白名单
- 输入清洗与长度限制
- 删除操作失败锁定

> 🔐 Worker 所需的密钥与管理口令均通过 Cloudflare Secret / Binding 配置，不写入 Git 仓库，也不会出现在前端代码中。

---

## 🗨️ 评论与讨论

论坛/评论区使用 **giscus**，通过 GitHub Discussions 保存讨论内容。

```text
giscus
   │
   ▼
GitHub Discussions
   │
   ▼
本站讨论区
```

这样既不需要额外搭建数据库，也能直接利用 GitHub 的社区能力。

---

## ⚡ 性能与体验

项目针对静态站点进行了多方面优化：

- Service Worker 缓存
- 静态资源版本管理
- 响应式移动端布局
- Cloudflare CDN
- 原生 HTML / CSS / JavaScript
- 尽量减少不必要的依赖
- 页面级脚本按需加载

目标很简单：**在保持视觉效果的同时，让网站尽可能轻快。**

---

## 🔒 安全说明

本站包含一定的安全防护措施：

- HSTS
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- CSP
- 留言接口 CORS 白名单
- IP 请求频率限制
- 输入清洗与长度限制
- 删除口令安全比较与错误锁定
- 本地服务器目录穿越防护
- 敏感配置使用 Cloudflare Secret / Binding

**请勿将 API Key、管理密码、Turnstile Secret 等敏感信息提交到 Git 仓库。**

---

## 🤖 自动化

项目使用 GitHub Actions 执行部分自动化任务，例如同步 Bilibili 相关数据。

相关工作流位于：

```text
.github/workflows/
```

---

## 📝 开发建议

修改网站时建议：

1. 先在本地启动 `server.js` 进行测试
2. 检查桌面端与移动端布局
3. 注意 Service Worker 缓存是否需要更新
4. 涉及接口时检查 CORS、限流与异常处理
5. 不要提交任何 Secret、Token 或管理密码
6. 确认无误后再推送到 `main`

---

## 📌 项目定位

这是一个持续维护中的个人网站，不追求复杂的技术栈，而更注重：

> **好看、好用、好维护，并且保留一点属于自己的浪漫。** 🌸

---

## 📮 站点

🌐 **在线访问：** https://zhaokening.ccwu.cc

📦 **项目仓库：** https://github.com/U1s1-king/king.github.io

---

<p align="center">
  🌸 春风同花皆闻汝等之声 🌸
</p>
