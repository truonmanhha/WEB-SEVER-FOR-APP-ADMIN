import express from 'express';
import {createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {productionStore} from './lib/store.mjs';
import {databaseFromEnvironment,startupFailureCode} from './lib/config.mjs';
import {UUID,TOKEN,PASSWORD_HASH,hash,secret,equal,fail,bytes,envelope,verifyPassword,validateWrapped} from './lib/protocol.mjs';
export function createApp({store,origin,passwordHash,adminToken,now=()=>Math.floor(Date.now()/1000),test=false}){
 if(!TOKEN.test(adminToken??''))throw new Error('invalid_relay_admin_token');
 if(!PASSWORD_HASH.test(passwordHash??''))throw new Error('invalid_web_password_hash');
 let originURL;try{originURL=new URL(origin);}catch{throw new Error('invalid_public_origin');}
 if(originURL.origin!==origin||(!test&&originURL.protocol!=='https:'&&originURL.hostname!=='localhost'&&originURL.hostname!=='127.0.0.1'))throw new Error('invalid_public_origin');
 const app=express();app.disable('x-powered-by');
 app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'"});next();});
 app.use(express.json({limit:'48kb',strict:true}));
 app.use(express.static(fileURLToPath(new URL('./public',import.meta.url)),{dotfiles:'deny',index:'index.html'}));
 app.get('/download',(req,res)=>res.sendFile(fileURLToPath(new URL('./public/index.html',import.meta.url))));
 const bearer=req=>{const b=req.get('authorization')??'';if(!/^Bearer [A-Za-z0-9_-]{43}$/.test(b))fail(401,'unauthorized');return b.slice(7);};
 const cookie=req=>{const m=/(?:^|;\s*)sv_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.get('cookie')??'');return m?.[1]??'';};
 const csrf=value=>createHmac('sha256',adminToken).update(value).digest('base64url');
 const sameOrigin=req=>{if(req.get('origin')!==origin)fail(403,'wrong_origin');};
 const authenticated=async req=>{const t=cookie(req);if(!TOKEN.test(t)||!await store.session(t,now()))fail(401,'login_required');return t;};
 const webWrite=async req=>{sameOrigin(req);const t=await authenticated(req);if(!equal(req.get('x-sv-csrf')??'',csrf(t)))fail(403,'csrf_required');return t;};
 const passwordAuth=async req=>{
  const ip=process.env.VERCEL?req.get('x-vercel-forwarded-for')??req.socket.remoteAddress:req.socket.remoteAddress;
  await store.attempt(hash(adminToken+'|'+ip),now());
  if(!await verifyPassword(req.body?.password,passwordHash))fail(401,'wrong_password');
 };
 app.post('/api/native/register',async(req,res)=>{
  // Native clients have no Origin. Browser-origin requests must still match.
  if(req.get('origin'))sameOrigin(req);
  await passwordAuth(req);const v=req.body;
  if(!v||Object.keys(v).sort().join(',')!=='channelId,deviceId,name,password,readToken,wrapped,writeToken'||!UUID.test(v.deviceId??'')||!UUID.test(v.channelId??'')||typeof v.name!=='string'||!v.name.trim()||v.name.length>80)fail(400,'invalid_device');
  if(!TOKEN.test(v.readToken??'')||!TOKEN.test(v.writeToken??'')||v.readToken===v.writeToken)fail(400,'invalid_device');
  bytes(v.readToken,32,32);bytes(v.writeToken,32,32);
  validateWrapped(v.wrapped);await store.prune(now());res.status(201).json(await store.registerDevice({...v,name:v.name.trim()},now()));
 });
 app.post('/api/native/login',async(req,res)=>{
  if(req.get('origin'))sameOrigin(req);await passwordAuth(req);const token=secret();await store.login(token,now());res.json({token,expiresIn:3600});
 });
 app.get('/api/native/devices',async(req,res)=>{const token=bearer(req);if(!await store.session(token,now()))fail(401,'login_required');res.json({devices:await store.devices()});});
 app.get('/api/web/devices',async(req,res)=>{await authenticated(req);res.json({devices:await store.devices()});});
 app.get('/health',async(req,res)=>{await store.pool.query('SELECT 1');res.json({ok:true,protocol:2});});
 app.post('/api/web/login',async(req,res)=>{
  sameOrigin(req);
  // On Vercel this header is set by the platform; localhost tests do not trust it.
  const ip=process.env.VERCEL?req.get('x-vercel-forwarded-for')??req.socket.remoteAddress:req.socket.remoteAddress;
  await store.attempt(hash(adminToken+'|'+ip),now());
  if(!await verifyPassword(req.body?.password,passwordHash))fail(401,'wrong_password');
  const t=secret();await store.login(t,now());
  res.cookie('sv_session',t,{httpOnly:true,secure:originURL.protocol==='https:',sameSite:'strict',path:'/',maxAge:3600000});
  res.json({ok:true,csrf:csrf(t)});
 });
 app.post('/api/web/logout',async(req,res)=>{const t=await webWrite(req);await store.logout(t);res.clearCookie('sv_session',{path:'/',httpOnly:true,secure:originURL.protocol==='https:',sameSite:'strict'});res.json({ok:true});});
 app.get('/api/web/config',async(req,res)=>{await authenticated(req);res.json({wrapped:await store.config()});});
 app.post('/api/web/config',async(req,res)=>{await webWrite(req);await store.saveConfig(validateWrapped(req.body));res.json({ok:true});});
 app.post('/api/web/messages',async(req,res)=>{
  await webWrite(req);const {channelId,readToken,cursor}=req.body??{};
  if(!UUID.test(channelId??'')||!TOKEN.test(readToken??''))fail(400,'invalid_viewer');
  if(cursor&&(!Number.isSafeInteger(cursor.createdAt)||!UUID.test(cursor.id??'')))fail(400,'invalid_cursor');
  res.json(await store.list(channelId,readToken,now(),true,cursor??null));
 });
 app.post('/api/v2/channels',async(req,res)=>{
  if(!equal(hash(bearer(req)),hash(adminToken)))fail(401,'unauthorized');
  if(!req.body||Array.isArray(req.body)||Object.keys(req.body).length)fail(400,'invalid_body');
  await store.prune(now());res.status(201).json(await store.create(now()));
 });
 app.all('/api/v2/channels/:id/:action',async(req,res)=>{
  const {id,action}=req.params;if(!UUID.test(id))fail(404,'not_found');if(req.url.includes('?'))fail(400,'query_not_allowed');
  const credential=bearer(req);
  if(req.method==='POST'&&action==='claim'){if(!UUID.test(req.body?.deviceId??''))fail(400,'invalid_device');return res.json(await store.claim(id,credential,req.body.deviceId,now()));}
  if(req.method==='POST'&&action==='messages'){await store.prune(now());return res.json(await store.put(id,credential,req.get('x-sv-device-id'),envelope(req.body,now()),now()));}
  if(req.method==='GET'&&action==='messages')return res.json(await store.list(id,credential,now()));
  if(req.method==='POST'&&action==='ack'){
   if(!Array.isArray(req.body?.ids)||req.body.ids.length>50||!req.body.ids.every(x=>UUID.test(x)))fail(400,'invalid_ack');
   return res.json(await store.ack(id,credential,req.body.ids));
  }fail(405,'method_not_allowed');
 });
 app.delete('/api/v2/channels/:id',async(req,res)=>{if(!UUID.test(req.params.id))fail(404,'not_found');res.json(await store.revoke(req.params.id,bearer(req)));});
 app.get('/api/public/release',(req,res)=>res.json({ready:false,testflightURL:null}));
 app.use((req,res)=>res.status(404).json({error:'not_found'}));
 app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const status=err.status??500;res.status(status).json({error:status===500?'server_unavailable':status===413?'payload_too_large':err.type==='entity.parse.failed'?'invalid_json':err.message});});
 return app;
}
let liveApp,ready,lastFailure;
async function handler(req,res){
 try{
  if(!liveApp){
   const store=productionStore(databaseFromEnvironment(process.env));
   liveApp=createApp({store,origin:process.env.SV_PUBLIC_ORIGIN,passwordHash:process.env.SV_WEB_PASSWORD_HASH,adminToken:process.env.SV_RELAY_ADMIN_TOKEN});
   ready=store.migrate().catch(async e=>{liveApp=null;await store.pool.end();throw e;});
  }
  await ready;liveApp(req,res);
 }catch(error){const reason=startupFailureCode(error);if(lastFailure!==reason){lastFailure=reason;console.error('SecureVault startup:',reason);}res.statusCode=503;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'server_not_configured'}));}
}
const deploymentApp=express();deploymentApp.disable('x-powered-by');deploymentApp.use(handler);
export default deploymentApp;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT??43128);deploymentApp.listen(port,'127.0.0.1',()=>console.log('Secure Vault Web: http://127.0.0.1:'+port));
}

