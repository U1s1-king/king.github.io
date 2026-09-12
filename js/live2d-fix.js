/* ============================================================
 * 看板娘补丁 (live2d-fix.js)
 * ------------------------------------------------------------
 * sakura-live2d 那个项目只部署了 live2d/model/* 和三个 js，
 * 缺少下面这些文件。它没有关联 Git 仓库、重新部署会覆盖整个模型库，
 * 所以只能在客户端兜底。这个文件负责两件事：
 *
 * 1) 角色图标 404
 *    缺：live2d/char_icons/*.png、live2d/assets/*.png（全 404）
 *    做法：把命中这两个目录的图片地址换成内联 SVG，从源头掐掉请求。
 *          只要请求发出去，控制台必定留一条红色 404，所以是「不发」而不是
 *          「失败了再换」。
 *
 *    waifu.js 有两条赋值路径，都要拦：
 *      a. fabImg.src = 'live2d/char_icons/041.png'   → 走 src setter
 *      b. roleHtml += '<img src="live2d/char_icons/002.png">' 再 innerHTML
 *         → HTML 解析器直接写属性，既不经过 setter 也不经过 setAttribute，
 *           只能改写 innerHTML 的字符串
 *
 * 2) physics.json 404 + [XHRLoader] 警告
 *    缺：每个模型的 index.json 都声明了 physics（data/physics.json 或
 *        live2d/physics.json），抽样 8 个模型全部 404，是模型库的批量缺陷。
 *    做法：拦截 index.json 的 fetch，把 physics 字段摘掉再交给引擎，
 *          引擎就不会去请求那个不存在的文件。
 *          代价是头发/衣服的物理摆动没有（本来也没有）。
 *          如果哪天 sakura-live2d 补上了 physics，删掉本段的 fetch 补丁即可。
 * ------------------------------------------------------------
 * 以后真放了图标，把 HAS_REAL_ICONS 改成 true，就会改用本站
 * img/char_icons/<角色号>.png（放真图进去即可，不用改别的）。
 * ============================================================ */
(function () {
  if (window.__L2D_FIX__) return;
  window.__L2D_FIX__ = true;

  var HAS_REAL_ICONS = false;   /* 本站 img/char_icons/ 里有没有真图标 */
  var LOCAL_BASE = 'img/char_icons/';
  /* 只匹配这两个目录，避免误伤站点自己的 /assets/ */
  var ICON_PATH = /(?:char_icons\/|live2d\/assets\/)/;
  var PNG_ICON = /[^\s"'()<>]*?(?:char_icons\/|live2d\/assets\/)[^\s"'()<>]*?\.png/g;

  function numOf(url) {
    var m = /char_icons\/(\d{3})\.png/.exec(url || '');
    if (m) return m[1];
    m = /chara_icon_(\d{3})\.png/.exec(url || '');
    if (m) return m[1];
    m = /(\d{3})[^/]*\.png$/.exec(url || '');
    return m ? m[1] : '';
  }

  function svgAvatar(num) {
    var s =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#ffb6c1"/><stop offset="1" stop-color="#e06a8f"/>' +
      '</linearGradient></defs>' +
      '<circle cx="32" cy="32" r="32" fill="url(#g)"/>' +
      '<circle cx="32" cy="24" r="9" fill="#fff" fill-opacity=".95"/>' +
      '<path d="M14 59c2.6-10.5 9.4-16 18-16s15.4 5.5 18 16z" fill="#fff" fill-opacity=".95"/>' +
      '<text x="32" y="52" text-anchor="middle" font-family="system-ui,sans-serif" ' +
      'font-size="12" font-weight="700" fill="#a14563">' + (num || '') + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  /* 缺失的图标地址 -> 该换成什么；不是这两个目录的返回 null（原样保留） */
  function substitute(url) {
    if (typeof url !== 'string' || !url) return null;
    if (url.indexOf('data:') === 0) return null;
    if (!ICON_PATH.test(url)) return null;
    var num = numOf(url);
    if (HAS_REAL_ICONS && num) return LOCAL_BASE + num + '.png';
    return svgAvatar(num);
  }

  /* HTML 字符串里的图标地址先换掉，避免解析器直接发起请求 */
  function rewriteHtml(html) {
    if (typeof html !== 'string' || html.length < 8) return html;
    if (html.indexOf('char_icons/') < 0 && html.indexOf('live2d/assets/') < 0) return html;
    return html.replace(PNG_ICON, function (whole) {
      var s = substitute(whole);
      return s === null ? whole : s;
    });
  }

  /* --- 路径 a：img.src = ... --- */
  try {
    var desc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (desc && desc.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set: function (v) { desc.set.call(this, substitute(v) || v); }
      });
    }
  } catch (e) {}

  /* --- 路径 a 补充：setAttribute('src', ...) --- */
  try {
    var origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (this.tagName === 'IMG' && String(name).toLowerCase() === 'src') {
        var s = substitute(value);
        if (s) return origSetAttr.call(this, name, s);
      }
      return origSetAttr.call(this, name, value);
    };
  } catch (e) {}

  /* --- 路径 b：innerHTML / insertAdjacentHTML 拼字符串 --- */
  try {
    var iDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (iDesc && iDesc.set) {
      Object.defineProperty(Element.prototype, 'innerHTML', {
        configurable: true,
        enumerable: iDesc.enumerable,
        get: iDesc.get,
        set: function (v) { iDesc.set.call(this, rewriteHtml(v)); }
      });
    }
  } catch (e) {}
  try {
    var origIAH = Element.prototype.insertAdjacentHTML;
    Element.prototype.insertAdjacentHTML = function (pos, html) {
      return origIAH.call(this, pos, rewriteHtml(html));
    };
  } catch (e) {}

  /* --- 最后一道：万一还有漏网的 --- */
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && ICON_PATH.test(t.src || '')) {
      var s = substitute(t.src);
      if (s) t.src = s;
    }
  }, true);

  /* ---------- 2. 摘掉 index.json 里指向不存在文件的 physics ---------- */
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : ((input && input.url) || '');
      var p = origFetch.apply(this, arguments);
      if (!/\/model\/[^/]+\/index\.json/.test(url)) return p;
      return p.then(function (res) {
        if (!res || !res.ok) return res;
        return res.text().then(function (txt) {
          var obj;
          try { obj = JSON.parse(txt); } catch (err) { return res; }
          if (!obj || !obj.physics) return res;
          delete obj.physics;
          var h = new Headers(res.headers);
          h.set('Content-Type', 'application/json; charset=utf-8');
          try { h.delete('content-length'); } catch (err) {}
          return new Response(JSON.stringify(obj), { status: 200, statusText: 'OK', headers: h });
        });
      });
    };
  }
})();