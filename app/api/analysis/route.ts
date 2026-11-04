import {after} from "next/server";
import {adminAuth,deviceAuth,authResponse} from "@/server/auth.mjs";
import {get,list,putAnalysis,workspace} from "@/server/store.mjs";
import {enqueueAnalysis,runAnalysisQueue,analysisSummary} from "@/server/analysis.mjs";
import {reportingForms} from "@/lib/reporting-forms";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
export async function GET(request:Request) {
 const mode=new URL(request.url).searchParams.get("mode")||"demo";
 if(!["live","demo"].includes(mode))return Response.json({error:"Invalid workspace"},{status:400});
 const captureId=new URL(request.url).searchParams.get("captureId");
 if(captureId) {
  if(!adminAuth(request)&&!deviceAuth(request))return authResponse();
  if(!/^[a-f0-9-]{36}$/.test(captureId))return Response.json({error:"Invalid capture"},{status:400});
  try {
   const record=await get("observation",`${mode}:ANDROID-${captureId}`);
   if(!record || record.generation!==(await workspace(mode)).generation)return Response.json({error:"Capture not found"},{status:404});
   const job=await get("job",record.id+":analysis-v1");
   const cityCase=record.observation.caseId?await get("case",record.observation.caseId):null;
   return Response.json({observation:record.observation,mission:record.mission??null,stage:job?.stage??"Photo received",state:job?.state??"queued",hasInterpretation:!!job?.result,hasLocation:!!job?.location,hasHighlight:!!job?.highlight,highlightStatus:job?.highlight?.status??null,caseState:cityCase?.state??null,receipt:cityCase?.receipt??null},{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"Inspection status unavailable"},{status:503});}
 }
 try {return Response.json({...await analysisSummary(mode),canManage:adminAuth(request)},{headers:{"Cache-Control":"no-store"}});}
 catch{return Response.json({error:"Analysis status unavailable"},{status:503});}
}
export async function POST(request:Request) {
 if(!adminAuth(request)&&!deviceAuth(request))return authResponse();
 try {
  const {mode,retry=false}=await request.json();
  if(!["live","demo"].includes(mode)||typeof retry!=="boolean")return Response.json({error:"Workspace required"},{status:400});
  if(retry && !adminAuth(request))return authResponse();
  const generation=(await workspace(mode)).generation;
  for(const record of await list("observation",mode))if(record.generation===generation && record.observation?.analysisState)await enqueueAnalysis(record);
  if(retry)for(const job of await list("job",mode))if(job.generation===generation&&job.state==="failed")await putAnalysis(job,"job",{...job,state:"queued",stage:"Queued for retry"});
  after(()=>runAnalysisQueue(mode,reportingForms));
  return Response.json(await analysisSummary(mode),{status:202,headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Analysis could not start"},{status:503});}
}
