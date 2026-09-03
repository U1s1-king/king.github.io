<div align="center">

# 🌸 KING'S WORLD

### `king.github.io` · 樱花物语 · Personal Website

**一个属于自己的数字空间。**

记录 · 音乐 · 收藏 · 工具 · 分享 · 折腾

<br>

[![Website](https://img.shields.io/badge/🌸_Website-zhaokening.ccwu.cc-ff8ab3?style=for-the-badge)](https://zhaokening.ccwu.cc)
[![GitHub](https://img.shields.io/badge/GitHub-U1s1--king-181717?style=for-the-badge&logo=github)](https://github.com/U1s1-king/king.github.io)
[![License](https://img.shields.io/badge/License-Personal-ffb6c1?style=for-the-badge)](#)
[![Static](https://img.shields.io/badge/Stack-Vanilla_JS-f7df1e?style=for-the-badge&logo=javascript)](#)

<br><br>

> 🌸 **「春风同花皆闻汝等之声」**
>
> Welcome to my little corner of the Internet.

</div>

---

## ✦ 这是什么？

`king.github.io` 不只是一个博客。

它更像是一个持续生长的 **个人数字空间** ——
这里可以写日记、听音乐、收藏喜欢的网站、使用一些小工具、留下自己的足迹，也可以和访客进行交流。

整个站点坚持 **原生 Web + 静态优先** 的思路，在不依赖大型前端框架的情况下，把动画、Live2D、音乐、评论、留言板以及各种小功能组合起来。

```text
                    🌸 KING'S WORLD 🌸
                           │
          ┌────────────────┼────────────────┐
          │                │                │
       📖 记录          🎵 音乐          🧰 工具
          │                │                │
          └────────────────┼────────────────┘
                           │
                    💬 交流 · 分享
                           │
                    ✦ 持续更新中 ✦
```

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 🌸 Immersive UI

樱花飘落、粒子背景、动态效果、响应式布局，以及大量细节动画。

</td>
<td width="50%">

### 🎀 Live2D

多角色、多服装、点击互动、拖拽、拍照与隐藏功能。

</td>
</tr>
<tr>
<td>

### 🎵 Music

聚合多个免费音乐来源，支持在线播放与备用源。

</td>
<td>

### 💬 Guestbook

Cloudflare Worker + JSONBin + KV + Turnstile 构建的留言系统。

</td>
</tr>
<tr>
<td>

### 🧰 Toolbox

各种常用小工具与 API 能力集合，一个页面解决一些小问题。

</td>
<td>

### 🗨️ Community

通过 giscus + GitHub Discussions 提供评论与讨论能力。

</td>
</tr>
<tr>
<td>

### ⚡ Performance

Service Worker、资源版本管理、CDN 与原生 Web 技术共同优化访问体验。

</td>
<td>

### 🤖 Automation

GitHub Actions 自动执行部分数据同步与维护任务。

</td>
</tr>
</table>

---

## 🎨 Site Map

```text
🌐 Home
│
├── 🏠 首页
│   └── 樱花 / 粒子 / 动态内容 / Live2D
│
├── 📖 Journal
│   └── 日记 / 随笔 / 生活记录
│
├── 🗂️ Archives
│   └── 文章 / 收藏 / 网站 / 项目
│
├── 🎵 Music
│   └── 在线音乐 / 播放器 / 多源 API
│
├── 🧰 Tools
│   └── 实用工具 / API 工具
│
├── 💬 Guestbook
│   └── 留言 / 回复 / 管理
│
└── 🗨️ Discussions
    └── giscus / GitHub Discussions
```

---

## 🎀 Live2D Characters

本站目前拥有多位 Live2D 看板娘：

| Character | Character |
| :---: | :---: |
| 高松燈 | 千早愛音 |
| 要楽奈 | 長崎そよ |
| 椎名立希 | ✦ More... |

支持：

`拖拽` · `点击互动` · `换装` · `拍照` · `隐藏`

---

## 🧬 Architecture

```text
                         ┌────────────────────┐
                         │      Browser       │
                         │   HTML/CSS/JS      │
                         └─────────┬──────────┘
                                   │
             ┌─────────────────────┼─────────────────────┐
             │                     │                     │
             ▼                     ▼                     ▼
       GitHub Pages            Cloudflare              APIs
       Static Hosting          CDN / SSL               Music / Data
             │                     │
             │                     ▼
             │              Security Headers
             │
             ▼
       Service Worker
             │
             ▼
       Cache / Offline

                    ┌─────────────────────┐
                    │   Guestbook API     │
                    │ Cloudflare Worker   │
                    └──────────┬──────────┘
                               │
                  ┌────────────┼────────────┐
                  ▼            ▼            ▼
                KV         JSONBin      Turnstile
              Rate Limit    Storage       Verify
```

---

## 🛠️ Tech Stack

<div align="center">

| Category | Technology |
| :--- | :--- |
| 🎨 UI | HTML5 · CSS3 |
| ⚙️ Logic | Vanilla JavaScript |
| 🌐 Hosting | GitHub Pages |
| ☁️ CDN | Cloudflare |
| 💬 Backend | Cloudflare Workers |
| 🗄️ Storage | JSONBin + Cloudflare KV |
| 🛡️ Security | Turnstile + CSP + Security Headers |
| 🗨️ Comments | giscus + GitHub Discussions |
| 🎀 Character | Live2D / Cubism |
| 🤖 Automation | GitHub Actions |
| 💾 Cache | Service Worker |
| 🖥️ Dev Server | Node.js |

</div>

---

## 📂 Project Structure

```text
king.github.io/
│
├── 📄 index.html
├── 📄 Journal.html
├── 📄 Archives.html
├── 📄 music.html
├── 📄 Tools.html
├── 📄 Guestbook.html
├── 📄 404.html
│
├── 🎨 css/
│   ├── style.css
│   ├── sidebar.css
│   ├── mobile.css
│   └── giscus-theme.css
│
├── ⚙️ js/
│   └── version.js
│
├── 🎀 live2d/
│   ├── model/
│   ├── waifu.js
│   └── widget.js
│
├── 📦 data/
│   └── bili/
│
├── 🤖 scripts/
│   └── bili_sync.py
│
├── 🔧 .github/workflows/
│
├── ⚡ sw.js
└── 🖥️ server.js
```

---

## ⚡ Quick Start

### 1. Clone

```bash
git clone https://github.com/U1s1-king/king.github.io.git
cd king.github.io
```

### 2. Start

```bash
node server.js
```

### 3. Open

```text
http://127.0.0.1:8888
```

就这么简单。

没有 `npm install` 地狱，没有复杂构建链，打开服务器即可开始开发。✨

---

## ☁️ Deployment

```text
Push to main
      │
      ▼
GitHub Actions / Pages
      │
      ▼
Static Website
      │
      ▼
Cloudflare
      │
      ├── CDN
      ├── HTTPS
      ├── DNS
      ├── Security Headers
      └── Cache
      │
      ▼
🌸 zhaokening.ccwu.cc
```

### 🔄 更新缓存

项目使用统一版本号控制静态资源缓存。

当需要强制浏览器获取最新资源时，可以更新：

```text
js/version.js
```

中的：

```js
__DSH_VERSION
```

并同步更新 `sw.js` 的缓存版本。

---

## 💬 Guestbook Backend

留言板采用 Serverless 架构：

```text
Client
  │
  ▼
Cloudflare Worker
  │
  ├── CORS
  ├── Turnstile
  ├── Input Sanitization
  ├── Rate Limit
  │
  ├──────► KV
  │          └── Rate Limit Data
  │
  └──────► JSONBin
             └── Guestbook Data
```

敏感信息通过 Cloudflare Secret / Binding 管理，**不会写入仓库或前端代码**。

---

## 🔐 Security

本站包含多层基础安全措施：

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- CORS Origin Whitelist
- IP Rate Limiting
- Input Sanitization
- Request Length Limits
- Delete Failure Lockout
- Local Server Path Traversal Protection
- Secrets stored outside Git repository

> 🔒 **Never commit API keys, passwords, tokens or Cloudflare secrets.**

---

## 🤖 Automation

部分数据通过 GitHub Actions 自动同步。

```text
.github/workflows/
        │
        ▼
   Scheduled Job
        │
        ▼
  Data Collection
        │
        ▼
   Update / Commit
```

---

## 🌱 Philosophy

这个项目没有追求“最新”“最复杂”的技术栈。

相反，我更喜欢：

```text
Simple        → 简单
Beautiful     → 好看
Fast          → 快
Useful        → 好用
Maintainable  → 好维护
Personal      → 有自己的味道
```

> **代码可以很理性，网站可以有一点浪漫。**
>
> 🌸 这就是 KING'S WORLD。

---

## 📊 Project Status

| Item | Status |
| :--- | :---: |
| 🌐 Website | 🟢 Online |
| 📱 Mobile | 🟢 Supported |
| 🎀 Live2D | 🟢 Enabled |
| 💬 Guestbook | 🟢 Enabled |
| 🗨️ Discussions | 🟢 Enabled |
| 🎵 Music | 🟢 Enabled |
| 🧰 Toolbox | 🟢 Enabled |
| ⚡ Service Worker | 🟢 Enabled |
| 🤖 Automation | 🟢 Enabled |

---

## 🔗 Links

<div align="center">

### 🌸 [VISIT WEBSITE](https://zhaokening.ccwu.cc)

### 📦 [VIEW SOURCE](https://github.com/U1s1-king/king.github.io)

</div>

---

<div align="center">

**Made with 💗, JavaScript & a little bit of magic.**

<br>

`© KING'S WORLD`

🌸 **春风同花皆闻汝等之声** 🌸

</div>
