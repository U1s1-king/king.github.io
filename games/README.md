# games/ —— 游戏厅素材来源与改动说明

## 来源
本目录下的 41 款小游戏来自 **[SinceraXY/GameHub](https://github.com/SinceraXY/GameHub)**
(42 款中的 41 款,见下方"改动"),原项目以 **Apache License 2.0** 授权,
许可证全文见同目录 `LICENSE-GameHub.txt`。原项目作者:SinceraXY。

## 本站所做的改动(按 Apache-2.0 第 4 条声明)
1. 移除 `Action/Archery`(射箭):该游戏依赖 GSAP 付费 Club 插件 `MorphSVGPlugin`
   (`script.js` 中调用 `MorphSVGPlugin.pathDataToBezier`),该插件不可再分发,
   原版引用的是第三方 S3 直链,在本站 CSP 下必然加载失败。
2. 外链自持化:把原先指向 `cdnjs.cloudflare.com` 的 three.js / TweenMax 下载到
   `games/_lib/`,Font Awesome 改指本站自带的 `/css/all.min.css`;
   避免依赖外站,也符合本站 CSP(`script-src` 不含 cdnjs)。
3. 每个游戏的 `index.html` 末尾注入 `/games/_back.js`,提供一个返回游戏厅的浮动入口
   (游戏页里没有站点侧边栏/底部导航)。
4. 未改动任何游戏的玩法代码。
5. 站点统一皮:给全部 41 个 `index.html` 注入 `/games/_site-skin.css` 与
   `/games/_site-skin.js` —— 只统一**页壳**:页面底色(站点粉渐变)、字体、
   视口站点色描边、浏览器标题(`游戏名 · 游戏厅 | Tomo Ebizuka`)。
   仍然不碰任何游戏内部布局、配色与玩法代码,也不改各游戏自带的 `style.css`。

## 说明
- 各游戏自带 `README.md` 保留原样,供追溯出处。
- 部分游戏引用了 Google Fonts(`fonts.googleapis.com`),该域不在本站 CSP 白名单里,
  线上会回退到系统字体,不影响游玩(纯外观差异)。
