import {PGlite} from '@electric-sql/pglite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {scryptSync,randomBytes,randomUUID,createCipheriv,createHmac} from 'node:crypto';
import {RelayStore} from '../lib/store.mjs';
import {createApp} from '../server.mjs';
export const password='isolated-test-password',adminToken=randomBytes(32).toString('base64url');
const salt=randomBytes(16).toString('hex');
export const passwordHash='scrypt$32768$'+salt+'$'+scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:67108864}).toString('hex');
export async function database(directory){
 const db=new PGlite(directory);await db.waitReady;
 // PGlite is a single-connection PostgreSQL engine. Serialize transactions; it
 // has no concurrent backends or advisory locks. Production pg uses real locks.
 let tail=Promise.resolve();async function acquire(){const previous=tail;let release;tail=new Promise(r=>{release=r;});await previous;return release;}
 const query=(sql,args)=>sql.includes('pg_advisory_xact_lock')?Promise.resolve({rows:[]}):args?db.query(sql,args):db.exec(sql).then(r=>r.at(-1));
 const pool={async query(sql,args){const release=await acquire();try{return await query(sql,args);}finally{release();}},async connect(){const release=await acquire();return {query,release};},async end(){await db.close();}};
 const store=new RelayStore(pool);await store.migrate();return store;
}
export async function fixture(options={}){
 const directory=options.directory??await mkdtemp(join(tmpdir(),'sv-web-test-'));let store=await database(directory),seconds=Math.floor(Date.now()/1000),app;
 const server=createServer((req,res)=>app(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const configure=()=>{app=createApp({store,origin,passwordHash,adminToken:options.adminToken??adminToken,now:()=>seconds,test:true});};configure();
 return {directory,origin,get store(){return store;},get now(){return seconds;},advance(n){seconds+=n;},async restart(){await store.pool.end();store=await database(directory);configure();},async close(){await new Promise(r=>server.close(r));await store.pool.end();await rm(directory,{recursive:true,force:true});}};
}
export async function request(f,path,{method='GET',body,bearer,cookie,csrf,device,origin=f.origin}={}){
 const r=await fetch(f.origin+path,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-SV-CSRF':csrf}:{}),...(device?{'X-SV-Device-ID':device}:{}),...(origin?{Origin:origin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
}
export async function login(f){const r=await request(f,'/api/web/login',{method:'POST',body:{password}});if(r.status!==200)throw Error('Test login failed');return {cookie:r.cookie,csrf:r.body.csrf};}
export async function paired(f){const r=await request(f,'/api/v2/channels',{method:'POST',body:{},bearer:adminToken});const ch=r.body,deviceId=randomUUID();if(r.status!==201)throw Error('Channel create failed');await request(f,'/api/v2/channels/'+ch.channelId+'/claim',{method:'POST',body:{deviceId},bearer:ch.writeToken});return {...ch,deviceId,version:1,endpoint:f.origin,encryptionKey:randomBytes(32).toString('base64url'),macKey:randomBytes(32).toString('base64url')};}
export function viewerCode(c){return {version:1,endpoint:c.endpoint,channelId:c.channelId,readToken:c.readToken,encryptionKey:c.encryptionKey,macKey:c.macKey};}
export function encrypted(c,text='Your code is 123456',now=Math.floor(Date.now()/1000)){
 const iv=randomBytes(16),cipher=createCipheriv('aes-256-cbc',Buffer.from(c.encryptionKey,'base64url'),iv);
 const content={text,sender:'TEST sender',receivedAt:now,deviceId:c.deviceId};
 const e={version:2,id:randomUUID(),createdAt:now,expiresAt:now+604800,iv:iv.toString('base64url'),ciphertext:Buffer.concat([cipher.update(JSON.stringify(content)),cipher.final()]).toString('base64url')};
 e.mac=createHmac('sha256',Buffer.from(c.macKey,'base64url')).update(['SV-MSG-2',c.channelId,e.id,e.createdAt,e.expiresAt,e.iv,e.ciphertext].join('\n')).digest('base64url');return e;
}
