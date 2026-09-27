const $=id=>document.getElementById(id);
try{
 const r=await fetch('/api/public/release',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const v=await r.json(),ios=v.ios;
 const source=new URL(v.sourceURL);if(source.origin!==location.origin)throw Error();$('source').value=source.href;
 if(ios?.available){const url=new URL(ios.downloadURL);if(url.origin!==location.origin||!url.pathname.startsWith('/downloads/'))throw Error();$('ipa').href=url.href;$('ipa').hidden=false;$('release-status').textContent=`Bản ${ios.version} • build ${ios.build} • ${ios.notes}`;$('checksum').textContent='SHA-256: '+ios.sha256;}
 else $('release-status').textContent='Chưa có bản IPA đã xác minh để tải.';
}catch{$('release-status').textContent='Chưa kiểm tra được bản mới. Thử tải lại trang.';}
$('copy-source').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('source').value);$('copy-status').textContent='Đã sao chép.';}catch{$('source').select();$('copy-status').textContent='Chọn và sao chép URL nguồn ở trên.';}});
