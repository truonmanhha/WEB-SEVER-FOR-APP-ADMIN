const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const token=/^[A-Za-z0-9_-]{43}$/;
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
export function decode(s,min=0,max=40000){
 if(typeof s!=='string'||!/^[A-Za-z0-9_-]+$/.test(s)||s.length>max*2)throw Error('Mã không hợp lệ');
 const b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
 if(b.length<min||b.length>max||encode(b)!==s)throw Error('Mã không hợp lệ');return b;
}
export function encode(b){return btoa(Array.from(new Uint8Array(b),x=>String.fromCharCode(x)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export function viewer(value,origin){
 if(!value||Object.keys(value).sort().join(',')!=='channelId,encryptionKey,endpoint,macKey,readToken,version'||value.version!==1||!uuid.test(value.channelId)||!token.test(value.readToken))throw Error('Mã kết nối web không hợp lệ');
 const url=new URL(value.endpoint);if(url.origin!==origin||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw Error('Mã kết nối thuộc server khác. Đặt URL server trong app PC đúng URL web này.');
 decode(value.readToken,32,32);decode(value.encryptionKey,32,32);decode(value.macKey,32,32);return value;
}
async function wrapKey(password,salt,usage){
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:310000},key,{name:'AES-GCM',length:256},false,[usage]);
}
export async function wrap(value,password){
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},await wrapKey(password,salt,'encrypt'),enc.encode(JSON.stringify(value)));
 return {version:1,iterations:310000,salt:encode(salt),iv:encode(iv),ciphertext:encode(ciphertext)};
}
export async function unwrap(value,password,origin){
 if(value?.version!==1||value.iterations!==310000)throw Error('Cấu hình không hợp lệ');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(value.iv,12,12)},await wrapKey(password,decode(value.salt,16,16),'decrypt'),decode(value.ciphertext,32,4096));
 return viewer(JSON.parse(dec.decode(plain)),origin);
}
export async function decryptMessage(e,v,deviceId,now=Math.floor(Date.now()/1000)){
 if(e?.version!==2||!uuid.test(e.id)||!Number.isSafeInteger(e.createdAt)||!Number.isSafeInteger(e.expiresAt)||e.createdAt>now+300||e.createdAt<now-604800||e.expiresAt!==e.createdAt+604800||e.expiresAt<=now)throw Error('Tin đã hết hạn hoặc không hợp lệ');
 const iv=decode(e.iv,16,16),cipher=decode(e.ciphertext,16,32784);if(cipher.length%16)throw Error('Tin không hợp lệ');
 const key=await crypto.subtle.importKey('raw',decode(v.macKey,32,32),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const canonical=['SV-MSG-2',v.channelId,e.id,e.createdAt,e.expiresAt,e.iv,e.ciphertext].join('\n');
 if(!await crypto.subtle.verify('HMAC',key,decode(e.mac,32,32),enc.encode(canonical)))throw Error('Tin không vượt qua kiểm tra toàn vẹn');
 const aes=await crypto.subtle.importKey('raw',decode(v.encryptionKey,32,32),'AES-CBC',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-CBC',iv},aes,cipher);if(plain.byteLength>32768)throw Error('Tin quá lớn');
 const p=JSON.parse(dec.decode(plain));
 if(typeof p.text!=='string'||!p.text.trim()||p.text.length>8000||typeof p.sender!=='string'||p.sender.length>120||!uuid.test(p.deviceId)||p.deviceId!==deviceId||!Number.isSafeInteger(p.receivedAt)||p.receivedAt<now-604800||p.receivedAt>now+300)throw Error('Nội dung tin không hợp lệ');
 return {...p,id:e.id,expiresAt:e.expiresAt,createdAt:e.createdAt};
}
