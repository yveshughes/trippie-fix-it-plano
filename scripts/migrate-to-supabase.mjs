// Additive, resumable migration. Originals and local SQLite are retained.
import { DatabaseSync } from 'node:sqlite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isCloud, dataRoot } from '../server/config.mjs';
import { get, list, put, workspace, saveAsset, assetBytes } from '../server/store.mjs';
const apply = process.argv.includes('--apply');
const localRoot = dataRoot();
const feed = JSON.parse(await readFile('private/pixel-analysis/feed.json','utf8'));
const db = new DatabaseSync(path.join(localRoot,'trippie.sqlite'),{readOnly:true});
const rows = db.prepare('SELECT kind,id,mode,generation,payload FROM records ORDER BY kind,id').all();
const manifest = {observations:feed.length,cases:new Set(feed.map(r=>r.caseId).filter(Boolean)).size,sqliteRecords:rows.length,originalPhotos:feed.length,samHighlights:feed.filter(r=>r.samImage).length};
console.log(JSON.stringify({action:apply?'migrate':'dry-run',...manifest}));
if (!apply) { db.close(); process.exit(0); }
if (!isCloud()) throw new Error('Configure server-only Supabase URL and service role key before migration.');
const backupDir='private/migration-backups/'+new Date().toISOString().replaceAll(':','-');
await mkdir(backupDir,{recursive:true});
// SQLite backup API includes committed WAL content; a file copy alone would not.
db.exec("VACUUM INTO '"+path.resolve(backupDir,'trippie.sqlite').replaceAll("'","''")+"'");
await writeFile(path.join(backupDir,'feed.json'),JSON.stringify(feed,null,2));
db.close();
const sourceAssets=rows.filter(r=>r.kind==='asset').map(r=>JSON.parse(r.payload));
// Never rewind an existing cloud workspace or overwrite unrelated settings.
for(const row of rows.filter(r=>r.kind==='workspace')) {
 const local=JSON.parse(row.payload),remote=await get(row.kind,row.id);
 if(remote && remote.generation!==local.generation)throw new Error('Cloud workspace differs; reconcile before migrating.');
 if(!remote){const saved=await put(row.kind,local,{ifAbsent:true});if(saved.generation!==local.generation)throw new Error('Cloud workspace changed during migration');}
}
const assets=await list('asset');
async function upload(bytes,info) {
 const sha256=createHash('sha256').update(bytes).digest('hex');
 let asset=assets.find(a=>a.mode===info.mode&&a.generation===info.generation&&a.captureId===info.captureId&&a.sha256===sha256&&a.approved===info.approved);
 if(!asset){asset=await saveAsset(bytes,info);assets.push(asset);}
 const remote=await assetBytes(asset);
 if(createHash('sha256').update(remote).digest('hex')!==sha256)throw new Error('Uploaded evidence hash mismatch');
 return asset;
}
const urls=new Map();
for(const observation of feed) {
 for(const [kind,url] of [['original',observation.image],['sam',observation.samImage]]) {
  if(!url||urls.has(url))continue;
  const match=url.match(/^\/api\/evidence\/([a-f0-9]{16})\/(original|sam)(?:\?rev=([^&]+))?$/);
  if(!match||match[2]!==kind)throw new Error('Unexpected evidence URL');
  const folder=path.join('private/pixel-analysis',match[1]);
  const bytes=await readFile(path.join(folder,kind==='original'?'original-view.jpg':'sam-highlight.jpg'));
  if(kind==='sam') {
   const review=JSON.parse(await readFile(path.join(folder,'segmentation-review.json')));
   const segmentation=JSON.parse(await readFile(path.join(folder,'segmentation.json')));
   const revision=decodeURIComponent(match[3]||'');
   if(review.status!=='approved'||review.requestId!==revision||segmentation.requestId!==revision||review.imageSha256!==createHash('sha256').update(bytes).digest('hex'))throw new Error('SAM review does not match evidence');
  }
  const asset=await upload(bytes,{mode:'live',generation:0,captureId:match[1],name:kind+'.jpg',mime:'image/jpeg',approved:true});
  urls.set(url,'/api/media/'+asset.id);
 }
}
// Existing SQLite assets are uncommon, but copy and remap them too.
for(const asset of sourceAssets) {
 if(!/^(live|demo)\//.test(asset.key)||asset.key.includes('..'))throw new Error('Invalid source storage key');
 const bytes=await readFile(path.join(localRoot,'assets',asset.key));
 const uploaded=await upload(bytes,{mode:asset.mode,generation:asset.generation,captureId:asset.captureId,name:'migrated.jpg',mime:asset.mime,approved:asset.approved});
 urls.set('/api/media/'+asset.id,'/api/media/'+uploaded.id);
}
function remap(value) {
 if(typeof value==='string')return urls.get(value)||value;
 if(Array.isArray(value))return value.map(remap);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,remap(v)]));
 return value;
}
async function insert(kind,record) {
 const existing=await get(kind,record.id);
 // Stable observation/case keys make repeat runs safe; leave cloud edits untouched.
 const saved=existing||await put(kind,record,{ifAbsent:true});
 if(saved.mode!==record.mode||saved.generation!==record.generation)throw new Error('Cloud record identity conflict');
}
for(const row of rows.filter(r=>!['workspace','asset'].includes(r.kind)))await insert(row.kind,remap(JSON.parse(row.payload)));
for(const observation of feed) {
 const migrated=remap({...observation,mode:'live'});
 await insert('observation',{id:'live:'+observation.id,mode:'live',generation:0,observation:migrated});
}
for(const observation of feed.filter(r=>r.caseRepresentative&&r.submission))await insert('case',{id:'live:'+observation.caseId,mode:'live',generation:0,caseId:observation.caseId,observationId:observation.id,submission:remap(observation.submission),state:'draft',finalSubmitAllowed:false});
for(const observation of feed) {
 const record=await get('observation','live:'+observation.id);
 if(!record?.observation?.image?.startsWith('/api/media/'))throw new Error('Observation migration incomplete');
}
await writeFile(path.join(backupDir,'manifest.json'),JSON.stringify({...manifest,verifiedAssets:urls.size,completedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({status:'verified',...manifest,verifiedAssets:urls.size,localBackup:backupDir}));
