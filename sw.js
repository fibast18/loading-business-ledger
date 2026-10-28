/* Loading Business Ledger v1.0.5 offline PWA worker.
   Ledger records stay on-device in localStorage; this caches only app files.
*/
'use strict';
const VERSION = '1.0.5';
const CACHE_NAME = 'loading-business-ledger-shell-v' + VERSION;
const CACHE_PREFIX = 'loading-business-ledger-shell-v';
const BASE = new URL('./', self.registration.scope);
const HOME = new URL('index.html', BASE).href;
const ROOT = BASE.href;
const STATIC_FILES = [
  'manifest.webmanifest', 'offline-icon-192.png', 'offline-icon-512.png',
  'favicon.svg', 'apple-touch-icon.png', 'rico-logo.png',
  'globe-logo.svg', 'smart-logo.svg', 'gcash-logo.svg'
];
async function offlineShellCached() {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(HOME);
  return !!(response && response.ok);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Store application HTML before activation, so offline navigation has a true fallback.
    const response = await fetch(HOME, {cache:'reload'});
    if (!response.ok) throw new Error('index.html cannot be cached: HTTP ' + response.status);
    await cache.put(HOME, response.clone());
    await cache.put(ROOT, response.clone());
    // Optional icons and logos should never hold installation indefinitely.
    await Promise.all(STATIC_FILES.map(async filename => {
      const url = new URL(filename, BASE).href;
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 3000);
      try {
        const asset = await fetch(url, {cache:'reload', signal:abort.signal});
        if (asset.ok && asset.type !== 'opaque') await cache.put(url, asset);
      } catch (_) { /* optional file absent, timeout, or offline */ }
      finally {clearTimeout(timer);}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const old = await caches.keys();
    await Promise.all(old.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'LEDGER_OFFLINE_STATUS' && event.ports && event.ports[0]) {
    event.waitUntil((async () => {
      const cached = await offlineShellCached().catch(() => false);
      event.ports[0].postMessage({version: VERSION, cached: cached});
    })());
  }
});
async function documentResponse(request) {
  // Instant offline launch: return cached HTML first, update in the background only online.
  const stored = await caches.match(request, {ignoreSearch:true})
      || await caches.match(HOME) || await caches.match(ROOT);
  if (stored) {
    if (self.navigator && self.navigator.onLine) {
      // Do not block navigation on flaky / slow connections.
      fetch(request).then(async response => {
        if (response && response.ok && response.type !== 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
          await cache.put(HOME, response.clone());
        }
      }).catch(() => {});
    }
    return stored;
  }
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
      await cache.put(HOME, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('Offline installation is incomplete. Open once with internet to install.',
      {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (request.mode === 'navigate') {event.respondWith(documentResponse(request));return;}
  event.respondWith((async () => {
    const stored = await caches.match(request, {ignoreSearch:true});
    if (stored) return stored;
    try {
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      return new Response('', {status:504,statusText:'Offline'});
    }
  })());
});
