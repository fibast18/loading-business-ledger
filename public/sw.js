const CACHE = 'loading-ledger-v4'; const APP_SHELL = ['/', '/manifest.webmanifest', '/rico-logo.png', '/globe-logo.svg', '/smart-logo.svg', '/gcash-logo.svg', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const refresh = fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => cached || caches.match('/'));
    // Show the cached app immediately; refresh it in the background when available.
    if (cached) { event.waitUntil(refresh.then(() => undefined)); return cached; }
    return refresh;
  })());
});
