const VERSION = '4.0.0';
const SHELL_CACHE = `senecompare-shell-${VERSION}`;
const RUNTIME_CACHE = `senecompare-runtime-${VERSION}`;
const SHELL = [
  '/',
  '/styles.css?v=4.0.0',
  '/app.js?v=4.0.0',
  '/manifest.webmanifest?v=4.0.0',
  '/icon.svg?v=4.0.0'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('senecompare-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => new Response(JSON.stringify({ ok: false, error: 'offline' }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put('/', copy)));
          }
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && ['style', 'script', 'image', 'manifest'].includes(request.destination)) {
        const copy = response.clone();
        event.waitUntil(caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)));
      }
      return response;
    }))
  );
});
