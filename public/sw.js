const BASE = '/loading-business-ledger/';
const CACHE = 'loading-ledger-local-v1';
const APP_SHELL = [BASE, `${BASE}manifest.webmanifest`, `${BASE}rico-logo.png`, `${BASE}globe-logo.svg`, `${BASE}smart-logo.svg`, `${BASE}gcash-logo.svg`, `${BASE}icon-192.png`, `${BASE}icon-512.png`, `${BASE}apple-touch-icon.png`];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const refresh = fetch(event.request).then(response => { if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone())); return response; }).catch(() => cached || caches.match(BASE));
    if (cached) { event.waitUntil(refresh.then(() => undefined)); return cached; }
    return refresh;
  })());
});
