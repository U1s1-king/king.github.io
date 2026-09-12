# 看板娘角色图标（可选）

这里放**真**的角色头像 PNG，文件名 = 三位角色号，例如：

- `041.png`（户山香澄）
- `002.png`
- `001.png`

## 背景

`waifu.js` 里写死了：

```js
fabImg.src = ICON_BASE + roleNum(curRole) + '.png';   // → live2d/char_icons/041.png
```

但 `sakura-live2d` 项目**没有部署 `live2d/char_icons/` 和 `live2d/assets/`**，
这两个目录下的图标全部 404。那个项目是「直接上传」部署且没有关联 Git 仓库，
重新部署会把整个模型库覆盖掉，所以不能去那边补文件。

## 现在的做法（零 404）

由 `js/live2d-fix.js` 在客户端兜底：**拦截 `<img>` 的 src 赋值**，
命中这两个目录就直接换成内联绘制的 SVG 头像（粉色渐变 + 角色号），
**从源头掐掉请求**。

> 为什么是「掐掉」而不是「失败了再换」：判断图标存不存在只能先发一次请求，
> 而请求失败浏览器必定在控制台留一条红色 404。之前那版就是这么写的，
> 结果每次开页面都报两条 404（远程一次 + 本地一次）。

目前 `HAS_REAL_ICONS = false`，也就是一个图标请求都不发。

## 想换成真图标

1. 把 PNG 丢进这个目录（文件名 = 三位角色号，如 `041.png`）
2. 打开 `js/live2d-fix.js`，把 `HAS_REAL_ICONS` 改成 `true`

改完之后会改用 `img/char_icons/<角色号>.png`，不再走 SVG。

之所以要手动开一下，同上：自动探测必然要付一次 404 的代价。

## 从哪弄真图标

角色图标其实就是模型贴图里的人物半身像。可以自己从对应模型的
`texture_00.png` 裁一张 64×64 或者 128×128 的头像出来。

获取模型贴图的地址规律（两个目录布局都可能）：

```
https://sakura-live2d.pages.dev/live2d/model/<角色目录名>/data/textures/texture_00.png
https://sakura-live2d.pages.dev/live2d/model/<角色目录名>/live2d/texture_00.png
```

角色目录名见 `waifu.js` 里的 `BANDORI_MODEL_LIST`，例如 `041_casual`、`041_birthday_2024_ssr`。
取角色号 = 目录名前三位。
