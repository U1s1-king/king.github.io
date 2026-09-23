# 试过但**没有接**的音源（附实测证据）

> 记下来的目的：这些结论是花时间实测出来的，别以后又重走一遍。
> 每一条都写清楚「试到哪一步」「为什么放弃」。
> 最后更新：2026-09-23

---

## AcFun —— 已打通到能拿播放地址，但仍然**不接**

**结论：技术上通了，工程上不值得。**

### 打通的过程（如果将来 AcFun 出纯音频轨，照着这个接就行）

1. **搜索**（直连可用，无需 key / cookie）：
   ```
   GET https://www.acfun.cn/rest/pc-direct/search/video?keyword=<kw>&pageNo=1&pageSize=30
   Referer: https://www.acfun.cn/
   ```
   返回 `videoList[]`，每条有 `contentId`（视频号）、`videoId`、`title`。

2. **mkey 要从视频页里抠**：
   ```
   GET https://www.acfun.cn/v/ac<contentId>        # ~130KB HTML
   ```
   页面里 `window.pageInfo = {...}` 内嵌 JSON，取 `currentVideoId` / `mkey` / `dougaId`。
   （用括号配平抠 JSON，正则会被 `\};` 和字符串里的花括号坑掉。）

3. **取播放信息**（**这是关键，老路径已经 404**）：
   ```
   GET https://www.acfun.cn/rest/pc-direct/play/playInfo/ksPlayJson
       ?videoId=<currentVideoId>&mkey=<mkey>&resourceId=<dougaId>&resourceType=2
   Referer: https://www.acfun.cn/v/ac<contentId>
   ```
   - `/rest/pc-direct/play/playInfo`（没有 `/ksPlayJson`）**已经 404**，
     返回的是一页 SPA HTML —— 这就是网上很多教程失效的原因。
   - **`resourceType=2` 才是对的**；`1` 和 `3` 都返回
     `{"result":101103,"error_msg":"视频未过审或已删除"}`。
   - 这个路径是从播放器 JS `h5player.*.js` 里 grep 出来的，不是猜的：
     `z.a.get("/rest/pc-direct/play/playInfo/ksPlayJson?videoId="+t+"&mkey="+ut+"&resourceId="+i+"&resourceType="+r, {withCredentials:!0})`

4. 返回 `playInfo.ksPlayJson`（另有 `ksPlayJsonHevc` / `ksPlayJsonAv1`），
   是**字符串**，再 parse 一次 → `adaptationSet[].representation[].url`。

### 为什么放弃

| 问题 | 实测 |
|---|---|
| **只有 HLS，没有直链** | 所有 url 都是 `.m3u8`，`content-type: application/vnd.apple.mpegurl`，正文 `#EXTM3U` |
| **没有纯音频轨** | 抽了「音乐」「MV」「翻唱」三个关键词各 3 条视频，`adaptationSet` **永远只有视频组**，没有独立音轨（**B站 是 DASH + 独立音频轨**，这才是我们要的） |
| **码率是音频的 3~20 倍** | 最低 360P 是 180~519 kbps，1080P 到 **2933 kbps**；而我们只需要 128~320 kbps |
| **网站要额外引 hls.js** | `<audio>` 放不了 m3u8。现在只有 `js/tv-player.js` 引了 hls.js，音乐这边没有；而且得改用 `<video>` |
| **App 要加依赖** | 现在只有 `media3-exoplayer`，**没装 `media3-exoplayer-hls`** |
| **每次播放多一次 130KB 页面请求** | mkey 只能从视频页 HTML 里抠（搜索接口不返回） |
| **内容属性** | AcFun 是视频站，搜「周杰伦」出来的是 MV / 合集 / 搬运，跟 B站 一个性质但流格式更差 |

**一句话**：B站 能接是因为它给 DASH + 独立音频轨；AcFun 给的是整段视频的 HLS，
拉一首歌要下整段视频 —— 流量和复杂度都不划算。

---

## JOOX —— 搜索和歌词都能用，**取链恒为空**

调研报告说「可直连、强烈推荐」。**实测不成立。**

```
搜索 GET https://music-api.gdstudio.xyz/api.php?...&types=search&source=joox&name=告白氣球   → 200，30 条 ✅
歌词 GET https://music-api.gdstudio.xyz/api.php?...&types=lyric&source=joox&id=..           → 200，完整 LRC ✅
取链 GET https://music-api.gdstudio.xyz/api.php?...&types=url&source=joox&id=..&br=320      → {"url":"","br":-1,"size":0} ❌
```

- 换了 3 首歌 × 4 档音质（128/192/320/999），**全部返回空**。
- 同一个 API 拿 `source=netease` 正常返回真实直链 —— 所以不是网络问题。
- 判断：**JOOX 按地区/IP 限制**（只对港台东南亚开放）。

---

## 其它试过但没有接的

| 来源 | 实测结果 | 结论 |
|---|---|---|
| `api.i-meto.com/meting` | 搜索能返回，但字段名是 `title`/`author`（不是 Meting 的 `name`/`artist`），且它返回的签名地址**实测 404** | 不用 |
| `musicapi.qijieya.cn` | 521 | 死 |
| `meting.qjqq.cn` | 522 | 死 |
| `music.xianqiao.wang` | 200 但正文是一页 HTML | 死 |
| `api.baka.plus` / `api.byfuns.top` / `api-meting.whitisnot.me` / `ncm.bikonoo.com` | 403 / 404 / DNS 不通 / 返回 HTML | 全死 |
| `interface.music.163.com` 明文接口 | `{"msg":"参数错误","code":400}`（IP 风控） | 不能依赖 |
| Deezer | `/search/track` 返回 `{"data":[],"total":165}` | API 已不返数据 |
| `lxmusicapi.onrender.com`（Huibq keep-alive） | 503 `This service has been suspended by its owner.` | 停服 |
| `api.vsaa.cn`（汽水音乐） | 备案停站页 | 死 |
| TIDAL / Spotify / YouTube | 需真账号或签名解密；YouTube 的 googlevideo 直链**绑定解析方 IP** | 成本过高 |
| 汽水音乐 | 搜索免签名可用，但**播放只有 60s 试听**（服务端强制） | 只能当搜索源 |

---

## 已经接了的（对照用）

| 源 | 位置 | 说明 |
|---|---|---|
| **Audius** | 网站（纯客户端直连） | 独立音乐 / CC 授权，整曲，CORS `*` |
| **喜马拉雅** | 网站（纯客户端直连） | 有声书 / 播客，整曲，搜索结果自带播放地址 |
| **`api.msls1441.com`** | 网关 + 网站 + App 镜像池 | Meting 镜像，302 到真实 CDN |
| **`ncm.landdy.cn`** | 网关兜底 | 网易云第三方实例，**很抖**（本机 4/4 成功、CF Worker 连续 3 次 522） |
| **`buguyy.top`** | 网关兜底 | 返回酷我 CDN 直链。⚠️ 搜索**只认单个关键词**，带空格返回 0 条 |
