const VERSION='5.2.0';
const SHELL='senecompare-shell-'+VERSION;
const RUNTIME='senecompare-runtime-'+VERSION;
const PRECACHE=[
  '/',
  '/styles.css?v=5.2.0',
  '/app.js?v=5.2.0',
  '/premium-v51.css?v=5.1.0',
  '/premium-v51.js?v=5.1.0',
  '/future-v52.css?v=5.2.0',
  '/future-v52.js?v=5.2.0',
  '/manifest.webmanifest?v=5.2.0',
  '/icon-192.png?v=5.2.0',
  '/icon-512.png?v=5.2.0',
  '/maskable-512.png?v=5.2.0',
  '/apple-touch-icon.png?v=5.2.0'
];
self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(PRECACHE)).catch(()=>{}));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('senecompare-')&&![SHELL,RUNTIME].includes(key)).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/__')){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(SHELL).then(cache=>cache.put('/',copy)));}
      return response;
    }).catch(()=>caches.match('/')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(RUNTIME).then(cache=>cache.put(request,copy)));}
      return response;
    });
    return cached||network;
  }));
});
