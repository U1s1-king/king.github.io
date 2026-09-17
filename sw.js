/* ============================================================
 * Service Worker (sw.js)
 * ------------------------------------------------------------
 * 缓存策略：
 *   1. 导航请求（HTML）      -> network-first：部署后立刻可见，离线回退缓存
 *   2. 同源静态资源          -> stale-while-revalidate：先给缓存，后台更新
 *   3. 动态数据（带时间戳）   -> 只走网络，绝不写缓存（避免缓存无限膨胀）
 *   4. 跨域请求              -> 直接放行，交给浏览器
 *   5. 同源 /api/*           -> 只走网络（影视门卫接口，一旦被缓存就等于绕过鉴权）
 *
 * 版本号：CORE 里的 ?v= 由 VERSION 生成，必须与 js/version.js 的
 * __DSH_VERSION 以及各 HTML 里的 ?v= 保持一致。
 * 统一更新请执行： python scripts/bump_version.py <新版本号>
 * ============================================================ */
const VERSION = '20261202'
const CACHE = 'king-blog-' + VERSION;

const CORE = [
  '/',
  '/index.html',
  '/home.html',
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
  '/css/app.css?v=' + VERSION,
  '/js/version.js?v=' + VERSION,
  '/js/app-shell.js?v=' + VERSION,
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
  '/js/shell.js?v=' + VERSION,
  '/js/music-app.js?v=' + VERSION,
  '/js/journal-app.js?v=' + VERSION,
  '/js/archives-app.js?v=' + VERSION,
  '/js/tools-app.js?v=' + VERSION,
  '/js/guestbook-app.js?v=' + VERSION,
  '/js/live2d-app.js?v=' + VERSION,
  '/js/music-plus.js?v=' + VERSION,
  '/js/vendor/canvas-confetti.browser.min.js?v=' + VERSION,
  '/js/anim-lib.js?v=' + VERSION,
  '/css/giscus-theme.css?v=' + VERSION,
  /* 注意：以下文件体积过大、或本来就只在空闲时段按需加载，故意不预缓存，
     改由 stale-while-revalidate 在首次访问对应页面时按需缓存：
       js/music-bundle.js (547KB)
       js/vendor/lunar.js (434KB)
       js/vendor/anime.min.js (17KB)
       js/vendor/vivus.min.js (12.5KB)
     后两个由 js/anim.js 在 load 之后的空闲时段才拉起，本就不在首屏关键路径上，
     预缓存只会把 30KB 塞进 Service Worker 的安装阶段，得不偿失。 */
  '/icons/icon-192.png',
  '/icons/icon-512.png',
    /* TV.html 故意【不预缓存】：它现在挂在 Cloudflare Worker 门卫（cloudflare/tv-gate）
       后面，未登录时返回的是登录页。而 addAll() 只要碰到一个非 200 ——
       门卫 fail-closed 时正是 503 —— 就会让整个 Service Worker 安装失败，
       把全站离线缓存一起拖下水。它按需走网络即可。 */
    '/Games.html?v=' + VERSION,
    '/css/hub.css?v=' + VERSION,
    '/css/tools-plus.css?v=' + VERSION,
    '/css/tv.css?v=' + VERSION,
    '/js/tv.js?v=' + VERSION,
    '/js/games.js?v=' + VERSION,
    '/js/tools-hub.js?v=' + VERSION,
    '/js/tools-extra.js?v=' + VERSION,
];

/* 这些路径是动态数据，永不入缓存 */
const NEVER_CACHE = ['/data/bili/stats.json', '/data/playlist.json'];

/* 门卫（Cloudflare Worker tv-gate）后面的页面，绝不入缓存。
   这里缓存到的是「已登录」的 HTML —— 等于在本地留一份能绕开门卫的副本，
   而且 Cache Storage 不随浏览会话清除，关掉浏览器它还在。 */
const GATED = ['/TV.html', '/TV'];

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

  /* ---- 0. 同源 API：绝不入缓存 ---- */
  /* tv-gate 门卫把影视接口搬到了同源 /api/tv*。不在这里拦掉的话，
     它们会掉进下面的 stale-while-revalidate 分支被缓存 ——
     那等于「关掉浏览器后还能从缓存里白拿数据」，本地把门卫绕过去了。 */
  if (url.pathname.indexOf('/api/') === 0) {
    e.respondWith(fetch(req));
    return;
  }

  /* ---- 1. 导航：network-first ---- */
  if (req.mode === 'navigate') {
    /* 门卫后面的页面：既不缓存，网络失败时也绝不拿旧副本兜底 ——
       缓存里那份是「已登录」的页面，拿出来就等于本地绕过了门卫。
       宁可让浏览器老老实实报网络错误。 */
    if (GATED.indexOf(url.pathname) >= 0) {
      e.respondWith(fetch(req));
      return;
    }
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
