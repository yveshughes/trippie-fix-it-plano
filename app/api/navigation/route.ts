import sharp from 'sharp';
import {deviceAuth,authResponse} from '@/server/auth.mjs';
import {limitedBody} from '@/server/capture-input.mjs';
import {inspectNavigation,validateMission} from '@/server/navigation.mjs';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request) {
 if(!deviceAuth(request))return authResponse();
 const requestId=request.headers.get('x-trippie-frame-id');
 if(!requestId||!/^[a-f0-9-]{36}$/.test(requestId))return Response.json({error:'Frame ID required'},{status:400});
 let mission;
 try {
  const goal=decodeURIComponent(request.headers.get('x-trippie-goal')||'Find%20a%20clear%20direction%20ahead');
  mission=validateMission({goal,mode:request.headers.get('x-trippie-mission-mode')||'navigate'});
 } catch {return Response.json({error:'Valid mission required'},{status:400});}
 try {
  const bytes=await limitedBody(request);
  const info=await sharp(bytes,{limitInputPixels:25000000}).metadata();
  if(info.format!=='jpeg')throw new Error('JPEG required');
  const image=await sharp(bytes,{limitInputPixels:25000000,failOn:'warning'}).rotate().resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).jpeg({quality:80}).toBuffer();
  return Response.json({requestId,...await inspectNavigation(image,mission)},{headers:{'Cache-Control':'no-store'}});
 } catch {
  return Response.json({requestId,action:'stop',previewOnly:true,error:'View could not be assessed; hold position'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
