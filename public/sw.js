/* Times Bay Area service worker: offline-tolerant shell + image caching. */
const VERSION = "tba-v1";
const IMAGE_CACHE = `${VERSION}-images`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;
const IMAGE_LIMIT = 120;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((k) => cache.delete(k)));
}

async function cacheFirst(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) {
    await cache.put(request, response.clone());
    if (limit) trim(cacheName, limit);
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Never cache API calls, server functions, auth or the editorial desks.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    url.searchParams.has("_serverFn") ||
    /\/(desk|command-center|luxedesk|auth)(\/|$)/.test(url.pathname)
  ) {
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, IMAGE_LIMIT).catch(() => fetch(request)));
    return;
  }

  if (url.origin === self.location.origin && /\.(js|css|woff2?|png|svg|ico)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)));
    return;
  }

  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});
