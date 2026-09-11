/* ============================================================
 * 看板娘角色图标修复 (live2d-icon-fix.js)
 * ------------------------------------------------------------
 * 背景：sakura-live2d 这个项目的 `live2d/char_icons/` 目录整个没有部署，
 * 而 waifu.js 里写死了 fabImg.src = char_icons/<角色号>.png，
 * 导致右下角浮动按钮的图片全是 404（其它功能不受影响）。
 *
 * 那个项目是「直接上传」部署且没有关联仓库，重新部署会把整个模型库覆盖掉，
 * 所以这里做客户端兜底，分两级：
 *   1. 先试本站 img/char_icons/<角色号>.png —— 放上真图标就自动生效，无需改代码
 *   2. 再退回内联 SVG 主题头像（粉渐变 + 角色号），保证不再出现裂图
 * ============================================================ */
(function () {
  if (window.__L2D_ICON_FIX__) return;
  window.__L2D_ICON_FIX__ = true;

  var LOCAL_BASE = 'img/char_icons/';

  function numOf(url) {
    var m = /char_icons\/(\d{3})\.png/.exec(url || '');
    if (m) return m[1];
    m = /(\d{3})\.png$/.exec(url || '');
    return m ? m[1] : '';
  }

  function svgAvatar(num) {
    var s =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffd9e6"/><stop offset="1" stop-color="#e06a8f"/>' +
      '</linearGradient></defs>' +
      '<circle cx="32" cy="32" r="32" fill="url(#g)"/>' +
      '<circle cx="32" cy="24" r="9" fill="#fff" fill-opacity=".95"/>' +
      '<path d="M14 59c2.6-10.5 9.4-16 18-16s15.4 5.5 18 16z" fill="#fff" fill-opacity=".95"/>' +
      '<text x="32" y="52" text-anchor="middle" font-family="system-ui,sans-serif" ' +
      'font-size="12" font-weight="700" fill="#c2497a">' + num + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  function fix(img) {
    if (!img || img.tagName !== 'IMG') return;
    var num = numOf(img.src) || img.getAttribute('data-l2d-num') || '041';
    var lastNum = img.getAttribute('data-l2d-num');
    var stage = img.getAttribute('data-l2d-fix') || '0';
    if (lastNum !== num) stage = '0';           /* 换角色了，重新走一级兜底 */
    img.setAttribute('data-l2d-num', num);
    if (stage === '0') {
      img.setAttribute('data-l2d-fix', '1');
      img.src = LOCAL_BASE + num + '.png';      /* 一级：本站真图标 */
    } else if (stage === '1') {
      img.setAttribute('data-l2d-fix', '2');
      img.removeAttribute('srcset');
      img.src = svgAvatar(num);                 /* 二级：内联 SVG，必定成功 */
    }
  }

  /* 资源加载失败不会冒泡，必须在捕获阶段监听 */
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && /char_icons\//.test(t.src || '')) fix(t);
  }, true);

  /* 兜底扫描：覆盖监听器装上之前就已经失败的图，以及模型切换后重新赋值的图 */
  function scan() {
    var imgs = document.querySelectorAll('img.wf-img, img[src*="char_icons/"]');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (/^data:/.test(im.src || '')) continue;
      if (im.complete && im.naturalWidth === 0) fix(im);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();

  var tries = 0;
  var timer = setInterval(function () {
    scan();
    if (++tries >= 40) clearInterval(timer);   /* 覆盖到模型切换，之后停止轮询 */
  }, 1000);
})();
