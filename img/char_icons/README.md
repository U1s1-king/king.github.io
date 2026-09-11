# 看板娘角色图标（可选）

这里放**真**的角色头像 PNG，文件名 = 三位角色号，例如：

- `041.png`（户山香澄）
- `002.png`
- `001.png`

## 为什么要放在这

`waifu.js` 里写死了：

```js
fabImg.src = ICON_BASE + roleNum(curRole) + '.png';   // → live2d/char_icons/041.png
```

但 `sakura-live2d` 项目**没有部署 `live2d/char_icons/` 这个目录**，所以右下角浮动按钮的图一直是 404。

那个项目是「直接上传」部署且没有关联 Git 仓库，重新部署会把整个模型库（几百 MB）覆盖掉，
所以不能去那边补文件。改由 `js/live2d-icon-fix.js` 在本站兜底：

1. 先试 `img/char_icons/<角色号>.png`（也就是这个目录）
2. 没有再退回内联绘制的水色主题头像（粉渐变 + 角色号），保证永远不出现裂图

**只要把真图标丢进这个目录，无需改任何代码，刷新即生效。**

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
