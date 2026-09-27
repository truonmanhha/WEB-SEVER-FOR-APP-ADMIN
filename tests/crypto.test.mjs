import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {viewer,wrap,unwrap,decryptMessage,decode} from '../public/crypto.js';
import {encrypted,password} from './helpers.mjs';
const v={version:1,endpoint:'https://isolated.invalid',channelId:randomUUID(),readToken:'A'.repeat(43),encryptionKey:'B'.repeat(42)+'A',macKey:'C'.repeat(42)+'A'},device=randomUUID();
test('shared Node/.NET/iOS protocol fixture decrypts in browser crypto',async()=>{
 const f=JSON.parse(await readFile(new URL('./crypto-fixture.json',import.meta.url),'utf8'));
 assert.equal((await decryptMessage(f.envelope,{...v,...f},'12345678-1234-1234-1234-123456789abc',1800000001)).text,'Xin chào — 123456');
});
test('encrypted viewer credentials authenticate password and AES-GCM integrity',async()=>{
 viewer(v,v.endpoint);const w=await wrap(v,password);assert.ok(!JSON.stringify(w).includes(v.readToken));assert.deepEqual(await unwrap(w,password,v.endpoint),v);
 await assert.rejects(unwrap(w,'wrong',v.endpoint));await assert.rejects(unwrap({...w,ciphertext:'A'.repeat(100)},password,v.endpoint));
 assert.throws(()=>viewer(v,'https://other.invalid'));assert.throws(()=>decode('B'.repeat(43),32,32));
});
test('v2 HMAC checked before AES-CBC, binds channel, metadata, device and expiry',async()=>{
 const now=Math.floor(Date.now()/1000),e=encrypted({...v,deviceId:device},'Code 123456',now);
 assert.equal((await decryptMessage(e,v,device,now)).text,'Code 123456');
 await assert.rejects(decryptMessage({...e,mac:'A'.repeat(43)},v,device,now));await assert.rejects(decryptMessage(e,{...v,channelId:randomUUID()},device,now));
 await assert.rejects(decryptMessage(e,v,randomUUID(),now));await assert.rejects(decryptMessage(e,v,device,e.expiresAt));await assert.rejects(decryptMessage({...e,createdAt:now-1,expiresAt:e.expiresAt-1},v,device,now));
});
