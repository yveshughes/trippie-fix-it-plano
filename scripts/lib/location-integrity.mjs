export function checkedLocation(locations,id,record){
 const l=locations?.photos?.[id];
 if(!l||l.sourceSha256!==record.sourceSha256||l.photoPoint?.lat!==record.exif.latitude||l.photoPoint?.lng!==record.exif.longitude||typeof l.label!=='string'||l.confidence!=='estimated'||!Number.isFinite(l.distanceToIntersectionMeters))throw new Error('Missing or stale location for '+id+'; run resolve-locations first');
 return l;
}
export function checkedCaseLocation(saved,current){
 const fields=['sourceSha256','label','street','intersectionPoint','distanceToIntersectionMeters','distanceToStreetMeters','directionFromIntersection','photoPoint'];
 if(!saved||fields.some(k=>JSON.stringify(saved[k])!==JSON.stringify(current[k])))throw new Error('Case location changed; regroup required before publication');
 return current;
}
