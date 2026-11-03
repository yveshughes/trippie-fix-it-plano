import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {resolveLocation} from './lib/map-location.mjs';
import {loadRoadData} from './lib/plano-road-data.mjs';
const root=path.resolve('private/pixel-analysis');
const records=[];
for(const e of await readdir(root,{withFileTypes:true})){
 if(!e.isDirectory())continue;let r;try{r=JSON.parse(await readFile(path.join(root,e.name,'assessment.json'),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 records.push({...r,id:e.name});
}
const roads=await loadRoadData(records.map(r=>({lat:r.exif.latitude,lng:r.exif.longitude})),path.join(root,'map-roads.json'));
const out={source:roads.source,retrievedAt:roads.retrievedAt,resolvedAt:new Date().toISOString(),attribution:'City of Plano Land Records Division',photos:{}};
for(const r of records){const point={lat:r.exif.latitude,lng:r.exif.longitude};out.photos[r.id]={...resolveLocation(point,roads),photoPoint:point,sourceSha256:r.sourceSha256};}
await writeFile(path.join(root,'locations.json'),JSON.stringify(out,null,2));
console.log(Object.entries(out.photos).map(([id,l])=>({id,intersection:l.label,distanceMeters:l.distanceToIntersectionMeters,streetDistance:l.distanceToStreetMeters})));
