import {after} from "next/server";
import {enqueueAnalysis,runAnalysisQueue} from "@/server/analysis.mjs";
import {reportingForms} from "@/lib/reporting-forms";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { adminAuth, deviceAuth, authResponse } from "@/server/auth.mjs";
import { get, list, put, saveAsset, workspace } from "@/server/store.mjs";
import { limitedBody, validateCapture } from "@/server/capture-input.mjs";
export const maxDuration=300;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
 if(!adminAuth(request) && !deviceAuth(request))return authResponse();
 try {
  const bytes=await limitedBody(request);
  const form=await new Request(request.url,{method:"POST",headers:{"Content-Type":request.headers.get("content-type")||""},body:bytes}).formData();
  const raw=form.get("metadata"), photo=form.get("photo");
  if(typeof raw!=="string" || raw.length>16000 || !(photo instanceof File))return Response.json({error:"Photo and metadata required"},{status:400});
  const capture=validateCapture(JSON.parse(raw));
  if((await workspace(capture.mode)).generation!==capture.generation)return Response.json({error:"Workspace cleared; old capture was not added"},{status:409});
  const image=Buffer.from(await photo.arrayBuffer());
  const info=await sharp(image,{limitInputPixels:25000000}).metadata();
  if(info.format!=="jpeg"||!info.width||!info.height) return Response.json({error:"Valid JPEG required"},{status:400});
  await sharp(image,{limitInputPixels:25000000,failOn:"warning"}).stats();
  const hash=createHash("sha256").update(image).digest("hex");
  const recordId=`${capture.mode}:ANDROID-${capture.id}`;
  const existing=await get("observation",recordId);
  if(existing) {
   if(existing.generation!==capture.generation || existing.captureHash!==hash || (existing.purpose||"inspection")!==capture.purpose || (existing.targetHint||"")!==capture.targetHint)return Response.json({error:"Capture ID already used"},{status:409});
   await enqueueAnalysis(existing);
   after(()=>runAnalysisQueue(capture.mode,reportingForms));
   return Response.json({added:true,id:existing.observation.id,mode:capture.mode,image:existing.observation.image},{headers:{"Cache-Control":"no-store"}});
  }
  const asset=(await list("asset",capture.mode)).find((a:{captureId:string;generation:number;sha256:string})=>a.captureId===capture.id && a.generation===capture.generation && a.sha256===hash) || await saveAsset(image,{mode:capture.mode,generation:capture.generation,captureId:capture.id});
  const observation={id:`ANDROID-${capture.id}`,mode:capture.mode,trippieId:"pixel-10",capturedAt:capture.requestedAt,title:"Android photo",category:"Capture",priority:"Unassessed",lat:capture.purpose==="obstacle-practice"?null:capture.location?.latitude??null,lng:capture.purpose==="obstacle-practice"?null:capture.location?.longitude??null,time:new Date(capture.requestedAt).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",timeZone:"America/Chicago"}),image:`/api/media/${asset.id}`,interpretation:"Photo received from Trippie. Model analysis has not run.",status:"Needs review",sample:false,analysisState:"captured",practice:capture.purpose==="obstacle-practice",gpsAccuracyMeters:capture.location?.accuracyMeters??null,locationLabel:capture.purpose==="obstacle-practice"?"Indoor obstacle practice":capture.location?"Phone GPS":"No GPS fix recorded"};
  const stored=await put("observation",{id:recordId,mode:capture.mode,generation:capture.generation,captureHash:hash,purpose:capture.purpose,mission:capture.mission,targetHint:capture.targetHint,observation},{ifAbsent:true});
  if(stored.captureHash!==hash || stored.generation!==capture.generation || (stored.purpose||"inspection")!==capture.purpose || (stored.targetHint||"")!==capture.targetHint)return Response.json({error:"Capture ID already used"},{status:409});
  await enqueueAnalysis(stored);
  after(()=>runAnalysisQueue(capture.mode,reportingForms));
  return Response.json({added:true,id:stored.observation.id,mode:capture.mode,image:stored.observation.image},{status:201,headers:{"Cache-Control":"no-store"}});
 } catch(error) {
  const tooLarge=error instanceof Error && error.message.includes("4 MB");
  return Response.json({error:tooLarge?"Photo exceeds 4 MB":"Capture could not be added; retry with a valid photo and current workspace"},{status:tooLarge?413:400});
 }
}
