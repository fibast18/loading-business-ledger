/* Loading Business Ledger: PWA offline shell v1.0.4
   Caches the self-contained ledger before claiming offline readiness.
   Does NOT cache or sync private ledger records. These stay in localStorage.
*/
'use strict';
const VERSION = '1.0.4';
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

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Required app shell: fail installation if unavailable, never claim offline-ready falsely.
    const response = await fetch(new Request(HOME, { cache: 'reload' }));
    if (!response.ok) throw new Error('Unable to cache index.html (' + response.status + ')');
    await Promise.all([cache.put(HOME, response.clone()), cache.put(ROOT, response.clone())]);
    // Logos/icons are optional: do not break offline installation if absent from the repository.
    await Promise.all(STATIC_FILES.map(async filename => {
      const url = new URL(filename, BASE).href;
      try {
        const result = await fetch(new Request(url, { cache: 'reload' }));
        if (result.ok) await cache.put(url, result);
      } catch (_) { /* optional asset */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function serveDocument(request) {
  // Prefer current online content for easy GitHub Pages upgrades; fall back to cached HTML.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 3500);
  try {
    const result = await fetch(request, { signal: abort.signal });
    if (result.ok && result.type !== 'opaque') {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, result.clone()).catch(() => {});
      // Keep the canonical home URL cached even when using a Pages directory URL.
      await cache.put(HOME, result.clone()).catch(() => {});
    }
    return result;
  } catch (_) {
    const cached = await caches.match(request, { ignoreSearch: true })
      || await caches.match(HOME) || await caches.match(ROOT);
    return cached || new Response('The ledger has not yet been installed for offline use. Connect once and open the app.',
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith(serveDocument(request));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
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
