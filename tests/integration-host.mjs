// Isolated .NET compatibility host: never reads the production .env.local.
import {fixture,registration,encrypted} from './helpers.mjs';
if(!process.env.SV_TEST_DATABASE||!process.env.SV_RELAY_ADMIN_TOKEN)throw Error('Isolated test configuration required');
const f=await fixture({directory:process.env.SV_TEST_DATABASE+'.postgres',adminToken:process.env.SV_RELAY_ADMIN_TOKEN});
if(process.env.SV_TEST_DEVICEHUB==='1')for(const name of ['iPhone thử A','iPhone thử B']){
 const r=await registration(f,name);await f.store.registerDevice(r.body,f.now);
 await f.store.put(r.c.channelId,r.c.writeToken,r.c.deviceId,encrypted(r.c,name+' — 123456',f.now),f.now);
}
console.log(f.origin);
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await f.close();process.exit(0);});
