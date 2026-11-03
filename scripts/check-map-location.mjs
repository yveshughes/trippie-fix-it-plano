import assert from 'node:assert/strict';
import {checkedLocation,checkedCaseLocation} from './lib/location-integrity.mjs';
import {resolveLocation} from './lib/map-location.mjs';
const road=(name,points)=>({attributes:{FULLNAME:name,STREET_TYPE:'DR',OBJECTID:name},geometry:{paths:[points]}});
const data={features:[road('MAIN DR',[[0,0],[0,.002]]),road('CROSS DR',[[-.002,0],[.002,0]]),road('UNCONNECTED DR',[[.0001,.001],[.001,.001]])]};
const r=resolveLocation({lat:.001,lng:0},data);
assert.deepEqual(r.intersection,['CROSS DR','MAIN DR']);assert.equal(r.distanceToStreetMeters,0);assert.equal(r.distanceToIntersectionMeters,111);assert.equal(r.confidence,'estimated');
assert.throws(()=>resolveLocation({lat:2,lng:2},data),/No mapped street/);
const disconnected={features:[...data.features,road('MAIN DR',[[.00015,.0008],[.00015,.0012]]),road('FALSE CROSS DR',[[.0001,.0008],[.001,.0008]])]};
assert.deepEqual(resolveLocation({lat:.001,lng:0},disconnected).intersection,['CROSS DR','MAIN DR']);
console.log('Map resolver checks passed: connected intersection, offset, estimate label, out-of-area rejection.');

const record={sourceSha256:'abc',exif:{latitude:1,longitude:2}};const locations={photos:{p:{sourceSha256:'abc',photoPoint:{lat:1,lng:2},label:'A & B',confidence:'estimated',distanceToIntersectionMeters:3}}};
assert.equal(checkedLocation(locations,'p',record).label,'A & B');
assert.throws(()=>checkedLocation(locations,'missing',record),/Missing or stale/);
assert.throws(()=>checkedLocation(locations,'p',{...record,sourceSha256:'other'}),/Missing or stale/);
assert.throws(()=>checkedLocation(locations,'p',{...record,exif:{latitude:2,longitude:2}}),/Missing or stale/);

assert.equal(checkedCaseLocation(locations.photos.p,locations.photos.p).label,"A & B");
assert.throws(()=>checkedCaseLocation({...locations.photos.p,label:"Old & Road"},locations.photos.p),/regroup required/);
