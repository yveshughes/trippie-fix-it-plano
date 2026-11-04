import {pathToFileURL} from 'node:url';
import {setting} from '../server/config.mjs';
export async function operate(args,{fetcher=fetch,password=setting('TRIPPIE_ADMIN_PASSWORD'),baseUrl=setting('TRIPPIE_PORTAL_URL','https://www.fixitplano.com')}={}){
 const [command,value,...extra]=args;
 if(!['status','mode','clear-demo'].includes(command))throw new Error('Use: npm run operator -- status | mode live|demo | clear-demo --confirm');
 if(command==='status'&&value!==undefined)throw new Error('Status accepts no arguments');
 if(command==='mode'&&(!['live','demo'].includes(value)||extra.length))throw new Error('Choose mode live or mode demo');
 if(command==='clear-demo'&&(value!=='--confirm'||extra.length))throw new Error('Clearing DEMO requires: npm run operator -- clear-demo --confirm');
 const url=new URL(baseUrl);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Use an HTTPS portal origin, or HTTP loopback for local development.');
 if(!password)throw new Error('Set TRIPPIE_ADMIN_PASSWORD in .env.local; do not pass it on the command line.');
 const method=command==='status'?'GET':command==='mode'?'PATCH':'DELETE';
 const response=await fetcher(new URL('/api/workspace',url),{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json',Authorization:'Basic '+Buffer.from('trippie:'+password).toString('base64')},...(method==='GET'?{}:{body:JSON.stringify({mode:command==='mode'?value:'demo'})})});
 if(!response.ok)throw new Error(`Operator request failed (HTTP ${response.status}). No automatic retry was made.`);
 return response.json();
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){try{console.log(JSON.stringify(await operate(process.argv.slice(2)),null,2));}catch(error){console.error(error.message);process.exitCode=1;}}
