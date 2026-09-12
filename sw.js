/* ============================================================
 * Service Worker (sw.js)
 * ------------------------------------------------------------
 * 缓存策略：
 *   1. 导航请求（HTML）      -> network-first：部署后立刻可见，离线回退缓存
 *   2. 同源静态资源          -> stale-while-revalidate：先给缓存，后台更新
 *   3. 动态数据（带时间戳）   -> 只走网络，绝不写缓存（避免缓存无限膨胀）
 *   4. 跨域请求              -> 直接放行，交给浏览器
 *
 * 版本号：CORE 里的 ?v= 由 VERSION 生成，必须与 js/version.js 的
 * __DSH_VERSION 以及各 HTML 里的 ?v= 保持一致。
 * 统一更新请执行： python scripts/bump_version.py <新版本号>
 * ============================================================ */
const VERSION = '20260932';
const CACHE = 'king-blog-' + VERSION;

const CORE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css?v=' + VERSION,
  '/css/sidebar.css?v=' + VERSION,
  '/css/all.min.css?v=' + VERSION,
  '/css/index.css?v=' + VERSION,
  '/css/Journal.css?v=' + VERSION,
  '/css/Archives.css?v=' + VERSION,
  '/css/Guestbook.css?v=' + VERSION,
  '/css/music.css?v=' + VERSION,
  '/css/anim.css?v=' + VERSION,
  '/css/Tools.css?v=' + VERSION,
  '/css/mobile.css?v=' + VERSION,
  '/js/version.js?v=' + VERSION,
  '/js/common.js?v=' + VERSION,
  '/js/sidebar.js?v=' + VERSION,
  '/js/particles-config.js?v=' + VERSION,
  '/js/anim.js?v=' + VERSION,
  '/js/music-fx.js?v=' + VERSION,
  '/js/live2d-sing.js?v=' + VERSION,

  /* 各页面自身的控制器脚本：体积小，全部预缓存，保证离线可用 */
  '/js/index.js?v=' + VERSION,
  '/js/Journal.js?v=' + VERSION,
  '/js/Archives.js?v=' + VERSION,
  '/js/Guestbook.js?v=' + VERSION,
  '/js/Tools.js?v=' + VERSION,
  '/js/live2d-fix.js?v=' + VERSION,
  '/js/music-api.js?v=' + VERSION,
  '/js/vendor/canvas-confetti.browser.min.js?v=' + VERSION,
  '/css/giscus-theme.css?v=' + VERSION,
  /* 注意：js/music-bundle.js (547KB) 与 js/vendor/lunar.js (434KB) 体积过大，
     故意不预缓存，改由 stale-while-revalidate 在首次访问对应页面时按需缓存 */
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

/* 这些路径是动态数据，永不入缓存 */
const NEVER_CACHE = ['/data/bili/stats.json', '/data/playlist.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(request, response) {
  if (!response || !response.ok) return;
  const copy = response.clone();
  caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
}

function isDynamic(url) {
  /* 带时间戳的强刷请求（?t=...）一律只走网络：每次时间戳都不同 = 新的缓存 key，
     否则 Cache Storage 会被无限撑大。 */
  if (url.searchParams.has('t')) return true;
  return NEVER_CACHE.some((p) => url.pathname === p || url.pathname.endsWith(p));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* 跨域（API、CDN、Live2D 等）交给浏览器默认行为 */
  if (url.origin !== self.location.origin) return;

  /* ---- 1. 导航：network-first ---- */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { putInCache(req, res); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  /* ---- 2. 动态数据：只走网络 ---- */
  if (isDynamic(url)) {
    e.respondWith(fetch(req));
    return;
  }

  /* ---- 3. 静态资源：stale-while-revalidate ---- */
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => { putInCache(req, res); return res; })
        .catch(() => hit);
      return hit || network;
    })
  );
});
