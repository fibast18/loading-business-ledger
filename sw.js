/* Loading Business Ledger v1.0.6: offline shell only, no data operations. */
'use strict';
const VERSION = '1.0.6';
const CACHE = 'loading-business-ledger-shell-v'+VERSION;
const PREFIX = 'loading-business-ledger-shell-v';
const BASE = new URL('./',self.registration.scope);
const HOME = new URL('index.html',BASE).href;
const ROOT = BASE.href;
const ASSETS = [
  'manifest.webmanifest','offline-icon-192.png','offline-icon-512.png',
  'favicon.svg','apple-touch-icon.png','rico-logo.png',
  'globe-logo.svg','smart-logo.svg','gcash-logo.svg'
];
async function saveHome(){
  const cache=await caches.open(CACHE);
  let reply;
  try { reply=await fetch(HOME,{cache:'no-store'}); }
  catch (_) { reply=await fetch(ROOT,{cache:'no-store'}); }
  if (!reply.ok || reply.type==='opaque') {
    // Some hosts rewrite /index.html; try root for fallback.
    reply=await fetch(ROOT,{cache:'no-store'});
  }
  if (!reply.ok || reply.type==='opaque') throw new Error('Cannot cache application HTML');
  await cache.put(HOME,reply.clone());
  await cache.put(ROOT,reply.clone());
  // Missing optional images must never stop installation on iOS.
  await Promise.all(ASSETS.map(async file=>{
    const url=new URL(file,BASE).href;
    const timerController=new AbortController();
    const stop=setTimeout(()=>timerController.abort(),2500);
    try {
      const response=await fetch(url,{signal:timerController.signal});
      if(response.ok && response.type!=='opaque') await cache.put(url,response);
    }catch(_){} finally{clearTimeout(stop);}
  }));
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{await saveHome();await self.skipWaiting();})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    // Never touch localStorage/IndexedDB or unrelated caches.
    for(const name of await caches.keys()) {
      if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data && event.data.type==='LEDGER_OFFLINE_STATUS' && event.ports && event.ports[0]) {
    event.waitUntil((async()=>{
      let cached=false;
      try {const c=await caches.open(CACHE);const x=await c.match(HOME);cached=!!(x&&x.ok);}catch(_){}
      event.ports[0].postMessage({version:VERSION,cached});
    })());
  }
});
async function documentResponse(req){
  const saved=await caches.match(req,{ignoreSearch:true})||await caches.match(HOME)||await caches.match(ROOT);
  // Truly offline? Avoid holding up a Home Screen launch for the network timeout.
  if(self.navigator && self.navigator.onLine===false && saved)return saved;
  const ctrl=new AbortController();
  const stop=setTimeout(()=>ctrl.abort(),2500);
  try {
    const response=await fetch(req,{signal:ctrl.signal});
    if(response.ok && response.type!=='opaque') {
      const c=await caches.open(CACHE);
      await c.put(HOME,response.clone());
      await c.put(req,response.clone());
    }
    return response;
  }catch(e){
    return saved||new Response('Offline installation incomplete. Connect once to install.',{
      status:503,headers:{'content-type':'text/plain; charset=utf-8'}
    });
  }finally{clearTimeout(stop);}
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(req.mode==='navigate'){event.respondWith(documentResponse(req));return;}
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try {
      const response=await fetch(req);
      if(response.ok&&response.type!=='opaque'){
        const c=await caches.open(CACHE);await c.put(req,response.clone()).catch(()=>{});
      }
      return response;
    }catch(e){return new Response('',{status:504,statusText:'Offline'});}
  })());
});
