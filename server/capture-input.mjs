export const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;
export function validateCapture(input) {
 if (!input || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.id || '')) throw new Error('Invalid capture ID');
 if (!['live','demo'].includes(input.mode) || !Number.isInteger(input.generation) || input.generation < 0) throw new Error('Capture workspace required');
 if (typeof input.requestedAt !== 'string' || !Number.isFinite(Date.parse(input.requestedAt))) throw new Error('Capture time required');
 const purpose=input.purpose??'inspection';
 if(!['inspection','obstacle-practice'].includes(purpose)||purpose==='obstacle-practice'&&input.mode!=='demo')throw new Error('Obstacle practice requires DEMO');
 const targetHint=input.targetHint??'';
 if(typeof targetHint!=='string'||targetHint.length>80)throw new Error('Target hint too long');
 let mission=null;
 if(input.mission!=null) {
  if(typeof input.mission.goal!=="string"||input.mission.goal.length>240||!["patrol","navigate"].includes(input.mission.mode))throw new Error("Invalid mission");
  mission={goal:input.mission.goal.trim(),mode:input.mission.mode};
 }
 let location = null;
 if(input.location != null) {
  const l=input.location;
  if(!Number.isFinite(l.latitude)||Math.abs(l.latitude)>90||!Number.isFinite(l.longitude)||Math.abs(l.longitude)>180)throw new Error('Invalid GPS coordinates');
  if(!Number.isFinite(l.ageAtRequestMs)||l.ageAtRequestMs<0||l.ageAtRequestMs>30000)throw new Error('GPS fix is stale');
  if(l.accuracyMeters!=null&&(!Number.isFinite(l.accuracyMeters)||l.accuracyMeters<0))throw new Error('Invalid GPS accuracy');
  location={latitude:l.latitude,longitude:l.longitude,accuracyMeters:l.accuracyMeters??null};
 }
 return {id:input.id,mode:input.mode,generation:input.generation,requestedAt:input.requestedAt,location,purpose,mission,targetHint:targetHint.trim()};
}
export async function limitedBody(request) {
 const reader=request.body?.getReader(); if(!reader)throw new Error('Photo required');
 const chunks=[];let size=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_CAPTURE_BYTES)throw new Error('Capture exceeds 4 MB');chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 return Buffer.concat(chunks);
}
