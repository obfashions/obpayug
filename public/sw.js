const CACHE_VERSION = "v2";
const CACHE_NAME = `obpay-cache-${CACHE_VERSION}`;

const PRECACHE_URLS = ["/", "/manifest.json"];

function isAsset(req) {
  const url = new URL(req.url);
  return (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp)$/i) ||
    url.pathname.startsWith("/assets/")
  );
}

function isPage(req) {
  return req.mode === "navigate";
}

// Install: precache the shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: purge old caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for pages & JS/CSS (always fresh), cache-first for static assets
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const req = event.request;

  // Pages: network-first so HTML is always fresh
  if (isPage(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const cloned = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // JS & CSS: network-first — never serve stale code
  if (isAsset(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const cloned = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, cloned));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Everything else (images, fonts, API responses): cache-first, fallback to network
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});