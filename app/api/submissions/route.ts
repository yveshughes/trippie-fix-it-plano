import {adminAuth,deviceAuth,authResponse} from '@/server/auth.mjs';
import {get,put,workspace,trace} from '@/server/store.mjs';
import {randomUUID} from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request) {
 if(!adminAuth(request)&&!deviceAuth(request))return authResponse();
 try {
  const b=await request.json();
  if(!['live','demo'].includes(b.mode)||!/^[a-f0-9-]{36}$/.test(b.captureId)||!/^[a-f0-9-]{36}$/.test(b.attemptId)||!['prepare','dispatch','confirm'].includes(b.action))return Response.json({error:'Invalid submission command'},{status:400});
  const record=await get('observation',`${b.mode}:ANDROID-${b.captureId}`);
  if(!record||record.generation!==(await workspace(b.mode)).generation)return Response.json({error:'Capture unavailable'},{status:404});
  const cityCase=record.observation.caseId?await get('case',record.observation.caseId):null;
  const analysis=await get('job',record.id+':analysis-v1');
  if(analysis?.state!=='complete'||record.observation.decision!=='prepare_case'||JSON.stringify(record.observation.submission)!==JSON.stringify(cityCase?.submission))return Response.json({error:'Latest analysis must prepare this exact case'},{status:409});
  if(b.mode!=='live'||record.purpose!=='inspection'||record.observation.practice||!cityCase||cityCase.submission?.requestType!=='Curb Repair')return Response.json({error:'Only an analyzed LIVE curb case can use this adapter'},{status:409});
  if(cityCase.receipt)return Response.json({state:'confirmed',receipt:cityCase.receipt,url:cityCase.trackingUrl},{headers});
  const id=cityCase.id+':city-submission', identity={id,mode:b.mode,generation:record.generation};
  const attempt=await put('submission',{...identity,attemptId:b.attemptId,state:'prepared',createdAt:new Date().toISOString()},{ifAbsent:true});
  if(attempt.attemptId!==b.attemptId)return Response.json({error:'Another submission attempt exists; reconcile with the city before retrying'},{status:409});
  if(b.action==='prepare')return Response.json({state:attempt.state,submission:cityCase.submission,latitude:record.observation.lat,longitude:record.observation.lng,sourceHash:record.captureHash},{headers});
  if(b.action==='dispatch') {
   if(attempt.state!=='prepared')return Response.json({error:'Submission already dispatched; check city response before retrying'},{status:409});
   const dispatchToken=randomUUID();
   const claim=await put('submission-dispatch',{...identity,id:id+':dispatch',attemptId:b.attemptId,dispatchToken},{ifAbsent:true});
   if(claim.dispatchToken!==dispatchToken)return Response.json({error:'City dispatch already reserved; do not resend'},{status:409});
   await put('submission',{...attempt,state:'dispatched',dispatchedAt:new Date().toISOString()});
   await trace(identity,'city.dispatch',{caseId:cityCase.id,attemptId:b.attemptId});
   return Response.json({state:'dispatched'},{headers});
  }
  if(!['dispatched','confirmed'].includes(attempt.state)||!/^\d{4,20}$/.test(b.receipt)||typeof b.evidence!=='string'||b.evidence.length>16000)return Response.json({error:'City confirmation required'},{status:400});
  const url=new URL(b.url);
  if(url.protocol!=='https:'||url.hostname!=='iframe.publicstuff.com'||!b.evidence.includes(b.receipt))return Response.json({error:'Invalid city confirmation evidence'},{status:400});
  const confirmation={receipt:b.receipt,trackingUrl:url.href,submittedAt:new Date().toISOString()};
  // Receipt is recorded from the city's visible response, never from model output.
  await put('submission',{...attempt,...confirmation,state:'confirmed',evidence:b.evidence});
  await put('case',{...cityCase,...confirmation,state:'Submitted',finalSubmitAllowed:false});
  await put('observation',{...record,observation:{...record.observation,...confirmation,status:'Submitted'}});
  await trace(identity,'city.confirmed',{caseId:cityCase.id,...confirmation});
  return Response.json({state:'confirmed',...confirmation},{headers});
 }catch{return Response.json({error:'Submission service unavailable; do not resend an uncertain city request'},{status:503});}
}
