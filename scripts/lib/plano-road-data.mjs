import {readFile,writeFile,rename} from 'node:fs/promises';
export async function loadRoadData(points,file){
 const source='https://maps.planogis.org/arcgiswad/rest/services/OpenData/RoadsAlleys/FeatureServer/0';
 let cached;try{cached=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const inside=(b,p)=>p.lng>=b[0]&&p.lat>=b[1]&&p.lng<=b[2]&&p.lat<=b[3];
 if(cached?.source===source&&cached.bounds&&Date.now()-Date.parse(cached.retrievedAt)<30*86400000&&points.every(p=>inside([cached.bounds[0]+.001,cached.bounds[1]+.001,cached.bounds[2]-.001,cached.bounds[3]-.001],p)))return cached;
 if(!points.length||points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat<32.9||p.lat>33.2||p.lng< -96.9||p.lng> -96.5))throw new Error('Coordinates outside Plano adapter coverage');
 const bounds=[Math.min(...points.map(p=>p.lng))-.004,Math.min(...points.map(p=>p.lat))-.004,Math.max(...points.map(p=>p.lng))+.004,Math.max(...points.map(p=>p.lat))+.004];
 if(bounds[2]-bounds[0]>.05||bounds[3]-bounds[1]>.05)throw new Error('Split patrol into neighborhood-sized location batches');
 const params=new URLSearchParams({f:'json',where:'1=1',geometry:bounds.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'*',returnGeometry:'true',outSR:'4326'});
 const response=await fetch(source+'/query?'+params,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error('Plano map lookup failed: '+response.status);
 const data=await response.json();
 if(data.error||data.exceededTransferLimit||!Array.isArray(data.features)||!data.features.length)throw new Error('Incomplete Plano road dataset');
 const result={...data,source,bounds,retrievedAt:new Date().toISOString()};
 await writeFile(file+'.tmp',JSON.stringify(result,null,2));await rename(file+'.tmp',file);return result;
}
