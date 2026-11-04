// Read-only cloud check. Does not rerun inference, uploads, or the migration.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isCloud} from '../server/config.mjs';
import {get,list,assetBytes} from '../server/store.mjs';
import {verifyImportedEvidence} from './lib/migration-verification.mjs';
if(!isCloud())throw new Error('Configure Supabase server credentials in .env.local before verifying.');
const feed=JSON.parse(await readFile('private/pixel-analysis/feed.json','utf8'));
const assets=new Map((await list('asset','live')).map(a=>[a.id,a]));
const sourceHashes=new Map();
for(const source of feed){
 const urls=[source.image,source.samImage,source.submission?.photo,...(source.caseEvidence||[]).flatMap(e=>[e.image,e.samImage])].filter(Boolean);
 for(const url of urls){
  if(sourceHashes.has(url))continue;
  const match=url.match(/^\/api\/evidence\/([a-f0-9]{16})\/(original|sam)(?:\?rev=[^&]+)?$/);
  if(!match)throw new Error('Unexpected local evidence reference');
  const bytes=await readFile('private/pixel-analysis/'+match[1]+'/'+(match[2]==='original'?'original-view.jpg':'sam-highlight.jpg'));
  sourceHashes.set(url,createHash('sha256').update(bytes).digest('hex'));
 }
}
const verified=await verifyImportedEvidence(feed,{assets,sourceHashes,loadRecord:get,readBytes:assetBytes});
console.log(JSON.stringify({status:'verified',readOnly:true,...verified}));
