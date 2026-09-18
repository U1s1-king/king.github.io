/* ============================================================
 * APP 壳层脚本 (app-shell.js)
 * ------------------------------------------------------------
 * 只在「APP 打包壳 / PWA standalone / ?app=1 调试」下干活：
 *   1. 判定环境，给 <html> 加 .is-app（css/app.css 全靠这个类生效）
 *   2. 打开 viewport-fit=cover，让 --sat / --sab 拿到真实安全区
 *   3. 注入顶部 App Bar（回首页 / 标题 / 分享），维护滚动隐藏与键盘态
 *   4. 外链交给系统浏览器（装了 Capacitor Browser 插件就走插件）
 *   5. 不注册 Service Worker，并清掉旧的 king-blog-* 缓存
 *
 * 网页端（非 standalone、非 Capacitor、没有 ?app=1）在第 1 步就直接
 * return，一行 DOM 都不碰。调试：任意页面加 ?app=1 就能看到 APP 形态，
 * ?app=0 强制关掉。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 站点根：404.html 会在任意深度被命中，不能用相对路径 ---------- */
  var BASE = '/';
  var SCRIPT = document.currentScript;
  if (!SCRIPT) {
    var LIST = document.getElementsByTagName('script');
    for (var i = LIST.length - 1; i >= 0; i--) {
      if (LIST[i].src && /\/app-shell\.js(\?|$)/.test(LIST[i].src)) { SCRIPT = LIST[i]; break; }
    }
  }
  if (SCRIPT && SCRIPT.src) {
    var M = SCRIPT.src.match(/^(.*\/)js\/app-shell\.js(\?.*)?$/);
    if (M) BASE = M[1];
  }

  /* ---------- 1. 环境判定 ---------- */
  /* ?app=1 / #app=1 都能强制，方便调试（file:// 直接打开时用 # 更稳） */
  var signal = location.search + '&' + location.hash;
  var forced = /(?:^|[?&#])app=1(?:&|$)/.test(signal) ? true
             : (/(?:^|[?&#])app=0(?:&|$)/.test(signal) ? false : null);
  var standalone = false;
  try {
    standalone = !!(window.matchMedia && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches)) ||
      window.navigator.standalone === true;
  } catch (e) {}
  var IS_APP = forced !== null ? forced : (!!window.Capacitor || standalone);

  var root = document.documentElement;

  /* ============================================================
     二级页面（详情层）—— 主流 App 的 push/pop 骨架
     ------------------------------------------------------------
     为什么不用真路由：站点是 GitHub Pages 静态多页，二级内容本来就在
     一级页的 DOM 里。再建一套路由等于把内容拆两遍。这里改用「详情层」：
     全屏 fixed 覆盖 + 从右滑入 + 顶栏切成「← + 标题」+ 历史哨兵。
     桌面端完全不走这条路（isNarrow() 为假），网页端像素不变。

     顶栏归谁管：
   · 普通页面（网页 / APP）—— 本页自己的 .app-bar，由 app-shell 注入

     层栈（v2）：
   从「单槽位」升级成真正的层栈，支持最多三级（一级页 → 二级 → 三级）。
   升级前 openDetail 里那句 `if (detail) closeDetail({silent:true})` 意味着
   在二级页里再开一层会**当场销毁二级页**，用户看到的是「闪一下换了个页」
   而不是进入更深一层；硬件返回键也会错乱。
   现在每层各占一个数组元素，closeDetail 只弹栈顶。

   兼容性：对外 API 的语义一个字没改 ——
     · openDetail(opts)   仍旧返回 { el, close, setTitle }
     · closeDetail(opts)  仍旧只关一层（现在是栈顶）
     · detailOpen()       仍旧是布尔（现在是「栈非空」）
   全站 16 处 `if (detailOpen()) return` 的调用点**不需要改**：
   它们本来就是「一层都别叠」的正确写法，行为与升级前一致。

   历史哨兵：每层压一个 pushState。返回键 / 浏览器后退
   → popstate → 只弹栈顶一层，栈空才真正离开本页。
     ============================================================ */
  var stack = [];                 /* [{ el, title, onClose }]，末位是栈顶 */
  var suppressHistClose = false;  /* 自己调 history.back() 时压掉随之而来的 popstate */
  function top() { return stack.length ? stack[stack.length - 1] : null; }

  function isNarrow() { return window.innerWidth <= 768; }

  /* ============================================================
     视口跨越 768px 的通知（移动端 / 网页端隔离的关键一环）
     ------------------------------------------------------------
     各页面脚本都是「窄屏注入一份、宽屏注入另一份」，但视口在运行时会变。
     没有这个通知，窄屏注入的节点就留在宽屏 DOM 里，而它的样式写在
     @media (max-width: 768px) 里 —— 网页端于是出现「没样式的残留」。
     模块用 AppShell.onMode(fn) 订阅，在跨越时把对端注入的节点拆掉。
     ============================================================ */
  var modeCbs = [];
  function onMode(cb) {
    if (typeof cb !== 'function') return function () {};
    modeCbs.push(cb);
    return function () {
      var i = modeCbs.indexOf(cb);
      if (i >= 0) modeCbs.splice(i, 1);
    };
  }
  /* 变宽时清掉「只在窄屏注入」的节点与类：tools 的卡片网格、guestbook 的
     说明条与撰写条、journal 的列表页脚…… 这些类的样式都写在
     @media (max-width: 768px) 里，留在网页端就是没样式的残留。
     音乐页自己还有一层更细的拆装（见 js/music-app.js / music-plus.js）。 */
  var NARROW_ONLY = [
    '.mgrid-wrap', '.mgrid-head', '.mgrid', '.mgrid-item',
    '.gb-note', '.gb-compose',
    '.pc-foot', '.pc-teaser', '.pc-more',
    /* 日记页的工具卡入口：窄屏注入，变宽必须拆掉，否则网页端会多出一排
       没有样式的按钮（它们的样式写在 @media (max-width:768px) 里）。 */
    '.jrn-entry-row', '.jrn-entry', '.jrn-subentry',
    '#fsOpenBtn', '#nsPlatformChips'
  ];
  function clearNarrowOnly() {
    for (var i = 0; i < NARROW_ONLY.length; i++) {
      var nodes = document.querySelectorAll(NARROW_ONLY[i]);
      for (var j = nodes.length - 1; j >= 0; j--) {
        if (nodes[j].parentNode) nodes[j].parentNode.removeChild(nodes[j]);
      }
    }
    var r = document.documentElement;
    r.classList.remove('gb-compose-mode');
    r.classList.remove('gb-degraded');
    r.classList.remove('tool-grid');
    r.classList.remove('pc-list');
    r.classList.remove('jrn-app');
    r.classList.remove('kb-open');
    r.classList.remove('bar-hidden');
  }
  function fireMode(narrow) {
    if (!narrow) clearNarrowOnly();
    for (var i = 0; i < modeCbs.length; i++) {
      try { modeCbs[i](narrow); } catch (e) { /* 单个模块出错不影响其它模块 */ }
    }
  }

  function setBarDetail(on, title) {
    var bar = document.querySelector('.app-bar');
    if (!bar) return;
    var t = bar.querySelector('.app-bar-title');
    var home = bar.querySelector('.app-bar-home');
    /* 层数标记：CSS 靠它决定顶栏箭头是「返回上一级」还是「回到首页」，
       也为以后做「三级页再多一级箭头」留了口子。 */
    bar.dataset.depth = String(stack.length);
    if (on) {
      if (bar.dataset.baseTitle === undefined) bar.dataset.baseTitle = t ? t.textContent : '';
      bar.classList.add('detail-mode');
      bar.classList.remove('bar-hidden');
      if (t && title) t.textContent = title;
      if (home) home.setAttribute('aria-label', '返回上一级');
    } else {
      bar.classList.remove('detail-mode');
      if (t && bar.dataset.baseTitle !== undefined) t.textContent = bar.dataset.baseTitle;
      if (home) home.setAttribute('aria-label', '回到首页');
    }
  }

  /* 竖向拖拽关闭 + 横向滑动切换，只装一次手势逻辑，避免两个方向打架。
     axis 在第一次移动超过 8px 时才锁定，之后不再改，滑动就不会「抖」。 */
  function bindGestures(el, opts) {
    var x0 = 0, y0 = 0, dx = 0, dy = 0, axis = '', dragging = false;
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { dragging = false; return; }
      dragging = true; axis = ''; dx = 0; dy = 0;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
      el.style.transition = 'none';
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      dx = e.touches[0].clientX - x0;
      dy = e.touches[0].clientY - y0;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis === 'y' && opts.close) {
        var d = dy > 0 ? dy : dy * 0.25;
        el.style.transform = 'translateY(' + d + 'px)';
        el.style.opacity = String(Math.max(0.4, 1 - Math.abs(d) / 500));
      } else if (axis === 'x' && opts.onHorizontal) {
        el.style.transform = 'translateX(' + (dx * 0.55) + 'px)';
      }
    }, { passive: true });
    el.addEventListener('touchend', function () {
      if (!dragging) return;
      dragging = false;
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
      if (axis === 'y' && opts.close && dy > 110) { closeDetail(); return; }
      if (axis === 'x' && opts.onHorizontal && Math.abs(dx) > 60) {
        opts.onHorizontal(dx < 0 ? 1 : -1);   /* 1 = 下一张，-1 = 上一张 */
      }
    });
  }

  function openDetail(opts) {
    opts = opts || {};
    /* 二级页默认是移动端专属能力：桌面端直接拒绝创建。多这一道闸门，
       任何调用方忘了判视口都不会让桌面端凭空多出一层。
       确实要在桌面端开二级页的调用方，必须显式传 allowDesktop: true。 */
    if (!isNarrow() && !opts.allowDesktop) {
      /* 桌面端不建层，但必须返回一个同形状的空壳句柄：调用方普遍会直接
         handle.setTitle(...) / handle.close()，返回 null 会变成空指针崩溃，
         那比「没反应」更糟。 */
      return { el: null, close: function () {}, setTitle: function () {} };
    }
    /* 注意：这里**不再**关掉已有层。层栈化之后，在二级页里再开一层
       就是合法的三级页（见文件头「层栈（v2）」）。上限由 openDetail 的
       调用方各自把关（它们普遍带 if (detailOpen()) return），
       这里再补一道硬上限，防止某条链路无限压栈。 */
    var MAX_DEPTH = 3;
    if (stack.length >= MAX_DEPTH) return { el: null, close: function () {}, setTitle: function () {} };

    var el = document.createElement('div');
    el.className = 'detail-view';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    /* 关键内联样式兜底：万一 app.css 没加载/被缓存挡了一层，详情层至少还是
       一个可见的全屏面板，而不是掉在文档末尾的裸 div——那种「点了没反应」
       是最难查的失败形态。只写与 CSS 完全相同的值，且刻意不设 top，
       免得盖掉 html.has-appbar 那条顶栏偏移规则。 */
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.right = '0';
    el.style.bottom = '0';
    el.style.zIndex = '9999';
    el.style.background = '#fff9f7';
    el.style.overflowY = 'auto';
    if (opts.title) el.setAttribute('aria-label', opts.title);
    if (opts.content) {
      if (typeof opts.content === 'string') el.innerHTML = opts.content;
      else el.appendChild(opts.content);
    }
    /* 桌面端没有 App Bar 可以挂标题和返回：二级页自己带一条，
       否则桌面端点进去就出不来了。手机端照旧用 App Bar，不加这条。 */
    if (!isNarrow()) {
      var hd = document.createElement('div');
      hd.className = 'detail-head';
      var ht = document.createElement('div');
      ht.className = 'detail-head-title';
      ht.textContent = opts.title || '';
      var hx = document.createElement('button');
      hx.type = 'button';
      hx.className = 'detail-head-close';
      hx.setAttribute('aria-label', '关闭');
      hx.innerHTML = '<i class="fas fa-xmark"></i>';
      hx.addEventListener('click', function () { closeDetail(); });
      hd.appendChild(ht);
      hd.appendChild(hx);
      el.insertBefore(hd, el.firstChild);
    }
    document.body.appendChild(el);
    document.body.classList.add('detail-open');
    var self = { el: el, title: opts.title || '', onClose: opts.onClose };
    stack.push(self);
    requestAnimationFrame(function () { el.classList.add('in'); });

    /* 顶栏只显示栈顶那层的标题：新层压入时它就是新层，弹栈时由
       closeDetail 重启上一层的。 */
    setBarDetail(true, opts.title);
    if (opts.swipeClose || opts.onHorizontal) bindGestures(el, opts);

    /* 历史哨兵：硬件返回键 / 浏览器后退只弹栈顶一层，栈空才离开本页。
       每层各压一个，和层栈一一对应。 */
    try { history.pushState({ apDetail: stack.length }, '', location.href); } catch (e) {}

    return {
      el: el,
      close: function () { closeDetail(); },
      setTitle: function (t) {
        /* 这一层可能已经被弹掉了（setTitle 常常在异步回调里调用），
           所以按 el 现查而不是比对某个全局变量。 */
        for (var i = 0; i < stack.length; i++) {
          if (stack[i].el === el) {
            stack[i].title = t;
            if (i === stack.length - 1) setBarDetail(true, t);
            return;
          }
        }
      }
    };
  }

  function closeDetail(opts) {
    opts = opts || {};
    if (!stack.length) return;
    var d = stack.pop();          /* 只弹栈顶：下面的层原样留着 */
    d.el.classList.remove('in');
    if (d.onClose) { try { d.onClose(); } catch (e) {} }
    releaseAdopted(d);            /* 只归还这一层搬进来的节点，别动下面各层 */
    setTimeout(function () { if (d.el.parentNode) d.el.parentNode.removeChild(d.el); }, 260);

    if (stack.length) {
      /* 还有上层：顶栏回到上一层的标题，页面保持 detail-open，
         被揭开的那层要重新滑回视野（它一直挂着 .in，无需重播动画）。 */
      setBarDetail(true, stack[stack.length - 1].title);
    } else {
      document.body.classList.remove('detail-open');
      setBarDetail(false);
    }

    /* 界面按钮触发的关闭要把哨兵弹掉；popstate 触发的关闭绝不能再 back 一次 */
    if (!opts.fromHistory && !opts.silent) {
      suppressHistClose = true;
      try { history.back(); } catch (e) {}
    }
  }

  window.addEventListener('popstate', function () {
    if (suppressHistClose) { suppressHistClose = false; return; }
    if (stack.length) closeDetail({ fromHistory: true });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && stack.length) closeDetail();
  });

  /* 外壳顶栏的左箭头点了之后，会往这里发 detail-back —— 兜底，
     主路径其实是 history.back() 触发上面的 popstate。 */
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'detail-back') return;
    /* 这里要走正常关闭：closeDetail() 会 history.back() 把本 iframe 压下的
       历史哨兵还回去。用 fromHistory 关的话哨兵会留在栈上，越积越多。 */
    if (stack.length) closeDetail();
  });

  /* ============================================================
     滚动位置记忆
     ------------------------------------------------------------
     只在被外壳装进 iframe 时需要：外壳换 src 会把文档整个重建，
     不记就每次都跳回顶部。普通手机网页后退时浏览器自己会还原，
     所以这里不动它（也就不会改变网页端既有行为）。
     ============================================================ */

  /* ---------- APP 专属：浏览器行为收口（不改可见布局） ---------- */
  if (IS_APP) {
    /* common.js 看到这个标记就跳过 SW 注册 */
    window.__APP_SHELL__ = true;
    root.classList.add('is-app');

    /* viewport-fit=cover：--sat / --sab 才有真值。网页端不开，
       所以手机浏览器里 --sat/--sab 恒为 0，与改动前一致。 */
    try {
      var vp = document.querySelector('meta[name="viewport"]');
      var content = vp && vp.getAttribute('content');
      if (content && content.indexOf('viewport-fit') < 0) {
        vp.setAttribute('content', content + ', viewport-fit=cover');
      }
    } catch (e) {}
  }

  /* ---------- 3. 顶栏 ---------- */
  /* 顶栏标题按环境取：
     · APP / 外壳 —— 就是页面标题（页面自己的 H1 会被隐藏，顶栏承担标题职责）
     · 手机网页 —— 显示站点名（页面 H1 还在，两个标题不重复，也不伤 SEO） */
  var SITE_NAME = 'Tomo Ebizuka';
  function pageTitle() {
    if (!IS_APP) return SITE_NAME;
    var t = (document.title || '').replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '');
    t = t.split(/[·|｜]/)[0].trim();
    return t || SITE_NAME;
  }

  function buildBar() {
    if (document.querySelector('.app-bar')) return;
    var bar = document.createElement('header');
    bar.className = 'app-bar';

    var home = document.createElement('a');
    home.className = 'app-bar-home';
    home.href = BASE + 'home.html';
    home.setAttribute('aria-label', '回到首页');
    home.innerHTML = '<i class="fas fa-spa"></i>';
    /* 二级页态下这个「回首页」链接就是返回键：必须拦掉跳转，改成关详情层。
       不拦的话点一下直接跳 home.html —— 相当于返回键把人送回首页。 */
    home.addEventListener('click', function (e) {
      if (stack.length) { e.preventDefault(); closeDetail(); }
    });

    var title = document.createElement('div');
    title.className = 'app-bar-title';
    title.textContent = pageTitle();

    var share = document.createElement('button');
    share.type = 'button';
    share.className = 'app-bar-share';
    share.setAttribute('aria-label', '分享');
    share.innerHTML = '<i class="fas fa-share-nodes"></i>';
    share.addEventListener('click', function () {
      if (typeof window.sharePage === 'function') window.sharePage();
    });

    bar.appendChild(home);
    bar.appendChild(title);
    bar.appendChild(share);
    document.body.insertBefore(bar, document.body.firstChild);
    /* .has-appbar 同时驱动两件事：显示顶栏 + 收掉页面自带的大标题。
       绑在一起是为了「要么都有、要么都没有」，不会出现标题消失又没有顶栏。 */
    root.classList.add('has-appbar');
  }

  /* 下滚隐藏 / 上滚出现。只绑一次；顶栏可能被拆掉重建，所以每次现查。 */
  var lastY = 0;
  var barScrollBound = false;
  function bindBarScroll() {
    if (barScrollBound) return;
    barScrollBound = true;
    window.addEventListener('scroll', function () {
      var bar = document.querySelector('.app-bar');
      if (!bar) return;
      var y = window.pageYOffset || 0;
      if (y > lastY + 8 && y > 60) bar.classList.add('bar-hidden');
      else if (y < lastY - 8) bar.classList.remove('bar-hidden');
      lastY = y;
    }, { passive: true });
  }

  /* 顶栏只属于窄屏：桌面端不建、不注入 DOM，从根上保证网页端零影响。
     CSS 里还有一层 display:none 兜底，双保险。 */
  var kbBound = false;
  function syncBar() {
    var bar = document.querySelector('.app-bar');
    /* forced === true：URL 显式带 ?app=1 / #app=1 时，宽屏也把顶栏建出来，
       好让我们在电脑浏览器里直接看 App 的样子。默认（forced = null）行为不变。 */
    if (isNarrow() || forced === true) {
      if (!bar) buildBar();
      bindBarScroll();
      if (!kbBound) { kbBound = true; bindKeyboard(); }
    } else if (bar && bar.parentNode) {
      bar.parentNode.removeChild(bar);
      root.classList.remove('has-appbar');
      root.classList.remove('bar-hidden');
      root.classList.remove('kb-open');
    }
  }

  /* 键盘弹出：底部导航和迷你条必须让路，否则会浮在键盘上 */
  function bindKeyboard() {
    var vv = window.visualViewport;
    if (!vv) return;
    var base = window.innerHeight;
    vv.addEventListener('resize', function () {
      if (Math.abs(window.innerHeight - base) > 120) base = window.innerHeight;
      root.classList.toggle('kb-open', (base - vv.height) > 150);
    });
  }

  /* ---------- 4. 外链交给系统浏览器 ---------- */
  function bindExternal() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href)) return;
      var abs;
      try { abs = new URL(a.href, location.href); } catch (err) { return; }
      var special = /^mailto:|^tel:/i.test(href);
      if (abs.origin === location.origin && !special) return;
      var P = window.Capacitor && window.Capacitor.Plugins;
      if (P && P.Browser && P.Browser.open) {
        e.preventDefault();
        P.Browser.open({ url: abs.href });
      } else if (abs.origin !== location.origin) {
        /* 没有原生桥时，至少别让 WebView 在原地打转 */
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    }, true);
  }

  /* ---------- 5. APP 内不要 Service Worker ---------- */
  function dropServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.getRegistrations().then(function (rs) {
        rs.forEach(function (r) { try { r.unregister(); } catch (e) {} });
      }).catch(function () {});
      if (window.caches && caches.keys) {
        caches.keys().then(function (keys) {
          keys.forEach(function (k) { if (/^king-blog-/.test(k)) caches.delete(k); });
        }).catch(function () {});
      }
    } catch (e) {}
  }

  /* 对外 API：页面脚本（如日记的图片查看器）通过它开二级页面。
     在 app-shell.js 之后加载的脚本都能拿到，顺序见各页 <head>。 */
  /* ============================================================
     搬真实节点（adopt / releaseAdopted）
     ------------------------------------------------------------
     二级页要展示「活的东西」时，克隆 DOM 会出事：
       · <audio> / <iframe> 克隆后回到 0 秒，正在听的歌、正在看的视频全断
       · 事件监听器不会被克隆过去，图片查看器等绑定直接失效
     搬移（appendChild）不重建节点，两者都没问题。所以这里提供
     adopt(node, into)；closeDetail 会自动 releaseAdopted() 归位，
     调用方不需要自己写 onClose 收拾。
     ============================================================ */
  var adopted = [];
  function adopt(node, into) {
    if (!node || !into || !node.parentNode) return null;
    /* 记下「搬给哪一层」。层栈化之后这很关键：三级页关掉时只能归还
       三级页自己搬进来的节点，不能把二级页壳里的内容也一起掀回去 ——
       否则从正文返回列表，列表会整个空掉。 */
    adopted.push({ n: node, p: node.parentNode, s: node.nextSibling, layer: top() });
    into.appendChild(node);
    return node;
  }
  function releaseAdopted(layer) {
    /* 只归还属于这一层的节点；layer 为空时（兼容旧调用）全部归还。 */
    var keep = [];
    for (var i = adopted.length - 1; i >= 0; i--) {
      var it = adopted[i];
      if (layer && it.layer !== layer) { keep.push(it); continue; }
      if (!it.p) continue;
      try {
        if (it.s && it.s.parentNode === it.p) it.p.insertBefore(it.n, it.s);
        else it.p.appendChild(it.n);
      } catch (e) {}
    }
    adopted = keep;
  }

  window.AppShell = {
    onMode: onMode,
    isApp: IS_APP,
    isNarrow: isNarrow,
    openDetail: openDetail,
    closeDetail: closeDetail,
    setBarDetail: setBarDetail,
    adopt: adopt,
    releaseAdopted: releaseAdopted,
    detailOpen: function () { return stack.length > 0; },
    /* 层栈深度：0 = 一级页，1 = 二级页，2 = 三级页。
       日记页的二级/三级入口靠它判断「现在是不是已经到头了」。 */
    detailDepth: function () { return stack.length; }
  };

  /* ---------- 续播提示条：音乐页之外显示「继续播放《xx》」 ----------
     <audio> 不能跨文档存活（切页文档就被销毁），所以别处没法真的接着放。
     这条只是把断点入口摆出来：点一下回音乐页，那边从记录的秒数继续。 */
  var RESUME_KEY = 'dsh-music-resume';
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' + s : s);
  }
  function bindResumeBar() {
    if (document.getElementById('resumeBar')) return;
    if (/music\.html$/i.test(location.pathname)) return;   /* 音乐页自己有续播 */
    var r = null;
    try { r = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); } catch (e) { r = null; }
    if (!r || !r.playing || !r.name) return;
    if (Date.now() - (Number(r.ts) || 0) > 12 * 3600 * 1000) return;

    var bar = document.createElement('div');
    bar.id = 'resumeBar';
    bar.className = 'resume-bar';
    bar.setAttribute('role', 'button');
    bar.setAttribute('tabindex', '0');
    bar.setAttribute('title', '继续播放');
    var img = document.createElement('img');
    img.className = 'resume-cover';
    img.alt = '';
    if (r.cover) img.src = r.cover;
    var meta = document.createElement('div');
    meta.className = 'resume-meta';
    var nm = document.createElement('div');
    nm.className = 'resume-name';
    nm.textContent = r.name;
    var sub = document.createElement('div');
    sub.className = 'resume-sub';
    sub.textContent = '继续播放' + (r.artist ? ' · ' + r.artist : '') + ' · ' + fmtClock(Number(r.at) || 0);
    meta.appendChild(nm);
    meta.appendChild(sub);
    var go = document.createElement('i');
    go.className = 'fas fa-play resume-go';
    bar.appendChild(img);
    bar.appendChild(meta);
    bar.appendChild(go);
    function gotoMusic() {
      location.href = location.pathname.replace(/[^/]*$/, '') + 'music.html';
    }
    bar.addEventListener('click', gotoMusic);
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gotoMusic(); }
    });
    document.body.appendChild(bar);
  }

  function init() {
    /* 顶栏在窄屏网页与 APP 里都要有：这是「像 App」最关键的一块。
       桌面端一律不建 —— 只靠 CSS 隐藏不够：媒体查询不命中只是「样式不
       应用」，元素照样占位显示（上一版桌面端多出一行没样式的顶栏就是
       这么来的）。桌面端网页优先级最高，这条是硬约束不是可调项。 */
    syncBar();
    bindResumeBar();
    var rt = null;
    var lastNarrow = isNarrow();
    window.addEventListener('resize', function () {
      if (rt) return;
      rt = setTimeout(function () {
        rt = null;
        syncBar();
        /* 只有真的跨过 768px 才广播，拖窗口不会反复拆装 */
        var n = isNarrow();
        if (n !== lastNarrow) { lastNarrow = n; fireMode(n); }
      }, 200);
    });
    if (IS_APP) {
      bindExternal();
      dropServiceWorker();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
