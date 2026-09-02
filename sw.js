const CACHE = "king-blog-20260905";
const CORE = ["/", "/index.html", "/manifest.json", "/css/style.css?v=20260905", "/css/sidebar.css?v=20260905", "/css/all.min.css?v=20260905", "/css/index.css?v=20260905", "/css/Journal.css?v=20260905", "/css/Archives.css?v=20260905", "/css/Guestbook.css?v=20260905", "/css/music.css?v=20260905", "/css/Tools.css?v=20260905", "/css/mobile.css?v=20260905", "/js/version.js?v=20260905", "/js/common.js?v=20260905", "/js/sidebar.js?v=20260905", "/js/particles-config.js", "/icons/icon-192.png", "/icons/icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok && e.request.url.startsWith(self.location.origin)) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match("/index.html")))
  );
});