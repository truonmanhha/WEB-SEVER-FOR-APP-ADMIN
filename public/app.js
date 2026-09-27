import {viewer,wrap,unwrap,decryptMessage} from './crypto.js';
const $=id=>document.getElementById(id);let credential=null,csrf='',password='',items=new Map(),cursor=null,poll=null,lastAction=Date.now(),busy=false,noticeTimer,generation=0;
const errors={wrong_password:'Mật khẩu không đúng.',too_many_attempts:'Thử quá nhiều lần. Chờ 15 phút rồi thử lại.',login_required:'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.',server_not_configured:'Server chưa được cấu hình database và biến môi trường. Xem DEPLOY.md.',server_unavailable:'Server hoặc database đang tạm thời không sẵn sàng.',unauthorized:'Kết nối đã bị thu hồi hoặc không đúng quyền đọc.',csrf_required:'Phiên không hợp lệ. Hãy đăng nhập lại.'};
function notice(text){$('notice').textContent=text;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').textContent='',9000);}
async function api(path,body){
 const r=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000),headers:body===undefined?{}:{'Content-Type':'application/json','X-SV-CSRF':csrf},body:body===undefined?undefined:JSON.stringify(body)});
 const result=await r.json().catch(()=>({error:'server_unavailable'}));if(!r.ok){if(r.status===401&&path!=='/api/web/login')await lock(false);throw Error(errors[result.error]??'Yêu cầu không thành công. Vui lòng kiểm tra cấu hình server.');}return result;
}
function start(){clearInterval(poll);poll=setInterval(()=>{if(Date.now()-lastAction>=300000){lock();return;}if(credential&&!document.hidden)load().catch(e=>notice(e.message));},10000);}
async function lock(revoke=true){
 generation++;const oldCsrf=csrf;credential=null;password='';csrf='';items.clear();cursor=null;clearInterval(poll);$('messages').replaceChildren();$('connection').value='';$('password').value='';$('search').value='';$('dashboard').hidden=true;$('login').hidden=false;
 if(revoke&&oldCsrf){$('login-button').disabled=true;try{await fetch('/api/web/logout',{method:'POST',credentials:'same-origin',signal:AbortSignal.timeout(5000),headers:{'Content-Type':'application/json','X-SV-CSRF':oldCsrf},body:'{}'}).catch(()=>{});}finally{$('login-button').disabled=false;}}
}
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{lastAction=Date.now();},{passive:true});
$('login-form').addEventListener('submit',async e=>{e.preventDefault();$('login-button').disabled=true;try{
 password=$('password').value;const response=await api('/api/web/login',{password});csrf=response.csrf;$('password').value='';
 const config=await api('/api/web/config');$('login').hidden=true;$('dashboard').hidden=false;lastAction=Date.now();start();
 if(config.wrapped&&!$('replace-connection').checked){const epoch=generation;try{const v=await unwrap(config.wrapped,password,location.origin);if(epoch!==generation)return;credential=v;password='';$('setup').hidden=true;$('inbox').hidden=false;}catch(err){if(epoch!==generation)return;$('setup').hidden=false;$('inbox').hidden=true;notice('Không mở được khóa xem web. Dán lại mã kết nối từ PC nếu bạn đã đổi mật khẩu.');}if(credential)await load();}
 else{$('setup').hidden=false;$('inbox').hidden=true;}
 }catch(err){password='';notice(err.message);}finally{$('login-button').disabled=false;}});
$('setup-form').addEventListener('submit',async e=>{e.preventDefault();$('connect').disabled=true;try{
 if(!password){notice('Đăng nhập lại để mã hóa kết nối bằng mật khẩu web.');await lock();return;}
 const epoch=generation,v=viewer(JSON.parse($('connection').value),location.origin);
 // Verify reader authorization before replacing the previous encrypted config.
 await api('/api/web/messages',{channelId:v.channelId,readToken:v.readToken});if(epoch!==generation)return;
 const wrapped=await wrap(v,password);if(epoch!==generation)return;await api('/api/web/config',wrapped);if(epoch!==generation)return;
 credential=v;password='';$('connection').value='';items.clear();cursor=null;$('setup').hidden=true;$('inbox').hidden=false;await load();notice('Đã kết nối. Khóa xem web được lưu dưới dạng mã hóa.');
 }catch(err){notice(err.message);}finally{$('connect').disabled=false;}});
async function load(older=false){
 if(busy||!credential)return;busy=true;$('refresh').disabled=true;const active=credential;try{
 const r=await api('/api/web/messages',{channelId:active.channelId,readToken:active.readToken,...(older&&cursor?{cursor}:{})});if(credential!==active)return;
 let rejected=0;for(const e of r.messages){try{const p=await decryptMessage(e,active,r.deviceId);if(credential!==active)return;items.set(p.id,p);}catch{rejected++;}}
 if(older||!cursor)cursor=r.nextCursor;if(rejected)notice('Có '+rejected+' tin không hợp lệ; nội dung không được hiển thị.');
 $('sync-status').textContent=r.deviceId?'Đã kết nối':'Chờ ghép iPhone';render();
 }catch(e){$('sync-status').textContent='Mất kết nối';throw e;}finally{busy=false;$('refresh').disabled=false;}
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
window.addEventListener('pagehide',()=>{credential=null;password='';items.clear();clearInterval(poll);$('messages').replaceChildren();});
