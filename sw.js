// Auto-expiring service worker that purges old caches
const CACHE_NAME = 'subway-runner-v3d';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Always fetch latest from network to prevent stale cached versions
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
