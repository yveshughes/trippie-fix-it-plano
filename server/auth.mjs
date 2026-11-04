import {timingSafeEqual} from 'node:crypto';
import {setting} from './config.mjs';
const equal=(a,b)=>Boolean(a&&b&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b)));
export function deviceAuth(request){return equal(request.headers.get('authorization')?.replace(/^Bearer /,''),setting('TRIPPIE_DEVICE_TOKEN'));}
export function adminAuth(request){
 const host=request.headers.get('host'),origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
 if(site==='cross-site')return false;
 // Next development may normalize request.url to localhost even when the browser uses 127.0.0.1.
 // The loopback exception must compare Origin with the actual allowlisted Host header.
 if(!setting('VERCEL')&&['127.0.0.1:3015','localhost:3015'].includes(host)&&(!origin||origin===`http://${host}`)&&(!site||['same-origin','none'].includes(site)))return true;
 if(origin&&origin!==new URL(request.url).origin)return false;
 try{const [user,...password]=Buffer.from((request.headers.get('authorization')||'').replace(/^Basic /,''),'base64').toString().split(':');return user==='trippie'&&equal(password.join(':'),setting('TRIPPIE_ADMIN_PASSWORD'));}catch{return false;}
}
export const authResponse=()=>Response.json({error:'Not authorized'},{status:401,headers:{'Cache-Control':'no-store'}});
