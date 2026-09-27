import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import jsQR from 'jsqr';
import {fixture,password} from './helpers.mjs';
const f=await fixture();let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const pc=await browser.newContext(),phone=await browser.newContext({viewport:{width:390,height:844}}),p=await pc.newPage(),m=await phone.newPage(),errors=[];
 for(const page of [p,m])page.on('pageerror',e=>errors.push(e.message));
 await p.goto(f.origin);await p.locator('#password').fill(password);await p.locator('#login-button').click();await p.locator('#pair-name').fill('iPhone QR test');
 assert.equal(await p.locator('#pair-mode').inputValue(),'native');await p.locator('#create-pair').click();await expect(p.locator('#pair-result')).toBeVisible();
 const nativePNG=PNG.sync.read(await p.locator('#pair-canvas').screenshot()),nativeQR=jsQR(new Uint8ClampedArray(nativePNG.data),nativePNG.width,nativePNG.height),nativeURL=new URL(nativeQR.data);
 assert.equal(nativeURL.protocol,'securevault:');assert.equal(nativeURL.hostname,'remote');assert.equal(nativeURL.searchParams.get('endpoint'),f.origin);assert.equal(nativeURL.searchParams.get('write_token').length,43);assert.equal(nativeURL.searchParams.has('readToken'),false);assert.equal(nativeURL.searchParams.has('password'),false);
 await expect(p.locator('#pair-status')).toContainText('Không cần cài thêm app web');await p.locator('#close-pair').click();await p.locator('#pair-mode').selectOption('web');
 const posted=p.waitForRequest(r=>r.url().endsWith('/api/web/pair'));await p.locator('#create-pair').click();await expect(p.locator('#pair-result')).toBeVisible();const request=(await posted).postDataJSON();
 assert.equal('password'in request,false);assert.equal('encryptionKey'in request,false);assert.equal('macKey'in request,false);
 const png=PNG.sync.read(await p.locator('#pair-canvas').screenshot()),qr=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);assert.ok(qr);const url=new URL(qr.data);assert.equal(url.origin,f.origin);assert.equal(url.pathname,'/phone.html');assert.ok(!url.search);assert.ok(!qr.data.includes(request.readToken));
 let claimed=false;await m.route('**/claim',async route=>{if(!claimed){claimed=true;await route.fetch();await route.abort();}else await route.continue();});
 await m.goto(qr.data);await expect(m.locator('#phone-status')).toContainText('kiểm tra mạng');assert.equal(new URL(m.url()).hash,'');
 // Lost first response: same saved device identity claims again, without QR.
 await m.reload();await expect(m.locator('#phone-status')).toContainText('Đã kết nối');await m.unroute('**/claim');
 const device=(await f.store.devices())[0];assert.equal((await f.store.devices()).length,1);
 await m.locator('#sender').fill('Test sender');await m.locator('#text').fill('Online OTP 246810');const delivery=m.waitForResponse(r=>r.url().endsWith('/messages'));await m.locator('#send').click();assert.equal((await delivery).status(),200);await expect(m.locator('#queue')).toContainText('0 tin');
 assert.equal((await f.store.list(device.channelId,request.readToken,f.now,true)).messages.length,1);
 // Reload web (fresh password required), discovers the phone and decrypts content.
 await p.reload();await p.locator('#password').fill(password);await p.locator('#login-button').click();await expect(p.locator('.text')).toContainText('246810');
 await expect(m.locator('#text')).toHaveValue('');assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await m.evaluate(async()=>{await navigator.serviceWorker.ready;});
 // Offline shell, encrypted durable queue, update/reload preserves device keys.
 await phone.setOffline(true);await m.reload();await expect(m.locator('#send')).toBeEnabled();await m.locator('#text').fill('Offline pending 135790');await m.locator('#send').click();await expect(m.locator('#queue')).toContainText('1 tin');
 const saved=await m.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('sv-phone-v1');r.onsuccess=()=>{const tx=r.result.transaction('state'),q=tx.objectStore('state').get('outbox');q.onsuccess=()=>resolve(q.result);};r.onerror=reject;}));assert.equal(JSON.stringify(saved).includes('135790'),false);
 const m2=await phone.newPage();await m2.goto(f.origin+'/phone.html');await expect(m2.locator('#send')).toBeEnabled();
 await m.locator('#text').fill('Concurrent A 111111');await m2.locator('#text').fill('Concurrent B 222222');await Promise.all([m.locator('#send').click(),m2.locator('#send').click()]);await expect(m.locator('#text')).toHaveValue('');await expect(m2.locator('#text')).toHaveValue('');
 assert.equal(await m.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('sv-phone-v1');r.onsuccess=()=>{const q=r.result.transaction('state').objectStore('state').get('outbox');q.onsuccess=()=>resolve(q.result.length);};})),3);await m2.close();
 await phone.setOffline(false);await m.reload();await expect(m.locator('#queue')).toContainText('0 tin');assert.equal((await f.store.devices())[0].deviceId,device.deviceId);assert.equal((await f.store.devices()).length,1);
 await m.locator('#update').click();await expect(m.locator('#phone-status')).toContainText('Đã kết nối');assert.equal((await f.store.devices()).length,1);assert.equal((await f.store.list(device.channelId,request.readToken,f.now,true)).messages.length,4);
 await m.screenshot({path:'test-results/phone-online.png',fullPage:true});await p.locator('#create-pair').click();await expect(p.locator('#pair-result')).toBeVisible();await p.locator('#lock').click();await expect(p.locator('#pair-result')).toBeHidden();
 const release=await (await fetch(f.origin+'/api/public/release')).json(),ipa=Buffer.from(await (await fetch(release.ios.downloadURL)).arrayBuffer());assert.equal(createHash('sha256').update(ipa).digest('hex'),release.ios.sha256);
 const feed=await(await fetch(f.origin+'/altstore-source.json')).json();assert.equal(feed.apps[0].versions[0].size,ipa.length);assert.equal(feed.apps[0].versions[0].buildVersion,String(release.ios.build));
 await m.goto(f.origin+'/download');await expect(m.getByRole('link',{name:'Mở app iPhone online'})).toBeVisible();assert.deepEqual(errors,[]);
 console.log('PASS: browser QR decoded, password/key privacy, lost claim retry, persistent phone identity, encrypted offline queue, reload/update preservation, chat decryption, responsive PWA, download checksum and source size');
}finally{await browser?.close();await f.close();}
