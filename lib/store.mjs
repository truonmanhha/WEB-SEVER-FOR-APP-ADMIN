import pg from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {hash,secret,equal,fail,RETENTION} from './protocol.mjs';
const migration=readFileSync(new URL('../schema.sql',import.meta.url),'utf8');
export class RelayStore {
 constructor(pool){this.pool=pool;}
 async migrate(){await this.pool.query(migration);}
 async tx(fn){const c=await this.pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
 async authorize(id,credential,role,client=this.pool,lock=false){
  const r=await client.query('SELECT * FROM sv_channels WHERE id=$1'+(lock?' FOR UPDATE':''),[id]);const ch=r.rows[0];
  if(!ch||!equal(hash(credential),role==='read'?ch.read_hash:ch.write_hash))fail(401,'unauthorized');return ch;
 }
 async create(now){return this.tx(async c=>{
  // Global lock protects the channel cap across all Function instances.
  await c.query('SELECT pg_advisory_xact_lock(77321001)');
  const n=await c.query('SELECT count(*)::int AS n FROM sv_channels');if(n.rows[0].n>=200)fail(429,'channel_limit');
  const id=randomUUID(),readToken=secret(),writeToken=secret();
  await c.query('INSERT INTO sv_channels(id,read_hash,write_hash,created_at) VALUES($1,$2,$3,$4)',[id,hash(readToken),hash(writeToken),now]);
  return {channelId:id,readToken,writeToken,pairUntil:now+900,retentionSeconds:RETENTION};
 });}
 async claim(id,credential,device,now){return this.tx(async c=>{
  const ch=await this.authorize(id,credential,'write',c,true);
  if(ch.device_id&&ch.device_id!==device)fail(409,'device_already_paired');
  if(!ch.device_id&&Number(ch.created_at)+900<now)fail(410,'pairing_expired');
  await c.query('UPDATE sv_channels SET device_id=$2 WHERE id=$1',[id,device]);return {accepted:true};
 });}
 async put(id,credential,device,v,now){return this.tx(async c=>{
  const ch=await this.authorize(id,credential,'write',c,true);
  if(!ch.device_id||ch.device_id!==device)fail(403,'device_not_paired');
  const encoded=JSON.stringify(v),digest=hash(encoded);
  const old=await c.query('SELECT digest FROM sv_messages WHERE channel_id=$1 AND id=$2',[id,v.id]);
  if(old.rows[0]){if(!equal(old.rows[0].digest,digest))fail(409,'message_id_conflict');return {accepted:true,duplicate:true,id:v.id};}
  const count=await c.query('SELECT count(*)::int AS total, count(*) FILTER(WHERE acked=false)::int AS pending FROM sv_messages WHERE channel_id=$1 AND expires_at>$2',[id,now]);
  if(count.rows[0].pending>=500||count.rows[0].total>=5000)fail(429,'queue_full');
  await c.query('INSERT INTO sv_messages(channel_id,id,created_at,expires_at,digest,envelope) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[id,v.id,v.createdAt,v.expiresAt,digest,encoded]);
  return {accepted:true,duplicate:false,id:v.id};
 });}
 async list(id,credential,now,archive=false,cursor=null){
  const ch=await this.authorize(id,credential,'read');
  const args=[id,now];let where=archive?'':' AND acked=false';
  if(cursor){args.push(cursor.createdAt,cursor.id);where+=' AND (created_at,id)<($3::bigint,$4::uuid)';}
  const limit=archive?101:50;
  const r=await this.pool.query('SELECT envelope,created_at,id FROM sv_messages WHERE channel_id=$1 AND expires_at>$2'+where+' ORDER BY created_at '+(archive?'DESC':'ASC')+',id '+(archive?'DESC':'ASC')+' LIMIT '+limit,args);
  const rows=archive?r.rows.slice(0,100):r.rows;
  const last=rows.at(-1);
  return {deviceId:ch.device_id,pairUntil:Number(ch.created_at)+900,messages:rows.map(x=>x.envelope),
   ...(archive?{nextCursor:r.rows.length>100?{createdAt:Number(last.created_at),id:last.id}:null}:{})};
 }
 async ack(id,credential,ids){return this.tx(async c=>{
  await this.authorize(id,credential,'read',c,true);
  // Retain ciphertext for the password-gated web viewer until its original expiry.
  await c.query('UPDATE sv_messages SET acked=true WHERE channel_id=$1 AND id=ANY($2::uuid[])',[id,ids]);return {accepted:true};
 });}
 async revoke(id,credential){return this.tx(async c=>{
  await this.authorize(id,credential,'read',c,true);await c.query('DELETE FROM sv_channels WHERE id=$1',[id]);
  // Wrapped viewer credentials become obsolete but contain no plaintext.
  return {accepted:true};
 });}
 async prune(now){
  await this.pool.query('DELETE FROM sv_messages WHERE expires_at<=$1',[now]);
  await this.pool.query('DELETE FROM sv_sessions WHERE expires_at<=$1',[now]);
  await this.pool.query('DELETE FROM sv_login_limits WHERE reset_at<=$1',[now]);
 }
 async attempt(key,now){
  const r=await this.pool.query('INSERT INTO sv_login_limits(key,attempts,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN sv_login_limits.reset_at<=$3 THEN 1 ELSE sv_login_limits.attempts+1 END, reset_at=CASE WHEN sv_login_limits.reset_at<=$3 THEN $2 ELSE sv_login_limits.reset_at END RETURNING attempts',[key,now+900,now]);
  if(r.rows[0].attempts>10)fail(429,'too_many_attempts');
 }
 async session(value,now){const r=await this.pool.query('SELECT token_hash FROM sv_sessions WHERE token_hash=$1 AND expires_at>$2',[hash(value),now]);return !!r.rows[0];}
 async login(value,now){await this.pool.query('INSERT INTO sv_sessions(token_hash,expires_at) VALUES($1,$2)',[hash(value),now+3600]);}
 async logout(value){await this.pool.query('DELETE FROM sv_sessions WHERE token_hash=$1',[hash(value)]);}
 async config(){return (await this.pool.query('SELECT wrapped FROM sv_web_config WHERE id=1')).rows[0]?.wrapped??null;}
 async saveConfig(v){await this.pool.query('INSERT INTO sv_web_config(id,wrapped) VALUES(1,$1::jsonb) ON CONFLICT(id) DO UPDATE SET wrapped=excluded.wrapped',[JSON.stringify(v)]);}
}
export function productionStore(url){
 if(!url)throw new Error('DATABASE_URL is required');
 // pg verifies TLS using the database provider CA. Never use rejectUnauthorized:false.
 return new RelayStore(new pg.Pool({connectionString:url,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true}));
}

