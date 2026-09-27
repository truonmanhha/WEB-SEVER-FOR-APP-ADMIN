// Prefer the connection supplied by the app's dedicated Neon integration.
// Never print connection strings: they contain database credentials.
export function databaseFromEnvironment(env){
 const value=env.SV_MSG_DATABASE_URL?.trim()||env.DATABASE_URL?.trim();
 if(!value)throw new Error('Database environment variable is missing');
 return value;
}
export function verifiedDatabaseURL(value){
 let url;try{url=new URL(value);}catch{throw new Error('Invalid database URL');}
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('Invalid database URL');
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)){
  // Keep certificate + hostname verification even if pg changes sslmode=require.
  url.searchParams.set('sslmode','verify-full');
  url.searchParams.delete('uselibpqcompat');
 }
 return url.toString();
}
