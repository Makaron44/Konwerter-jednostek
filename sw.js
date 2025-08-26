const CACHE_NAME = 'unitconv-cache-v10';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// Install
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

// Activate – clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Fetch – cache-first for same-origin; network-first for rate APIs
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isApi = url.hostname.includes('exchangerate.host');

  if (isApi) {
    // network-first for fresh rates
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // cache-first for app shell
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      // only cache GET and same-origin
      if (e.request.method === 'GET' && url.origin === location.origin) {
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});