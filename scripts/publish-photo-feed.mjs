import {readFile,writeFile,readdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {samPrompt,matchesSamPrompt} from './lib/sam-prompt.mjs';
import {checkedLocation,checkedCaseLocation} from './lib/location-integrity.mjs';
const root=path.resolve('private/pixel-analysis');
let plan;try{plan=JSON.parse(await readFile(path.join(root,'case-plan.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let locations;try{locations=JSON.parse(await readFile(path.join(root,'locations.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
let prepared;try{prepared=JSON.parse(await readFile(path.join(root,'prepared-city-forms.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const reports=[];
for(const entry of await readdir(root,{withFileTypes:true})){
 if(!entry.isDirectory())continue;
 try{const r=JSON.parse(await readFile(path.join(root,entry.name,'assessment.json'),'utf8'));reports.push({...r,id:entry.name});}catch(error){if(error.code!=='ENOENT')throw error;}
}
for(const c of plan?.cases||[]){const r=reports.find(r=>r.id===c.representativeId);if(!r)throw new Error('Missing representative photo');checkedCaseLocation(c.location,checkedLocation(locations,r.id,r));}
const maskIds=new Set();const maskRequests=new Map();
for(const r of reports){try{const s=JSON.parse(await readFile(path.join(root,r.id,'segmentation.json'),'utf8'));const review=JSON.parse(await readFile(path.join(root,r.id,'segmentation-review.json'),'utf8'));let override;try{override=JSON.parse(await readFile(path.join(root,r.id,'sam-prompt-review.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}const config=samPrompt(r,override);const image=await readFile(path.join(root,r.id,'sam-highlight.jpg'));const hash=createHash('sha256').update(image).digest('hex');if(review.imageSha256===hash&&config&&matchesSamPrompt(s,r,config)&&review.requestId===s.requestId&&review.status==='approved'){maskIds.add(r.id);maskRequests.set(r.id,s.requestId);}}catch(error){if(error.code!=='ENOENT')throw error;}}
const image=id=>`/api/evidence/${id}/original`;
const sam=id=>maskIds.has(id)?`/api/evidence/${id}/sam?rev=${encodeURIComponent(maskRequests.get(id))}`:undefined;
const rows=reports.map(r=>{
 const a=r.assessment;const c=plan?.cases.find(c=>c.photoIds.includes(r.id));
 const location=checkedLocation(locations,r.id,r);
 const form=c&&prepared?.cases.find(f=>f.caseId===c.id&&f.caseResponseId===plan.responseId&&f.sourceSha256===c.location.sourceSha256);
 const submission=c&&c.decision==='prepare_case'?{requestType:form?.cityForm||c.cityForm,address:form?.address||c.location.label,description:form?.description||c.description,photo:image(c.representativeId)}:undefined;
 const observationOnly=plan?.observationOnlyIds.includes(r.id);
 const decision=c?.decision || (observationOnly&&a.decision!=='no_issue'?'follow_up':a.decision);
 if(!Number.isFinite(r.exif.latitude)||!Number.isFinite(r.exif.longitude))throw new Error('Missing GPS: resolve location before publishing a map marker');
 const u=r.usage;const cached=u.prompt_tokens_details?.cached_tokens||0;
 return {id:'PIX-'+r.id,trippieId:'pixel-10',capturedAt:r.capturedAt,title:c?.title||a.title,category:a.issueType,priority:c?.priority||a.priority,lat:r.exif.latitude,lng:r.exif.longitude,time:new Date(r.capturedAt).toLocaleTimeString('en-US',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit'}),image:image(r.id),samImage:sam(r.id),submission,interpretation:a.observations.join(' '),status:'Needs review',sample:false,decision,locationLabel:location?.label,locationMethod:location?.method,locationDistanceMeters:location?.distanceToIntersectionMeters,locationConfidence:location?.confidence,cityForm:c?.cityForm||a.cityForm,caseText:decision==='no_issue'||observationOnly?undefined:submission?.description||c?.description||a.description,missingFields:c?.missingFields||a.requiredMissing,observedFacts:a.observations,uncertainties:c?.uncertainties||a.uncertainties,sourceFile:r.source,gpsAccuracyMeters:r.exif.gpsAccuracyMeters,modelInfo:{model:r.model,provider:r.provider,responseId:r.responseId,requestId:r.requestId,analyzedAt:r.completedAt,estimatedCostUsd:((u.prompt_tokens-cached)*1.25+cached*.15+u.completion_tokens*4.25)/1e6},caseId:c?.id,caseRepresentative:plan?Boolean(c&&c.representativeId===r.id):undefined,groupingReason:c?.groupingReason,caseEvidence:c?.photoIds.map(id=>({id,image:image(id),samImage:sam(id)})),caseResponseId:c?plan.responseId:undefined};
});
rows.sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
await writeFile(path.join(root,'feed.json.tmp'),JSON.stringify(rows,null,2));
await rename(path.join(root,'feed.json.tmp'),path.join(root,'feed.json'));
console.log(JSON.stringify({observations:rows.length,caseGroups:plan?.cases.length||0,realSamOutputs:maskIds.size,estimatedPhotoAnalysisCostUsd:rows.reduce((s,r)=>s+r.modelInfo.estimatedCostUsd,0)},null,2));
