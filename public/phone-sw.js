// Cache only the public phone shell, never API responses, keys or messages.
const shell=['/phone.html','/phone.js','/crypto.js','/vendor/scan.js','/style.css','/app-icon.png','/phone.webmanifest'],cacheName='sv-phone-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(cacheName).then(c=>c.addAll(shell)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||url.search||!shell.includes(url.pathname))return;event.respondWith(fetch(event.request,{cache:'no-store'}).then(async r=>{if(r.ok){const c=await caches.open(cacheName);await c.put(event.request,r.clone());}return r;}).catch(()=>caches.match(url.pathname)));});
