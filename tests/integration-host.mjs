// Isolated .NET compatibility host: never reads the production .env.local.
import {fixture} from './helpers.mjs';
if(!process.env.SV_TEST_DATABASE||!process.env.SV_RELAY_ADMIN_TOKEN)throw Error('Isolated test configuration required');
const f=await fixture({directory:process.env.SV_TEST_DATABASE+'.postgres',adminToken:process.env.SV_RELAY_ADMIN_TOKEN});
console.log(f.origin);
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await f.close();process.exit(0);});
