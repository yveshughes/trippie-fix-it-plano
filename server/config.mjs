import {readFileSync} from 'node:fs';
import {parse} from 'dotenv';
export function setting(name,fallback=''){const value=process.env[name]!==undefined?process.env[name]:local()[name];return value||fallback;}
function local(){try{return parse(readFileSync('.env.local'));}catch{return {};}}
export const dataRoot=()=>setting('TRIPPIE_DATA_DIR','private/runtime');
export const isCloud=()=>Boolean(setting('SUPABASE_URL')&&setting('SUPABASE_SERVICE_ROLE_KEY'));
