import {viewer,wrap,wrapDevice,encode,unwrap,decryptMessage} from './crypto.js';
import QRCode from './vendor/qr.js';
let invitation=null;
function clearInvitation(){invitation=null;$('pair-result').hidden=true;const c=$('pair-canvas');c.getContext('2d').clearRect(0,0,c.width,c.height);$('pair-status').textContent='';}
const $=id=>document.getElementById(id);let credential=null,csrf='',password='',items=new Map(),cursor=null,poll=null,lastAction=Date.now(),busy=false,noticeTimer,generation=0;
let deviceRows=[],deviceKeys=new Map(),selectedDevice=null,legacy=null,lastDeviceLoad=0,selectGeneration=0;
async function refreshDevices(){
 const epoch=generation,r=await api('/api/web/devices');if(epoch!==generation)return;
 deviceRows=r.devices;lastDeviceLoad=Date.now();renderDevices();
 if(invitation&&deviceRows.some(d=>d.channelId===invitation.channelId)){clearInvitation();notice('iPhone đã kết nối. Không cần quét lại khi mở app hoặc cập nhật.');}
 if(!selectedDevice&&deviceRows.length)await selectDevice(deviceRows[0].deviceId);
 else if(selectedDevice&&selectedDevice!=='legacy'&&!deviceRows.some(d=>d.deviceId===selectedDevice)){
  credential=null;selectedDevice=null;items.clear();deviceKeys.clear();render();
  if(deviceRows.length)await selectDevice(deviceRows[0].deviceId);
 }
}
function renderDevices(){
 $('devices').replaceChildren();$('device-count').textContent=deviceRows.length+(legacy?1:0);$('no-devices').hidden=!!deviceRows.length||!!legacy;
 for(const d of [...deviceRows,...(legacy?[{deviceId:'legacy',name:'Kết nối PC cũ',lastSeen:null}]:[])]){
  const b=element('button','device'+(selectedDevice===d.deviceId?' active':''));b.type='button';b.setAttribute('aria-pressed',String(selectedDevice===d.deviceId));
  b.append(element('span','device-avatar','▣'),element('strong',null,d.name),element('small',null,d.lastSeen?'Gửi tin gần nhất: '+new Date(d.lastSeen*1000).toLocaleString('vi-VN'):'Kết nối trước đây'));
  b.addEventListener('click',()=>selectDevice(d.deviceId).catch(e=>notice(e.message)));$('devices').append(b);
 }
}
async function selectDevice(id){
 const row=deviceRows.find(d=>d.deviceId===id);if(id!=='legacy'&&!row)return;
 const epoch=generation,selection=++selectGeneration;
 let key=id==='legacy'?legacy:deviceKeys.get(id);
 if(!key){key=await unwrap(row.wrapped,password,location.origin);if(key.channelId!==row.channelId)throw Error('Khóa không thuộc thiết bị này.');}
 if(epoch!==generation||selection!==selectGeneration)return;
 if(id!=='legacy')deviceKeys.set(id,key);selectedDevice=id;credential=key;items.clear();cursor=null;
 $('chat-title').textContent=row?.name??'Kết nối PC cũ';$('search').value='';$('setup').hidden=true;$('inbox').hidden=false;renderDevices();render();await load();
}
const errors={wrong_password:'Mật khẩu không đúng.',too_many_attempts:'Thử quá nhiều lần. Chờ 15 phút rồi thử lại.',login_required:'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.',server_not_configured:'Server chưa được cấu hình database và biến môi trường. Xem DEPLOY.md.',server_unavailable:'Server hoặc database đang tạm thời không sẵn sàng.',unauthorized:'Kết nối đã bị thu hồi hoặc không đúng quyền đọc.',csrf_required:'Phiên không hợp lệ. Hãy đăng nhập lại.'};
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',9000);}
async function api(path,body){
 const r=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),headers:body===undefined?{}:{'Content-Type':'application/json','X-SV-CSRF':csrf},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await r.json().catch(()=>({error:'server_unavailable'}));if(!r.ok){if(r.status===401&&path!=='/api/web/login')await lock(false);throw Error(errors[result.error]??'Yêu cầu không thành công. Vui lòng kiểm tra cấu hình server.');}return result;
}
function start(){clearInterval(poll);poll=setInterval(async()=>{if(Date.now()-lastAction>=300000){lock();return;}if(!document.hidden){try{if(Date.now()-lastDeviceLoad>=30000)await refreshDevices();if(credential)await load();}catch(e){notice(e.message);}}},10000);}
async function lock(revoke=true){
 generation++;selectGeneration++;clearInvitation();const oldCsrf=csrf;credential=null;password='';csrf='';items.clear();cursor=null;deviceRows=[];deviceKeys.clear();legacy=null;selectedDevice=null;clearInterval(poll);$('messages').replaceChildren();$('devices').replaceChildren();$('chat-title').textContent='Chọn thiết bị';$('connection').value='';$('password').value='';$('search').value='';$('dashboard').hidden=true;$('login').hidden=false;
 if(revoke&&oldCsrf){$('login-button').disabled=true;try{await fetch('/api/web/logout',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json','X-SV-CSRF':oldCsrf},body:'{}'}).catch(()=>{});}finally{$('login-button').disabled=false;}}
}
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{lastAction=Date.now();},{passive:true});
$('login-form').addEventListener('submit',async e=>{e.preventDefault();$('login-button').disabled=true;try{
 password=$('password').value;const response=await api('/api/web/login',{password});csrf=response.csrf;$('password').value='';
 const config=await api('/api/web/config');$('login').hidden=true;$('dashboard').hidden=false;lastAction=Date.now();start();
 if(config.wrapped&&!$('replace-connection').checked){const epoch=generation;try{const v=await unwrap(config.wrapped,password,location.origin);if(epoch!==generation)return;legacy=v;credential=v;selectedDevice='legacy';$('setup').hidden=true;$('inbox').hidden=false;}catch(err){if(epoch!==generation)return;$('setup').hidden=false;$('inbox').hidden=true;notice('Không mở được khóa xem web. Dán lại mã kết nối từ PC nếu bạn đã đổi mật khẩu.');}if(credential)await load();}
 else{$('setup').hidden=false;$('inbox').hidden=true;}
 await refreshDevices();
 }catch(err){password='';notice(err.message);}finally{$('login-button').disabled=false;}});
$('setup-form').addEventListener('submit',async e=>{e.preventDefault();$('connect').disabled=true;try{
 if(!password){notice('Đăng nhập lại để mã hóa kết nối bằng mật khẩu web.');await lock();return;}
 const epoch=generation,v=viewer(JSON.parse($('connection').value),location.origin);
 // Verify reader authorization before replacing the previous encrypted config.
 await api('/api/web/messages',{channelId:v.channelId,readToken:v.readToken});if(epoch!==generation)return;
 const wrapped=await wrap(v,password);if(epoch!==generation)return;await api('/api/web/config',wrapped);if(epoch!==generation)return;
 credential=v;legacy=v;selectedDevice='legacy';$('connection').value='';items.clear();cursor=null;$('setup').hidden=true;$('inbox').hidden=false;renderDevices();await load();notice('Đã kết nối. Khóa xem web được lưu dưới dạng mã hóa.');
 }catch(err){notice(err.message);}finally{$('connect').disabled=false;}});
async function load(older=false){
 if(busy||!credential)return;busy=true;$('refresh').disabled=true;const active=credential;try{
 const r=await api('/api/web/messages',{channelId:active.channelId,readToken:active.readToken,...(older&&cursor?{cursor}:{})});if(credential!==active)return;
 let rejected=0;for(const e of r.messages){try{const p=await decryptMessage(e,active,r.deviceId);if(credential!==active)return;items.set(p.id,p);}catch{rejected++;}}
 if(older||!cursor)cursor=r.nextCursor;if(rejected)notice('Có '+rejected+' tin không hợp lệ; nội dung không được hiển thị.');
 $('sync-status').textContent=r.deviceId?'Đã kết nối':'Chờ ghép iPhone';render();
 }catch(e){if(credential===active)$('sync-status').textContent='Mất kết nối';throw e;}finally{busy=false;$('refresh').disabled=false;if(credential&&credential!==active)load().catch(e=>notice(e.message));}
}
async function copy(text){try{await navigator.clipboard.writeText(text);notice('Đã sao chép. Clipboard có thể chứa dữ liệu nhạy cảm.');}catch{notice('Không sao chép được. Hãy dùng HTTPS và cho phép clipboard.');}}
function element(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function render(){
 const now=Math.floor(Date.now()/1000);for(const [id,p]of items)if(p.expiresAt<=now)items.delete(id);
 const query=$('search').value.toLocaleLowerCase('vi');const list=[...items.values()].sort((a,b)=>b.createdAt-a.createdAt).filter(p=>(p.sender+' '+p.text).toLocaleLowerCase('vi').includes(query));
 $('count').textContent=items.size;$('empty').hidden=list.length>0;$('empty').textContent=query?'Không có tin phù hợp.':'Chưa có tin nhắn. Tin mới sẽ tự cập nhật khi iPhone gửi tới server.';$('messages').replaceChildren();$('older').hidden=!cursor;
 for(const p of list){const card=element('article','message panel'),info=element('div');info.append(element('h2',null,p.sender||'Tin nhắn'));const time=element('time',null,new Date(p.receivedAt*1000).toLocaleString('vi-VN'));time.dateTime=new Date(p.receivedAt*1000).toISOString();info.append(time,element('p','text',p.text));
 const codes=[...new Set(p.text.match(/(?<!\d)\d{4,8}(?!\d)/g)??[])];if(codes.length){const row=element('div','codes');for(const code of codes.slice(0,8)){const b=element('button','code',code);b.title='Sao chép mã';b.addEventListener('click',()=>copy(code));row.append(b);}info.append(row);}
 info.append(element('p','expiry','Tự xóa trên server: '+new Date(p.expiresAt*1000).toLocaleString('vi-VN')));const b=element('button','secondary copy','Sao chép nội dung');b.addEventListener('click',()=>copy(p.text));card.append(info,b);$('messages').append(card);}
}
$('lock').addEventListener('click',()=>lock());$('refresh').addEventListener('click',()=>load().catch(e=>notice(e.message)));$('older').addEventListener('click',()=>load(true).catch(e=>notice(e.message)));$('search').addEventListener('input',render);
$('reconnect').addEventListener('click',async()=>{await lock();$('replace-connection').checked=true;notice('Đăng nhập lại để thay kết nối. Cấu hình cũ chưa bị xóa.');});
// Fresh authentication is required on every tab load; no keys or plaintext in web storage.
window.addEventListener('pagehide',()=>{generation++;selectGeneration++;clearInvitation();credential=null;password='';deviceKeys.clear();legacy=null;deviceRows=[];items.clear();clearInterval(poll);$('devices').replaceChildren();$('messages').replaceChildren();});
$('pair-form').addEventListener('submit',async e=>{
 e.preventDefault();if(!password)return;$('create-pair').disabled=true;const epoch=generation;
 try{
  if(invitation?.pairUntil&&invitation.pairUntil<=Math.floor(Date.now()/1000))clearInvitation();
  if(!invitation){
   const key=()=>encode(crypto.getRandomValues(new Uint8Array(32))),channelId=crypto.randomUUID();
   const v={version:1,endpoint:location.origin,channelId,readToken:key(),encryptionKey:key(),macKey:key()};
   const wrapped=await wrapDevice(v,password);if(epoch!==generation)return;
   invitation={channelId,name:$('pair-name').value.trim()||'iPhone',readToken:v.readToken,writeToken:key(),wrapped,v};
  }
  const p=invitation,r=await api('/api/web/pair',{channelId:p.channelId,name:p.name,readToken:p.readToken,writeToken:p.writeToken,wrapped:p.wrapped});if(epoch!==generation)return;
  p.pairUntil=r.pairUntil;
  const params=new URLSearchParams({endpoint:location.origin,channel:p.channelId,write_token:p.writeToken,enc_key:p.v.encryptionKey,mac_key:p.v.macKey,pair_until:String(r.pairUntil),name:p.name});
  const native=$('pair-mode').value==='native',qr=native?'securevault://remote?'+params.toString().replace(/\+/g,'%20'):location.origin+'/phone.html#'+params;
  await QRCode.toCanvas($('pair-canvas'),qr,{width:360,margin:4,errorCorrectionLevel:'M'});if(epoch!==generation){clearInvitation();return;}
  $('pair-result').hidden=false;$('pair-status').textContent=(native?'App iOS đã cài → Quét QR ghép đôi. Không cần cài thêm app web. Nếu đã kết nối thì giữ nguyên, không quét lại. ':'Cài app web vào Màn hình chính trước → mở Secure Vault → Quét QR kết nối. ')+'QR tạo kết nối hết hạn lúc '+new Date(r.pairUntil*1000).toLocaleTimeString('vi-VN')+'. Sau khi ghép không cần quét lại. Không chụp/gửi QR cho người khác.';
 }catch(err){notice(err.message);}finally{$('create-pair').disabled=false;}
});
$('close-pair').addEventListener('click',clearInvitation);
