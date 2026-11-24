// Network-First Service Worker for Urban Dash 3D PWA
const CACHE_NAME = 'urbandash-v23-jump-fix-hoverboard-mystery';

const CORE_ASSETS = [
  './manifest.json',
  './libs/three.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Always bypass cache for index.html, game.js, style.css, audio.js to guarantee fresh updates
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  if (url.includes('index.html') || url.includes('game.js') || url.includes('style.css') || url.includes('audio.js') || url.endsWith('/neon-runner/')) {
    e.respondWith(
      fetch(e.request)
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
