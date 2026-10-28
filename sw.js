/* Loading Business Ledger v1.0.7 - complete, same-origin offline app shell.
   No access to localStorage, IndexedDB, or business transaction data. */
'use strict';
const VERSION = '1.0.7';
const CACHE = 'loading-business-ledger-shell-v'+VERSION;
const PREFIX = 'loading-business-ledger-shell-v';
const BASE = new URL('./',self.registration.scope);
const HOME = new URL('index.html',BASE).href;
const ROOT = BASE.href;
// This ZIP contains EVERY asset. An incomplete upload must fail explicitly.
const ASSETS = [
  'index.html','manifest.webmanifest','offline-icon-192.png','offline-icon-512.png',
  'favicon.svg','apple-touch-icon.png','rico-logo.png',
  'globe-logo.svg','smart-logo.svg','gcash-logo.svg'
];
async function cacheAll(){
  const cache=await caches.open(CACHE);
  await Promise.all(ASSETS.map(async file=>{
    const url=new URL(file,BASE).href;
    const controller=new AbortController();
    const cancel=setTimeout(()=>controller.abort(),9000);
    try{
      const reply=await fetch(url,{cache:'reload',signal:controller.signal});
      if(!reply.ok||reply.type==='opaque'){
        throw new Error('Missing offline file: '+file+' (HTTP '+reply.status+')');
      }
      await cache.put(url,reply);
    }finally{clearTimeout(cancel);}
  }));
  const index=await cache.match(HOME);
  if(!index||!index.ok)throw new Error('index.html not cached');
  await cache.put(ROOT,index.clone());
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{await cacheAll();await self.skipWaiting();})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys()){
      if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='LEDGER_OFFLINE_STATUS'&&event.ports&&event.ports[0]){
    event.waitUntil((async()=>{
      let cached=false;
      try{const cache=await caches.open(CACHE);const entry=await cache.match(HOME);cached=!!(entry&&entry.ok);}catch(_){ }
      event.ports[0].postMessage({version:VERSION,cached});
    })());
  }
});
async function getDocument(request){
  const cache=await caches.open(CACHE);
  const saved=(await cache.match(request,{ignoreSearch:true}))||
              (await cache.match(HOME))||(await cache.match(ROOT));
  if(self.navigator&&self.navigator.onLine===false&&saved)return saved;
  const controller=new AbortController();
  const cancel=setTimeout(()=>controller.abort(),2200);
  try{
    const live=await fetch(request,{signal:controller.signal});
    if(live.ok&&live.type!=='opaque'){
      // A newer app shell is picked up on the next normal visit/update.
      await cache.put(request,live.clone());
      if(new URL(request.url).pathname===BASE.pathname){
        await cache.put(HOME,live.clone());
      }
      return live;
    }
    return saved||live;
  }catch(_){
    return saved||new Response('Offline application not yet installed. Connect once to install.',{
      status:503,headers:{'content-type':'text/plain; charset=utf-8'}
    });
  }finally{clearTimeout(cancel);}
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE.pathname))return;
  if(req.mode==='navigate'){event.respondWith(getDocument(req));return;}
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const saved=await cache.match(req,{ignoreSearch:true});
    if(saved)return saved;
    try{
      const live=await fetch(req);
      if(live.ok&&live.type!=='opaque')await cache.put(req,live.clone());
      return live;
    }catch(_){return new Response('Unavailable offline',{status:504});}
  })());
});
