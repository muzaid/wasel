// Minimal service worker: makes the app installable and caches the shell for offline start.
const CACHE = "wasel-v1";
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/icon.svg", "/manifest.json"]))); self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/"))));
});
