(function () {
var bar = document.createElement('div');
bar.id = 'page-progress';
document.body.appendChild(bar);
var w = 2, timer = null;
function tick() {
w = Math.min(92, w + (100 - w) * 0.09);
bar.style.width = w + '%';
}
timer = setInterval(tick, 140);
function done() {
clearInterval(timer);
bar.style.width = '100%';
setTimeout(function () {
bar.style.transition = 'opacity .5s ease';
bar.style.opacity = '0';
setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 600);
}, 250);
}
/* 进度条原先只挂 load。但 Archives 内嵌 4 个 B 站播放器 iframe 加一个远程 mp3，
   它们永不 load，实测该页 load 要 16.8 秒才触发 —— 于是进度条会卡在 92% 十几秒。
   DOMContentLoaded 之后内容其实已经可用了，再加一道兜底把它收掉。 */
var finished = false;
function once() { if (finished) return; finished = true; done(); }
if (document.readyState === 'complete') { once(); }
else {
  window.addEventListener('load', once);
  document.addEventListener('DOMContentLoaded', function () { setTimeout(once, 1200); });
  setTimeout(once, 8000);
}
var els = document.querySelectorAll(
'.profile-card,.card,.post-card,.page-card,.info-grid,.intro-name,' +
'.about-container > * , main > * , .link-grid'
);
if (!('IntersectionObserver' in window) || !els.length) return;
var io = new IntersectionObserver(function (entries) {
entries.forEach(function (e) {
if (e.isIntersecting) {
e.target.classList.remove('reveal-init');
e.target.classList.add('reveal-in');
io.unobserve(e.target);
}
});
}, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
Array.prototype.forEach.call(els, function (el) {
/* 初始隐藏的面板（display:none 的 tab）不参与 reveal，避免首次切换时内容不可见 */
if (getComputedStyle(el).display === 'none') return;
el.classList.add('reveal-init');
io.observe(el);
});
})();
/* ===== 自定义光标 + 花瓣拖尾（A2/A3 性能重写）=====
 * 旧写法两个问题：
 *  1) rAF 里写 cur.style.left/top —— 那是会触发布局的属性，而且被赋成整 px
 *     丢掉亚像素，既掉帧又发涩。改用 translate 属性：它与元素自身那条
 *     transform:translate(-50%,-50%) 是叠加的，居中效果不变，且走合成层。
 *  2) 每次 mousemove 都 createElement 一个花瓣，约 36 个/秒的创建 + 销毁。
 *     改成固定对象池复用节点，并让池成员不占 will-change 合成层。
 */
(function () {
var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
if (isMobile || !window.matchMedia('(pointer: fine)').matches) return;
document.body.classList.add('custom-cursor');
var cur = document.createElement('div');
cur.id = 'sakura-cursor';
cur.innerHTML = '🌸';
cur.style.translate = '-100px -100px';
document.body.appendChild(cur);

/* 帧率无关的跟随：写死 0.32/帧 的话，144Hz 上会比 60Hz 快一倍 */
var cx = -100, cy = -100, tx = -100, ty = -100, raf = 0, prev = 0;
function loop(now) {
  var dt = prev ? Math.min(now - prev, 50) : 16.7;
  prev = now;
  var k = 1 - Math.pow(1 - 0.32, dt / 16.7);
  cx += (tx - cx) * k;
  cy += (ty - cy) * k;
  cur.style.translate = cx + 'px ' + cy + 'px';
  /* 已经收敛就停掉循环：鼠标静止时不再产生任何样式写入 */
  if (Math.abs(tx - cx) < 0.1 && Math.abs(ty - cy) < 0.1) { raf = 0; prev = 0; return; }
  raf = requestAnimationFrame(loop);
}
function kick() { if (!raf) { prev = 0; raf = requestAnimationFrame(loop); } }

/* 花瓣对象池：18 个节点循环复用 */
var POOL = 18, tails = [], pi = 0;
for (var i = 0; i < POOL; i++) {
  var el = document.createElement('div');
  el.className = 'sakura-tail';
  el.innerHTML = '🌸';
  el.style.willChange = 'auto';
  document.body.appendChild(el);
  tails.push(el);
}
function emit(x, y) {
  var p = tails[pi]; pi = (pi + 1) % POOL;
  /* 用 translate 定位而不是 left/top：fixed 元素上写 left/top 会触发布局，
     translate 只走合成，且与 tailFall 动画里的 transform 叠加不冲突 */
  p.style.translate = (x + (Math.random() - 0.5) * 14).toFixed(1) + 'px ' + (y + (Math.random() - 0.5) * 14).toFixed(1) + 'px';
  p.style.fontSize = (9 + Math.random() * 11).toFixed(1) + 'px';
  p.style.setProperty('--dx', ((Math.random() - 0.5) * 90).toFixed(0) + 'px');
  p.style.setProperty('--dy', (35 + Math.random() * 70).toFixed(0) + 'px');
  p.style.setProperty('--dr', ((Math.random() - 0.5) * 240).toFixed(0) + 'deg');
  /* 用 WAAPI 归零重启，避开 "改 style 再读 offsetWidth" 的强制同步布局 */
  var a = p.getAnimations ? p.getAnimations()[0] : null;
  if (a) { a.currentTime = 0; a.play(); }
  else { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; }
}
var last = 0;
document.addEventListener('mousemove', function (e) {
  tx = e.clientX; ty = e.clientY;
  kick();
  var now = Date.now();
  if (now - last < 28) return;
  last = now;
  emit(e.clientX, e.clientY);
}, { passive: true });
})();

/* ===== 骨架屏/加载层 ===== */
(function () {
  var root = document.documentElement;
  if (sessionStorage.getItem('king-loaded')) { root.classList.add('app-ready'); return; }
  var layer = document.createElement('div');
  layer.id = 'sakura-loading-layer';
  layer.innerHTML = '<div class="loading-inner"><span class="sakura-spinner"></span><span class="loading-text">加载中…</span></div>';
  document.body.appendChild(layer);
  root.classList.add('app-loading');
  window.addEventListener('load', function () {
    setTimeout(function () {
      sessionStorage.setItem('king-loaded', '1');
      layer.classList.add('fade-out');
      setTimeout(function () { layer.remove(); root.classList.remove('app-loading'); root.classList.add('app-ready'); }, 350);
    }, 200);
  });
  setTimeout(function () {
    if (document.getElementById('sakura-loading-layer')) {
      layer.classList.add('fade-out');
      setTimeout(function () { layer.remove(); root.classList.remove('app-loading'); root.classList.add('app-ready'); }, 350);
    }
  }, 4000);
})();
/* ===== 飘落动画（全站统一，原各页面各自内嵌一份，已收敛于此） ===== */
(function () {
  var flurryContainer = document.getElementById('sakura-flurry');
  if (!flurryContainer) return;
  function createPetal() {
    var petal = document.createElement('div');
    petal.classList.add('petal');
    var size = 8 + Math.random() * 14;
    petal.style.width = size + 'px';
    petal.style.height = size * 0.9 + 'px';
    petal.style.left = Math.random() * 100 + '%';
    petal.style.animationDuration = (6 + Math.random() * 12) + 's';
    petal.style.animationDelay = (Math.random() * 15) + 's';
    petal.style.opacity = String(0.4 + Math.random() * 0.5);
    petal.style.background = 'radial-gradient(circle, #ffdfe6, #ffb0c2)';
    petal.style.filter = 'blur(' + (Math.random() * 1.2) + 'px)';
    return petal;
  }
  /* 移动端花瓣 28 → 12。这一层是纯装饰：每个花瓣都是一个带
     transform/opacity 无限动画的 div，28 个和 12 个在手机上肉眼几乎分不出，
     但少掉的 16 个一直在合成层里跑。桌面端（>=700px）仍然 45，观感不变。 */
  function desiredCount() { return window.innerWidth < 700 ? 12 : 45; }
  var petalCount = desiredCount();
  function spawn(n) { for (var i = 0; i < n; i++) flurryContainer.appendChild(createPetal()); }
  spawn(petalCount);
  function replenishPetals() {
    if (document.hidden) return; /* 页面在后台时别再扫 DOM、别再补花瓣 */
    var currentCount = flurryContainer.children.length;
    if (currentCount < petalCount - 8) {
      spawn(Math.min(petalCount - currentCount, 8));
    }
    var allPetals = flurryContainer.querySelectorAll('.petal');
    for (var i = 0; i < allPetals.length; i++) {
      var rect = allPetals[i].getBoundingClientRect();
      if (rect.top > window.innerHeight + 100 || rect.bottom < -100) allPetals[i].remove();
    }
  }
  setInterval(replenishPetals, 4000);
  window.addEventListener('resize', function () {
    var expected = desiredCount();
    if (Math.abs(flurryContainer.children.length - expected) > 12) {
      while (flurryContainer.firstChild) flurryContainer.removeChild(flurryContainer.firstChild);
      petalCount = expected;
      spawn(petalCount);
    }
  });
  setTimeout(function () {
    if (flurryContainer.children.length < 20) spawn(12);
  }, 500);
})();
/* ===== 公共：Service Worker 注册（原各页面 JS 各自注册一份，已收敛，统一由本文件注册） =====
 * APP（js/app-shell.js 判定并置 window.__APP_SHELL__）里直接跳过：
 * 资源已经在安装包内，再叠一层 SW 缓存只会带来「装了新版还是旧页面」，
 * app-shell.js 那边还会顺手 unregister 并清掉旧的 king-blog-* 缓存。 */
(function () {
  if (window.__APP_SHELL__) return;
  if ("serviceWorker" in navigator) {
    /* 带上版本号注册：/sw.js 被缓存 4 小时（GH Pages 的 max-age=14400），
       不带版本号的话浏览器会在这 4 小时里一直用 HTTP 缓存里的旧脚本，
       于是 SW 里的新策略（比如「同源 /api/* 绝不入缓存」）迟迟不生效。
       换成 /sw.js?v=<版本> 后每个版本都是一个全新 URL，浏览器必然重新拉取，
       安装完 skipWaiting + clients.claim 立即接管。
       同一个 scope 下只会存在一份注册，旧注册会被这次注册替换。 */
    var v = window.__DSH_VERSION || "1";
    navigator.serviceWorker.register("/sw.js?v=" + v).catch(function(){});
  }
})();

/* ===== 公共：离线提示条 ===== */
(function () {
  var bar = null;
  function showBar(on) {
    if (on) {
      if (bar) return;
      bar = document.createElement('div');
      bar.id = 'offline-bar';
      bar.textContent = '🌸 当前处于离线状态，显示的是缓存内容喵';
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(244,143,177,.92);color:#fff;text-align:center;padding:8px 12px;font-size:13px;font-family:inherit;box-shadow:0 2px 10px rgba(0,0,0,.08);backdrop-filter:blur(4px);transition:all .3s';
      document.body.appendChild(bar);
    } else if (bar) {
      bar.remove();
      bar = null;
    }
  }
  function apply() { showBar(!navigator.onLine); }
  window.addEventListener('offline', apply);
  window.addEventListener('online', apply);
  window.addEventListener('load', apply);
  /* SW 触发离线事件兜底：SW 接管后若请求失败且页面仍在线，也检查一次 */
  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg) {
        var check = function () {
          showBar(!navigator.onLine);
        };
        navigator.serviceWorker.controller.addEventListener('statechange', check);
      }
    }).catch(function(){});
  }
})();

/* ===== 公共：占位符悬停提示（原 index.js / Journal.js 开头各一份，已收敛） ===== */
(function () {
  var placeholders = document.querySelectorAll('.placeholder-marker, .cherry-placeholder');
  placeholders.forEach(function (elem) {
      elem.style.transition = 'all 0.2s';
    elem.addEventListener('mouseenter', function () {
      elem.style.opacity = '0.95';
      elem.style.boxShadow = '0 0 0 2px #ffb7c980';
    });
    elem.addEventListener('mouseleave', function () {
      elem.style.opacity = '';
      elem.style.boxShadow = '';
    });
  });
})();


/* ===== 公共：带会话缓存的 JSON 请求 =====
 * GitHub API 未鉴权时限制 60 次/小时/IP，同一标签页 15 分钟内复用结果，
 * 既省配额，也避免被限流后页面显示失败。
 */
window.fetchCachedJSON = function (url, ttlMs) {
  var ttl = ttlMs || 15 * 60 * 1000;
  var key = 'json:' + url;
  try {
    var hit = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.t < ttl) return Promise.resolve(hit.d);
  } catch (e) {}
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }).then(function (d) {
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
    return d;
  });
};

/* ===== 公共：WMO 天气代码表（原 index.js / Journal.js / Tools.js 各一份，已收敛） ===== */
window.__WMO_WEATHER = {
  0: { icon: '☀️', desc: '晴', tip: '适合出门晒太阳' },
  1: { icon: '🌤', desc: '大部晴朗', tip: '适合散步' },
  2: { icon: '⛅', desc: '多云', tip: '适合写写日记' },
  3: { icon: '☁️', desc: '阴', tip: '适合窝着看书' },
  45: { icon: '🌫', desc: '雾', tip: '注意安全' },
  48: { icon: '🌫', desc: '雾凇', tip: '注意保暖' },
  51: { icon: '🌦', desc: '毛毛雨', tip: '记得带伞' },
  53: { icon: '🌦', desc: '小毛毛雨', tip: '适合听歌' },
  55: { icon: '🌧', desc: '雨', tip: '适合宅家' },
  61: { icon: '🌧', desc: '小雨', tip: '带伞喵' },
  63: { icon: '🌧', desc: '中雨', tip: '别淋湿了' },
  65: { icon: '🌧', desc: '大雨', tip: '别出门啦' },
  71: { icon: '🌨', desc: '小雪', tip: '看雪景' },
  73: { icon: '🌨', desc: '中雪', tip: '注意保暖' },
  75: { icon: '❄️', desc: '大雪', tip: '堆雪人' },
  80: { icon: '🌧', desc: '阵雨', tip: '带伞' },
  81: { icon: '🌧', desc: '强阵雨', tip: '别淋湿' },
  82: { icon: '⛈️', desc: '暴雨', tip: '宅家' },
  95: { icon: '⛈️', desc: '雷雨', tip: '注意安全' },
  96: { icon: '⛈️', desc: '雷雨冰雹', tip: '别出门' },
  99: { icon: '⛈️', desc: '强雷暴', tip: '快回家' }
};

/* ===== 公共：悬浮提示 toast（原 Archives.js / Guestbook.js 各一份，已收敛） ===== */
(function () {
  var tipTimeout = null;
  window.showFloatingTip = function (msg) {
    var tipDiv = document.getElementById('floatingTip');
    if (!tipDiv) {
      tipDiv = document.createElement('div');
      tipDiv.id = 'floatingTip';
      tipDiv.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translatex(-50%);background:#fff0f3;color:#c76f8b;padding:0.5rem 1rem;border-radius:30px;font-size:0.8rem;z-index:1000;border:1px solid #ffc2d4;backdrop-filter:blur(8px);font-family:monospace;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.05);';
      document.body.appendChild(tipDiv);
    }
    tipDiv.innerHTML = '<i class="fas fa-spa"></i> ' + msg;
    tipDiv.style.opacity = '1';
    clearTimeout(tipTimeout);
    tipTimeout = setTimeout(function () {
      if (tipDiv) tipDiv.style.opacity = '0';
    }, 2500);
  };
})();

/* ===== 公共：HTML 转义（原 Guestbook.js 内部实现，已收敛供全站复用） ===== */
window.escapeHtml = function (str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
/* ===== 移动端体验：分享 / 触觉反馈 / 大图 Lightbox（网页+APK 双端受益） ===== */
(function () {
  /* 分享页面：Web Share API 优先，降级复制链接 */
  window.sharePage = function () {
    var url = location.href;
    var title = document.title || 'Tomo Ebizuka';
    function done() { try { if (window.showFloatingTip) showFloatingTip('已复制分享链接喵～'); } catch (e) {} }
    function copy() {
      try {
        navigator.clipboard.writeText(url).then(done, done);
      } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) {}
        ta.remove();
        done();
      }
    }
    if (navigator.share) navigator.share({ title: title, url: url }).catch(function () { copy(); });
    else copy();
  };
  /* 页脚自动注入分享链接（不动各页 HTML） */
  var footer = document.querySelector('footer');
  if (footer) {
    var lnk = document.createElement('a');
    lnk.href = 'javascript:void(0)';
    lnk.className = 'footer-share';
    lnk.onclick = function (e) { e.preventDefault(); window.sharePage(); };
    lnk.innerHTML = '<i class="fas fa-share-nodes"></i> 分享';
    footer.appendChild(lnk);
  }
})();

/* 触觉反馈：触屏设备点击主要控件轻震（移动端手感） */
(function () {
  if (!('vibrate' in navigator) || !('ontouchstart' in window)) return;
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('a, button') : null;
    if (!t) return;
    try { navigator.vibrate(8); } catch (err) {}
  }, true);
})();

/* 大图 Lightbox：点击放大（图片加 class="js-lightbox" 启用） */
(function () {
  var mask = null;
  function close() { if (mask) { mask.remove(); mask = null; } }

  /* ---- 手机端图片查看器（二级页面） ----
     桌面端不参与：open() 里 isNarrow() 为假时直接走回原来的极简 lightbox，
     所以网页端渲染与交互一行都没变。 */
  function viewerGroup() {
    return Array.prototype.slice.call(document.querySelectorAll('img.js-lightbox'));
  }
  function openViewer(src, alt) {
    var api = window.AppShell;
    if (!api || !api.openDetail) return false;
    var imgs = viewerGroup();
    if (!imgs.length) return false;
    var total = imgs.length;
    var idx = 0;
    for (var i = 0; i < total; i++) { if (imgs[i].src === src) { idx = i; break; } }

    var wrap = document.createElement('div');
    wrap.className = 'iv-wrap';
    var big = document.createElement('img');
    big.className = 'iv-img';
    big.src = imgs[idx].src;
    big.alt = imgs[idx].alt || alt || '';
    wrap.appendChild(big);

    var nav = document.createElement('div');
    nav.className = 'iv-nav';
    var prev = document.createElement('button');
    prev.type = 'button'; prev.className = 'iv-arrow iv-prev'; prev.setAttribute('aria-label', '上一张');
    prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
    var next = document.createElement('button');
    next.type = 'button'; next.className = 'iv-arrow iv-next'; next.setAttribute('aria-label', '下一张');
    next.innerHTML = '<i class="fas fa-chevron-right"></i>';
    if (total < 2) { prev.disabled = true; next.disabled = true; }
    nav.appendChild(prev); nav.appendChild(next);
    wrap.appendChild(nav);

    var bar = document.createElement('div');
    bar.className = 'iv-bar';
    var caption = document.createElement('span');
    caption.className = 'iv-cap';
    var save = document.createElement('a');
    save.className = 'iv-btn'; save.setAttribute('download', '');
    save.innerHTML = '<i class="fas fa-download"></i> 保存';
    var raw = document.createElement('a');
    raw.className = 'iv-btn'; raw.target = '_blank'; raw.rel = 'noopener noreferrer';
    raw.innerHTML = '<i class="fas fa-up-right-from-square"></i> 原图';
    var shut = document.createElement('button');
    shut.type = 'button'; shut.className = 'iv-btn iv-close';
    shut.innerHTML = '<i class="fas fa-xmark"></i> 关闭';
    bar.appendChild(caption); bar.appendChild(save); bar.appendChild(raw); bar.appendChild(shut);
    wrap.appendChild(bar);

    var handle;
    function render() {
      var cur = imgs[idx];
      big.src = cur.src;
      big.alt = cur.alt || '';
      save.href = cur.src;
      raw.href = cur.src;
      caption.textContent = cur.alt || '';
      handle.setTitle(total > 1 ? (idx + 1) + ' / ' + total : (cur.alt || '图片'));
    }
    function go(step) { idx = (idx + step + total) % total; render(); }

    handle = api.openDetail({
      title: total > 1 ? (idx + 1) + ' / ' + total : (imgs[idx].alt || '图片'),
      content: wrap,
      swipeClose: true,
      onHorizontal: function (dir) { if (total > 1) go(dir); }
    });
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    shut.addEventListener('click', function () { handle.close(); });
    return true;
  }

  function open(src, alt) {
    /* 手机端交给二级查看器：序号 / 左右切换 / 保存 / 原图 / 下拉关闭 */
    if (window.AppShell && window.AppShell.isNarrow && window.AppShell.isNarrow()
        && openViewer(src, alt)) return;
    if (mask) return;
    mask = document.createElement('div');
    mask.className = 'js-lb-mask';
    var img = document.createElement('img');
    img.className = 'js-lb-img';
    img.src = src;
    if (alt) img.alt = alt;
    mask.appendChild(img);
    mask.addEventListener('click', close);
    document.body.appendChild(mask);
  }
  function bind(img) {
    if (img.classList.contains('js-lb-bound')) return;
    img.classList.add('js-lb-bound');
    img.addEventListener('click', function (e) {
      e.stopPropagation();
      if (img.closest('a')) return;
      /* 详情层里的图已经是全宽展示，再套一层查看器会把当前详情顶掉 */
      if (img.closest('.detail-view')) return;
      open(img.src, img.alt || '');
    });
  }
  function scan() { document.querySelectorAll('img.js-lightbox').forEach(bind); }
  scan();
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();

/* 底部 Tab：当前页高亮（.bot-tab 由各页 HTML 提供，样式在 mobile.css） */
(function () {
  var tabs = document.querySelectorAll('.bot-tab a');
  if (!tabs.length) return;
  var here = location.pathname.split('/').pop() || 'home.html';
  if (here === '') here = 'home.html';
  tabs.forEach(function (a) {
    var href = (a.getAttribute('href') || '').split(/[?#]/)[0];
    if (href === here) a.classList.add('active');
  });
})();

/* ===== 公共：切到后台时停掉装饰性动效 =====
 * 页面不可见时浏览器本来就会节流 rAF，但全屏的粒子/花瓣/光斑/看板娘
 * 仍然占着合成层，手机上就是白耗电。这里只切一个 html.page-hidden，
 * 具体隐藏哪些层由 css/mobile.css 与 css/app.css 决定
 * （桌面端没有对应规则，等于空转，不影响网页端）。
 */
(function () {
  var root = document.documentElement;
  function apply() { root.classList.toggle('page-hidden', !!document.hidden); }
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('pagehide', function () { root.classList.add('page-hidden'); });
  window.addEventListener('pageshow', apply);
  apply();
})();

/* 图标字体（css/all.min.css）是子集：全站用到的 79 个图标没有字形，页面上就是空白
   （影视分类、游戏分类、工具页一批卡片、页脚品牌图标…）。这里挂上内联 SVG 顶替，
   见 js/svg-icon.js —— 换成 currentColor + 1em 的描边 SVG，跟着原字号和文字色走。 */
(function () {
  if (window.SVGIcon) return;
  var s = document.createElement('script');
  s.src = 'js/svg-icon.js' + (window.__DSH_VERSION ? '?v=' + window.__DSH_VERSION : '');
  s.defer = true;
  document.head.appendChild(s);
})();




