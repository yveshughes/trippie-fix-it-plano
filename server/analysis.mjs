import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {get,list,put,workspace,claimJob,putAnalysis,saveAsset,assetBytes} from './store.mjs';
import {assess,assessObstacle,segment} from './analysis-models.mjs';
import {candidateCase,draftFor} from './analysis-policy.mjs';
import {resolveLocation} from '../scripts/lib/map-location.mjs';

export async function enqueueAnalysis(record) {
 if(!record?.captureHash || !record.observation?.id?.startsWith('ANDROID-'))return;
 const id=record.id+':analysis-v1';
 const existing=await get('job',id);
 if(existing)return existing;
 return put('job',{id,mode:record.mode,generation:record.generation,trippieId:record.observation.trippieId,recordId:record.id,state:'queued',stage:'Queued for analysis',createdAt:new Date().toISOString()},{ifAbsent:true});
}
async function lookupLocation(observation) {
 if(observation.lat==null || observation.lng==null)return null;
 const p={lat:observation.lat,lng:observation.lng};
 if(p.lat<32.9||p.lat>33.2||p.lng< -96.9||p.lng> -96.5)return null;
 const source='https://maps.planogis.org/arcgiswad/rest/services/OpenData/RoadsAlleys/FeatureServer/0';
 const params=new URLSearchParams({f:'json',where:'1=1',geometry:[p.lng-.004,p.lat-.004,p.lng+.004,p.lat+.004].join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,FULLNAME,STREET_TYPE,PRIVATESTREET',returnGeometry:'true',outSR:'4326'});
 const response=await fetch(source+'/query?'+params,{signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('Map service unavailable');
 const data=await response.json();if(data.error||data.exceededTransferLimit||!Array.isArray(data.features))throw new Error('Incomplete road geometry');
 return {...resolveLocation(p,data),source,retrievedAt:new Date().toISOString()};
}
async function original(record) {
 const id=record.observation.image.match(/^\/api\/media\/([a-f0-9-]{36})$/)?.[1];
 if(!id)throw new Error('Original asset reference missing');
 const asset=await get('asset',id);
 if(!asset?.approved||asset.mode!==record.mode||asset.generation!==record.generation)throw new Error('Original asset unavailable');
 const bytes=await assetBytes(asset);
 if(createHash('sha256').update(bytes).digest('hex')!==record.captureHash)throw new Error('Original image hash mismatch');
 return sharp(bytes,{limitInputPixels:25000000}).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
}
async function processJob(job,forms,services) {
 let record=await get('observation',job.recordId);
 if(!record || record.generation!==job.generation)return;
 const practice=record.purpose==='obstacle-practice';
 const identity={id:record.id,mode:record.mode,generation:record.generation};
 async function assertLease() {
  if((await workspace(job.mode)).generation!==job.generation)throw new Error('Workspace cleared');
  const current=await get('job',job.id);
  if(current?.leaseToken!==job.leaseToken || current.leaseUntil<=Date.now())throw new Error('Analysis lease expired');
 }
 async function checkpoint(stage,extra={}) {
  await assertLease();
  job={...job,...extra,stage};await putAnalysis(job,'job',job);
  record={...record,observation:{...record.observation,analysisState:'analyzing',analysisStage:stage}};
  await putAnalysis(job,'observation',record);
 }
 try {
  await checkpoint('Muse analysis');
  const image=await original(record);
  const candidates=practice?[]:(await list('observation',job.mode)).filter(row=>candidateCase(record,row)).slice(0,3);
  if(!job.result) {
   const supplied=[];
   for(const candidate of candidates) {
    try { supplied.push({id:candidate.observation.caseId,title:candidate.observation.title,description:candidate.observation.submission.description,image:await original(candidate)}); }catch{}
   }
   const result=practice?await services.assessObstacle(image,record.targetHint||''):await services.assess(image,forms,supplied);
   await checkpoint('Muse analysis complete',{result});
  }
  const a=practice?{...job.result.assessment,decision:job.result.assessment.decision==='no_issue'?'no_issue':'follow_up',priority:'Unassessed',cityForm:'',description:'',requiredMissing:[],existingCaseId:null}:job.result.assessment;
  if(job.location===undefined) {
   await checkpoint('Location lookup');
   let location=null,locationWarning='';
   try {location=practice?null:await services.lookupLocation(record.observation);}catch{locationWarning='Map lookup unavailable; no address was inferred.';}
   await checkpoint('Location checked',{location,locationWarning});
  }
  let observation={...record.observation,title:a.title,category:practice?'Obstacle practice':a.issueType,practice,priority:a.priority,interpretation:a.observations.join(' '),observedFacts:a.observations,uncertainties:a.uncertainties,decision:a.decision,cityForm:a.cityForm,missingFields:a.requiredMissing,analysisState:'complete',analysisStage:'Analysis complete',analysisModel:{model:job.result.model,provider:job.result.provider,responseId:job.result.responseId,analyzedAt:job.result.analyzedAt},locationLabel:practice?'Indoor obstacle practice':job.location?.label||record.observation.locationLabel,locationMethod:job.location?.method||(record.observation.lat==null?'No GPS fix recorded':'Phone GPS'),...(job.location?{locationConfidence:'estimated',locationDistanceMeters:job.location.distanceToIntersectionMeters}:{})};
  if(a.decision!=='no_issue' && a.samPoint) {
   if(!job.highlight) {
    await checkpoint('SAM highlight');
    let highlight;
    try {
     const result=await services.segment(image,a,{practice});
     await assertLease();
     if(result.approved) {
      const asset=await saveAsset(result.highlighted,{mode:job.mode,generation:job.generation,captureId:observation.id,name:'sam-highlight.jpg',mime:'image/jpeg'});
      highlight={image:'/api/media/'+asset.id,status:'verified',sourceSha256:result.sourceSha256,requestId:result.requestId,reviewResponseId:result.reviewResponseId,review:result.reason};
     } else highlight={status:'rejected',review:result.reason};
    }catch{highlight={status:'unavailable',review:'No verified highlight available for this capture.'};}
    await checkpoint('Highlight checked',{highlight});
   }
   if(job.highlight.image)observation.samImage=job.highlight.image;
   observation.highlightStatus=job.highlight.status;
   observation.highlightReview=job.highlight.review;
  }
  const submission=practice?null:draftFor(a,observation,job.location,forms);
  let existing=candidates.find(row=>row.observation.caseId===a.existingCaseId);
  if(existing && (existing.observation.submission.requestType!==a.cityForm || !submission))existing=null;
  if(submission) {
   await checkpoint(existing?'Adding evidence to existing draft':'Preparing case draft');
   const caseId=existing?.observation.caseId || 'ANDROID-CASE-'+observation.id.slice(8);
   observation={...observation,caseId,caseRepresentative:!existing,...(!existing?{submission,caseText:submission.description}:{})};
   if(existing) {
    const evidence=[...(existing.observation.caseEvidence||[{id:existing.observation.id,image:existing.observation.image,samImage:existing.observation.samImage}])];
    if(!evidence.some(e=>e.id===observation.id))evidence.push({id:observation.id,image:observation.image,samImage:observation.samImage});
    await assertLease();
    await putAnalysis(job,'observation',{...existing,observation:{...existing.observation,caseEvidence:evidence}});
   }
   await assertLease();
   const currentCase=await get('case',caseId);
   await putAnalysis(job,'case',{...currentCase,...identity,id:caseId,state:currentCase?.state||'draft',finalSubmitAllowed:false,observationId:existing?.observation.id||observation.id,submission:existing?.observation.submission||submission,evidenceIds:[...new Set([...(currentCase?.evidenceIds||[]),observation.id])],model:job.result.model});
  } else if(a.decision==='prepare_case') {
   observation.decision='follow_up';
   observation.missingFields=[...new Set([...a.requiredMissing,...(!job.location?['Mapped location']:[]),'Verified form routing/requirements'])];
  }
  await assertLease();
  await putAnalysis(job,'observation',{...record,observation});
  await putAnalysis(job,'job',{...job,state:'complete',stage:'Analysis complete',completedAt:new Date().toISOString()});
 } catch(error) {
  try {
   await assertLease();
   const latest=await get('observation',job.recordId);
   await putAnalysis(job,'observation',{...latest,observation:{...latest.observation,analysisState:'failed',analysisStage:'Analysis failed · retry available'}});
   await putAnalysis(job,'job',{...job,state:'failed',stage:'Analysis failed',failureType:error?.status?`Provider ${error.status}`:error?.name==='APIConnectionTimeoutError'?'Model request timed out':/^(Incomplete model response|Invalid analysis|Invalid SAM|Unknown existing case|Muse credentials unavailable|SAM credentials unavailable)/.test(error?.message||'')?error.message.slice(0,100):'Analysis unavailable',failedAt:new Date().toISOString()});
  }catch{} // A reset or expired lease must never recreate deleted observations.
 }
}
export async function runAnalysisQueue(mode,forms,services={assess,assessObstacle,segment,lookupLocation}) {
 const started=Date.now();
 while(Date.now()-started<70000) {
  const generation=(await workspace(mode)).generation;
  const jobs=(await list('job',mode)).filter(j=>j.generation===generation && (j.state==='queued'||j.state==='running'&&j.leaseUntil<Date.now())).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  if(!jobs.length)return;
  const job=await claimJob(jobs[0].id);if(!job)return;
  await processJob(job,forms,services);
 }
}
export async function analysisSummary(mode) {
 const generation=(await workspace(mode)).generation;
 const jobs=(await list('job',mode)).filter(j=>j.generation===generation);
 return {mode,generation,queued:jobs.filter(j=>j.state==='queued').length,analyzing:jobs.filter(j=>j.state==='running').length,complete:jobs.filter(j=>j.state==='complete').length,failed:jobs.filter(j=>j.state==='failed').length};
}
