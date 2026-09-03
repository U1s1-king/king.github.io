<div align="center">

<img src="https://raw.githubusercontent.com/U1s1-king/king.github.io/main/og-image.png" alt="樱花物语 Banner" width="100%">

# 🌸 KING'S WORLD

### `king.github.io` · 樱花物语 · Personal Website

**一个属于自己的数字空间。**

`记录` · `音乐` · `归档` · `工具箱` · `留言` · `分享` · `折腾`

<br>

[![Website](https://img.shields.io/badge/🌸_LIVE-zhaokening.ccwu.cc-ff5f9e?style=for-the-badge)](https://zhaokening.ccwu.cc)
[![GitHub](https://img.shields.io/badge/GitHub-U1s1--king-181717?style=for-the-badge&logo=github)](https://github.com/U1s1-king/king.github.io)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge&logo=javascript&logoColor=111)](#)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=fff)](#)

<br>

> 🌸 **「春风同花皆闻汝等之声」**
>
> *Welcome to my little corner of the Internet.*

</div>

---

## 🎞️ 网站一览

<div align="center">

<img src="./og-image.png" alt="樱花物语网站视觉图" width="92%">

<br><br>

**樱花、音乐、日记、工具与一点点属于自己的浪漫。**

</div>

---

## ✦ About

> **这不只是一个博客，而是一间不断扩建的数字房间。**

`king.github.io` 是一个以 **原生 HTML + CSS + JavaScript** 构建的个人网站。

没有复杂的前端框架，也没有庞大的构建链。这里更在意的是：**好看、好用、够快，而且真的属于自己。**

从最初的一张页面，到现在的日记、音乐、归档、工具箱、留言板、GitHub Discussions、Live2D 与自动化任务，这个网站一直在慢慢长大。

```text
                         🌸 KING'S WORLD 🌸
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
          📖 RECORD            🎵 MUSIC            🧰 TOOLS
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                         💬 SHARE · CONNECT
                                  │
                         🎀 LIVE2D COMPANION
                                  │
                           ✦ KEEP GROWING ✦
```

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🌸 Immersive UI

樱花飘落、粒子背景、动态视觉、彩带效果、农历信息与响应式布局。

</td>
<td width="50%">

### 🎀 Live2D

多角色、多套立绘、换装、点击互动、拖拽、拍照与隐藏。

</td>
</tr>
<tr>
<td>

### 📖 Journal

记录日常、想法、生活片段，以及一些突然想留下来的文字。

</td>
<td>

### 🗂️ Archives

整理收藏的网站、项目与各种值得保存的链接。

</td>
</tr>
<tr>
<td>

### 🎵 Music

聚合多个音乐来源，支持在线试听与备用音源。

</td>
<td>

### 🧰 Toolbox

把一些常用的小工具、API 能力集中到一个页面。

</td>
</tr>
<tr>
<td>

### 💬 Guestbook

Cloudflare Worker + JSONBin + KV + Turnstile 驱动的留言系统。

</td>
<td>

### 🗨️ Discussions

giscus + GitHub Discussions，让访客可以参与讨论。

</td>
</tr>
<tr>
<td>

### ⚡ Performance

Service Worker、资源版本控制、CDN 与原生 Web 技术共同提升体验。

</td>
<td>

### 🤖 Automation

GitHub Actions 自动执行部分数据同步与维护任务。

</td>
</tr>
</table>

---

## 🎀 Live2D Characters

<div align="center">

| 🌸 | Character | 🌸 | Character |
| :---: | :---: | :---: | :---: |
| 🎀 | **高松燈** | 🎀 | **千早愛音** |
| 🎀 | **要楽奈** | 🎀 | **長崎そよ** |
| 🎀 | **椎名立希** | ✦ | **More to come...** |

<br>

`拖拽`　`点击互动`　`换装`　`拍照`　`隐藏`

</div>

---

## 🗺️ Site Map

```text
🌐 HOME
│
├── 🏠 首页
│   ├── 🌸 樱花动画
│   ├── ✨ 粒子效果
│   └── 🎀 Live2D
│
├── 📖 Journal
│   └── 日记 / 随笔 / 生活记录
│
├── 🗂️ Archives
│   └── 收藏 / 网站 / 项目 / 归档
│
├── 🎵 Music
│   └── 播放器 / 音乐 API / 多源备用
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

## 🧬 Architecture

```text
                              ┌─────────────────┐
                              │     Browser     │
                              │   HTML / CSS    │
                              │   JavaScript    │
                              └────────┬────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
       ┌──────────────┐       ┌────────────────┐       ┌──────────────┐
       │ GitHub Pages │       │   Cloudflare   │       │     APIs     │
       │    Static    │       │ CDN / SSL / DNS│       │ Music / Data │
       └──────┬───────┘       └───────┬────────┘       └──────────────┘
              │                       │
              ▼                       ▼
       ┌──────────────┐       ┌────────────────┐
       │ServiceWorker │       │Security Headers│
       │Cache / Offline│      │ CSP / HSTS etc.│
       └──────────────┘       └────────────────┘

                              ┌─────────────────┐
                              │ Guestbook API   │
                              │ Cloudflare Worker│
                              └────────┬────────┘
                                       │
                        ┌──────────────┼──────────────┐
                        ▼              ▼              ▼
                      ┌────┐       ┌────────┐    ┌───────────┐
                      │ KV │       │ JSONBin│    │ Turnstile │
                      └────┘       └────────┘    └───────────┘
                    Rate Limit      Storage        Verify
```

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology |
| :--- | :--- |
| 🎨 Frontend | HTML5 · CSS3 · Vanilla JavaScript |
| 🌐 Hosting | GitHub Pages |
| ☁️ CDN | Cloudflare |
| 💬 Backend | Cloudflare Workers |
| 🗄️ Storage | JSONBin + Cloudflare KV |
| 🛡️ Protection | Turnstile + CSP + Security Headers |
| 🗨️ Comments | giscus + GitHub Discussions |
| 🎀 Character | Live2D / Cubism |
| 🤖 Automation | GitHub Actions |
| ⚡ Cache | Service Worker |
| 🖥️ Local Dev | Node.js |

</div>

---

## 📂 Project Structure

```text
king.github.io/
│
├── 📄 index.html              # 首页
├── 📄 Journal.html            # 日记
├── 📄 Archives.html           # 归档
├── 📄 music.html              # 音乐
├── 📄 Tools.html              # 工具箱
├── 📄 Guestbook.html          # 留言板
├── 📄 404.html                # 404
│
├── 🎨 css/
│   ├── style.css
│   ├── sidebar.css
│   ├── mobile.css
│   └── giscus-theme.css
│
├── ⚙️ js/
│   └── version.js             # 资源版本管理
│
├── 🎀 live2d/
│   ├── model/                 # Live2D 模型
│   ├── waifu.js
│   └── widget.js
│
├── 📦 data/
│   └── bili/                  # Bilibili 数据
│
├── 🤖 scripts/
│   └── bili_sync.py           # 自动同步
│
├── 🔧 .github/workflows/      # GitHub Actions
├── ⚡ sw.js                   # Service Worker
└── 🖥️ server.js               # 本地开发服务器
```

---

## ⚡ Quick Start

```bash
# Clone
git clone https://github.com/U1s1-king/king.github.io.git
cd king.github.io

# Start local server
node server.js
```

打开：

```text
http://127.0.0.1:8888
```

> 💡 本项目以静态页面为主，不需要复杂的构建流程。

---

## ☁️ Deployment

```text
                 ┌──────────────┐
                 │   git push   │
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │    GitHub    │
                 │     Pages    │
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │  Cloudflare  │
                 ├──────────────┤
                 │ CDN / HTTPS  │
                 │ DNS / Cache  │
                 │   Security   │
                 └──────┬───────┘
                        ▼
                🌸 zhaokening.ccwu.cc
```

### 🔄 Cache Busting

项目使用统一版本号管理静态资源缓存。

需要强制更新资源时：

```text
js/version.js
      │
      └── __DSH_VERSION

sw.js
      │
      └── Cache Version
```

---

## 💬 Guestbook Backend

```text
                       🌐 Client
                          │
                          ▼
                 ┌─────────────────┐
                 │ Cloudflare      │
                 │ Worker          │
                 └────────┬────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
       🛡️ CORS       🤖 Turnstile      ⏱️ Rate Limit
          │               │               │
          └───────────────┼───────────────┘
                          │
                   ┌──────┴──────┐
                   ▼             ▼
                 🗄️ JSONBin     📦 KV
                   │             │
                 留言数据       限流数据
```

敏感配置通过 Cloudflare Secret / Binding 管理。

**API Key、管理密码、Turnstile Secret 等信息不会提交到 Git 仓库。**

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
- Secrets stored outside Git

> 🔒 **Keep secrets out of source control.**

---

## 🤖 Automation

```text
.github/workflows/
        │
        ▼
   ⏰ Scheduled Job
        │
        ▼
   📡 Data Sync
        │
        ▼
   📝 Update Data
        │
        ▼
   🚀 Commit / Deploy
```

---

## 📊 Live Project Status

<div align="center">

| Module | Status |
| :--- | :---: |
| 🌐 Website | 🟢 Online |
| 📱 Responsive | 🟢 Ready |
| 🎀 Live2D | 🟢 Enabled |
| 🎵 Music | 🟢 Enabled |
| 🧰 Toolbox | 🟢 Enabled |
| 💬 Guestbook | 🟢 Enabled |
| 🗨️ Discussions | 🟢 Enabled |
| ⚡ Service Worker | 🟢 Enabled |
| 🤖 Automation | 🟢 Enabled |

</div>

---

## 📈 GitHub

<div align="center">

<img src="https://github-readme-stats.vercel.app/api?username=U1s1-king&show_icons=true&hide_border=true&theme=rose_pine" height="165">
<img src="https://github-readme-stats.vercel.app/api/top-langs/?username=U1s1-king&layout=compact&hide_border=true&theme=rose_pine" height="165">

</div>

---

## 🌱 Philosophy

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
> 🌸 这就是 **KING'S WORLD**。

---

## 🔗 Explore

<div align="center">

### 🌸 [VISIT WEBSITE](https://zhaokening.ccwu.cc)

### 📦 [VIEW SOURCE](https://github.com/U1s1-king/king.github.io)

<br>

**Made with 💗, JavaScript & a little bit of magic.**

<br><br>

`© KING'S WORLD`

🌸 **春风同花皆闻汝等之声** 🌸

</div>
