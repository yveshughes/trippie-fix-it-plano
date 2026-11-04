import {test} from 'node:test';import assert from 'node:assert/strict';
import {verifyMigratedObservation,verifyMigratedCase,verifyImportedEvidence} from '../scripts/lib/migration-verification.mjs';
const original='00000000-0000-4000-8000-000000000001',sam='00000000-0000-4000-8000-000000000002';
const assets=new Map([original,sam].map(id=>[id,{id,mode:'live',generation:0,approved:true,mime:'image/jpeg',sha256:id===original?'original-hash':'sam-hash'}]));
const sourceHashes=new Map([['source-original','original-hash'],['source-sam','sam-hash']]);
const source={id:'photo-1',image:'source-original',samImage:'source-sam',caseId:'case-1',submission:{photo:'source-original'},caseEvidence:[{id:'photo-1',image:'source-original',samImage:'source-sam'}]};
const observation={id:'photo-1',image:'/api/media/'+original,samImage:'/api/media/'+sam,submission:{photo:'/api/media/'+original},caseEvidence:[{id:'photo-1',image:'/api/media/'+original,samImage:'/api/media/'+sam}]};
const record=()=>({mode:'live',generation:0,observation:structuredClone(observation)});
test('original, SAM, supporting evidence and case attachment must resolve to approved workspace assets',()=>{
 verifyMigratedObservation(source,record(),assets,sourceHashes);
 verifyMigratedCase(source,{caseId:'case-1',mode:'live',generation:0,submission:observation.submission},assets,sourceHashes);
 for(const mutate of [r=>r.observation.image='/api/media/'+sam,r=>r.observation.samImage='/api/media/'+original,r=>delete r.observation.samImage,r=>r.observation.samImage='old-sam',r=>delete r.observation.caseEvidence[0].samImage,r=>r.observation.caseEvidence=[],r=>r.observation.submission.photo='/api/media/00000000-0000-4000-8000-000000000099']){
  const r=record();mutate(r);assert.throws(()=>verifyMigratedObservation(source,r,assets,sourceHashes));
 }
 for(const patch of [{approved:false},{mode:'demo'},{generation:1},{mime:'application/json'}]){
  const bad=new Map(assets);bad.set(sam,{...assets.get(sam),...patch});assert.throws(()=>verifyMigratedObservation(source,record(),bad,sourceHashes));
 }
 assert.throws(()=>verifyMigratedCase(source,{caseId:'case-1',mode:'live',generation:0,submission:{photo:'legacy-photo'}},assets,sourceHashes));
});

test('case-record attachments are downloaded even when distinct from observation attachments',async()=>{
 const {createHash}=await import('node:crypto');const bytes=Buffer.from('original');const mask=Buffer.from('mask');const hash=value=>createHash('sha256').update(value).digest('hex');
 const extra='00000000-0000-4000-8000-000000000003';const records=new Map(assets);
 for(const id of [original,extra])records.set(id,{...assets.get(original),id,sha256:hash(bytes)});
 records.set(sam,{...assets.get(sam),sha256:hash(mask)});
 const hashes=new Map([['source-original',hash(bytes)],['source-sam',hash(mask)]]);
 const input={...source,caseRepresentative:true};const cityCase={caseId:'case-1',mode:'live',generation:0,submission:{photo:'/api/media/'+extra}};
 const options={assets:records,sourceHashes:hashes,loadRecord:async kind=>kind==='case'?cityCase:record(),readBytes:async asset=>asset.id===sam?mask:bytes};
 const result=await verifyImportedEvidence([input],options);assert.equal(result.verifiedImages,3);
 await assert.rejects(verifyImportedEvidence([input],{...options,readBytes:async asset=>{if(asset.id===extra)throw new Error('Object missing');return options.readBytes(asset);}}),/Object missing/);
});
