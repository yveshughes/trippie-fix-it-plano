import {readFileSync} from 'node:fs';
import {parse} from 'dotenv';
export function setting(name,fallback=''){return process.env[name]||local()[name]||fallback;}
function local(){try{return parse(readFileSync('.env.local'));}catch{return {};}}
export const dataRoot=()=>setting('TRIPPIE_DATA_DIR','private/runtime');
export const isCloud=()=>Boolean(setting('SUPABASE_URL')&&setting('SUPABASE_SERVICE_ROLE_KEY'));
