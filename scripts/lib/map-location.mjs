const R=6371000;
export function distance(a,b){const p=(a.lat+b.lat)*Math.PI/360;return Math.hypot((a.lng-b.lng)*Math.PI/180*R*Math.cos(p),(a.lat-b.lat)*Math.PI/180*R);}
function segmentDistance(p,a,b){const scale=R*Math.PI/180;const c=Math.cos(p.lat*Math.PI/180);const x=(a[0]-p.lng)*scale*c,y=(a[1]-p.lat)*scale,dx=(b[0]-a[0])*scale*c,dy=(b[1]-a[1])*scale;const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x+t*dx,y+t*dy);}
export function resolveLocation(p,data){
 const roads=data.features.filter(f=>f.attributes.FULLNAME?.trim()&&f.attributes.STREET_TYPE!=='ALY').flatMap(f=>f.geometry.paths.map(path=>({...f,geometry:{paths:[path]}})));
 const ranked=roads.map(f=>({feature:f,distance:Math.min(...f.geometry.paths.flatMap(path=>path.slice(1).map((b,i)=>segmentDistance(p,path[i],b))))})).sort((a,b)=>a.distance-b.distance);
 if(!ranked.length||ranked[0].distance>80)throw new Error('No mapped street within 80 m; acquire more location evidence');
 const nearest=ranked[0],name=nearest.feature.attributes.FULLNAME.trim();
 const component=new Set([nearest.feature]);const queue=[nearest.feature];
 const endpoints=f=>f.geometry.paths.flatMap(path=>[path[0],path.at(-1)]).map(xy=>({lat:xy[1],lng:xy[0]}));
 while(queue.length){const current=queue.shift();for(const other of roads){if(component.has(other)||other.attributes.FULLNAME.trim()!==name)continue;if(endpoints(current).some(a=>endpoints(other).some(b=>distance(a,b)<1))){component.add(other);queue.push(other);}}}
 const intersections=[];
 for(const f of component)for(const path of f.geometry.paths)for(const xy of [path[0],path.at(-1)]){
  const point={lat:xy[1],lng:xy[0]};const cross=roads.filter(other=>other.attributes.FULLNAME.trim()!==name&&other.geometry.paths.some(path=>path.slice(1).some((b,i)=>segmentDistance(point,path[i],b)<1))).map(f=>f.attributes.FULLNAME.trim());
  if(cross.length)intersections.push({point,streets:[name,...new Set(cross)].sort(),distanceMeters:distance(p,point)});
 }
 intersections.sort((a,b)=>a.distanceMeters-b.distanceMeters);
 if(!intersections.length||intersections[0].distanceMeters>400)throw new Error('No connected mapped intersection within 400 m');
 const best=intersections[0];const bearing=(Math.atan2((p.lng-best.point.lng)*Math.cos(p.lat*Math.PI/180),p.lat-best.point.lat)*180/Math.PI+360)%360;
 const direction=['north','northeast','east','southeast','south','southwest','west','northwest'][Math.round(bearing/45)%8];
 return {label:best.streets.join(' & ')+', Plano, TX',street:name,intersection:best.streets,intersectionPoint:best.point,distanceToIntersectionMeters:Math.round(best.distanceMeters),distanceToStreetMeters:Math.round(nearest.distance),directionFromIntersection:direction,roadObjectId:nearest.feature.attributes.OBJECTID,privateStreet:nearest.feature.attributes.PRIVATESTREET==='Y',method:'City of Plano road geometry: nearest street, then nearest connected named intersection',confidence:'estimated',limitations:['Photo GPS accuracy and freshness are unreported; intersection is a map-based estimate, not a verified defect address.']};
}
