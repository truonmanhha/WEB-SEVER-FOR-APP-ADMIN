import {createHash, randomBytes, timingSafeEqual, scrypt as nativeScrypt} from 'node:crypto';
import {promisify} from 'node:util';
export const RETENTION=604800;
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const TOKEN=/^[A-Za-z0-9_-]{43}$/;
export const PASSWORD_HASH=/^scrypt\$32768\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const secret=()=>randomBytes(32).toString('base64url');
export function fail(status,code){throw Object.assign(new Error(code),{status});}
export function equal(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function bytes(value,min,max){
 if(typeof value!=='string'||value.length>max*2||!/^[A-Za-z0-9_-]+$/.test(value))fail(400,'invalid_data');
 const b=Buffer.from(value,'base64url');if(b.toString('base64url')!==value||b.length<min||b.length>max)fail(400,'invalid_data');return b;
}
export function envelope(v,now){
 if(!v||Array.isArray(v)||Object.keys(v).sort().join(',')!=='ciphertext,createdAt,expiresAt,id,iv,mac,version'
 ||v.version!==2||!UUID.test(v.id??'')||!Number.isSafeInteger(v.createdAt)||!Number.isSafeInteger(v.expiresAt)
 ||v.createdAt>now+300||v.createdAt<now-RETENTION||v.expiresAt!==v.createdAt+RETENTION||v.expiresAt<=now)fail(400,'invalid_envelope');
 bytes(v.iv,16,16);if(bytes(v.ciphertext,16,32784).length%16)fail(400,'invalid_envelope');bytes(v.mac,32,32);
 return {version:2,id:v.id,createdAt:v.createdAt,expiresAt:v.expiresAt,iv:v.iv,ciphertext:v.ciphertext,mac:v.mac};
}
const scrypt=promisify(nativeScrypt);
export async function verifyPassword(password,encoded){
 const m=PASSWORD_HASH.exec(encoded??'');
 if(!m)throw new Error('Invalid server password configuration');
 if(typeof password!=='string'||password.length<1||password.length>256)return false;
 const derived=await scrypt(password,m[1],64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
 return equal(derived,Buffer.from(m[2],'hex'));
}
export function validateWrapped(v){
 if(!v||Object.keys(v).sort().join(',')!=='ciphertext,iterations,iv,salt,version'||v.version!==1||v.iterations!==310000)fail(400,'invalid_wrapped_config');
 bytes(v.salt,16,16);bytes(v.iv,12,12);bytes(v.ciphertext,32,4096);return v;
}

