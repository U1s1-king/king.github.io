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
if (document.readyState === 'complete') { done(); }
else { window.addEventListener('load', done); }
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
(function () {
var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
if (isMobile || !window.matchMedia('(pointer: fine)').matches) return;
document.body.classList.add('custom-cursor');
var cur = document.createElement('div');
cur.id = 'sakura-cursor';
cur.innerHTML = '🌸';
document.body.appendChild(cur);
var cx = -100, cy = -100, tx = -100, ty = -100;
(function loop() {
cx += (tx - cx) * 0.32;
cy += (ty - cy) * 0.32;
cur.style.left = cx + 'px';
cur.style.top = cy + 'px';
requestAnimationFrame(loop);
})();
var last = 0;
document.addEventListener('mousemove', function (e) {
tx = e.clientX; ty = e.clientY;
var now = Date.now();
if (now - last < 28) return;
last = now;
var p = document.createElement('div');
p.className = 'sakura-tail';
p.innerHTML = '🌸';
p.style.left = (e.clientX + (Math.random() - 0.5) * 14) + 'px';
p.style.top = (e.clientY + (Math.random() - 0.5) * 14) + 'px';
var size = 9 + Math.random() * 11;
p.style.fontSize = size.toFixed(1) + 'px';
p.style.setProperty('--dx', ((Math.random() - 0.5) * 90).toFixed(0) + 'px');
p.style.setProperty('--dy', (35 + Math.random() * 70).toFixed(0) + 'px');
p.style.setProperty('--dr', ((Math.random() - 0.5) * 240).toFixed(0) + 'deg');
document.body.appendChild(p);
setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 1150);
});
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
  function desiredCount() { return window.innerWidth < 700 ? 28 : 45; }
  var petalCount = desiredCount();
  function spawn(n) { for (var i = 0; i < n; i++) flurryContainer.appendChild(createPetal()); }
  spawn(petalCount);
  function replenishPetals() {
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
/* ===== 公共：Service Worker 注册（原各页面 JS 各自注册一份，已收敛，统一由本文件注册） ===== */
(function () {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(function(){});
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
    elem.setAttribute('data-placeholder-hint', '占位符区域，请替换为个人内容');
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
    tipDiv.innerHTML = '<i class="fas fa-cherry-blossom"></i> ' + msg;
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
  function open(src, alt) {
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
  var here = location.pathname.split('/').pop() || 'index.html';
  if (here === '') here = 'index.html';
  tabs.forEach(function (a) {
    var href = (a.getAttribute('href') || '').split(/[?#]/)[0];
    if (href === here) a.classList.add('active');
  });
})();




