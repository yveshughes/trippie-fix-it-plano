import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateAssessment,draftFor,candidateCase} from '../server/analysis-policy.mjs';
const a={decision:'prepare_case',priority:'Medium',title:'Raised slab edge',issueType:'Sidewalk',cityForm:'Sidewalk Repair Request',description:'A slab edge is chipped and raised.',samTarget:'chipped edge',samPoint:{x:.4,y:.6},samBox:{left:.3,top:.5,right:.5,bottom:.7},observations:['Chipped edge'],uncertainties:['Height not measured'],requiredMissing:[],existingCaseId:null};
const forms=[['Sidewalk','Sidewalk Repair Request','Address; description',''],['Animal','Dead Animal Pickup','Address; contact phone','']];
const location={label:'Street A & Street B, Plano, TX',distanceToIntersectionMeters:12,directionFromIntersection:'north',intersection:['Street A','Street B']};
test('only researched forms with required evidence produce drafts',()=>{
 assert.equal(validateAssessment(a).decision,'prepare_case');
 assert.throws(()=>validateAssessment({...a,existingCaseId:'invented'}));
 assert.throws(()=>validateAssessment({...a,samPoint:{x:.9,y:.9}}));
 assert.equal(draftFor(a,{image:'/original'},null,forms),null);
 assert.equal(draftFor({...a,cityForm:'Invented form'},{image:'/original'},location,forms),null);
 assert.equal(draftFor({...a,cityForm:'Dead Animal Pickup'},{image:'/original'},location,forms),null);
 assert.equal(draftFor({...a,requiredMissing:['Verified ownership']},{image:'/original'},location,forms),null);
 assert.equal(draftFor({...a,cityForm:'Flooding Issues / Erosion/Creek Maintenance'},{image:'/original'},location,[['Flood','Flooding Issues / Erosion/Creek Maintenance','Address; description','']]),null);
 assert.equal(draftFor({...a,decision:'no_issue'},{image:'/original'},location,forms),null);
 const draft=draftFor(a,{image:'/original'},location,forms);assert.equal(draft.photo,'/original');assert.match(draft.description,/estimated from phone GPS/);
});
test('case matching is limited to current workspace and reliable nearby evidence',()=>{
 const row={id:'old',mode:'demo',generation:2,captureHash:'one',observation:{submission:{requestType:'Sidewalk Repair Request'},caseRepresentative:true,lat:33,lng:-96,gpsAccuracyMeters:8}};
 const current={...row,id:'new',captureHash:'two',observation:{lat:33.0001,lng:-96,gpsAccuracyMeters:8}};
 assert.equal(candidateCase(current,row),true);
 assert.equal(candidateCase(current,{...row,mode:'live'}),false);
 assert.equal(candidateCase(current,{...row,generation:1}),false);
 assert.equal(candidateCase({...current,observation:{...current.observation,gpsAccuracyMeters:100}},row),false);
 assert.equal(candidateCase({...current,observation:{...current.observation,lat:null,lng:null}},row),false);
});
test('curb repair includes the separate required location description',()=>{
 const forms=[['Broken curbs','Curb Repair','Address; location (R); description','']];
 const draft=draftFor({...a,cityForm:'Curb Repair',requiredMissing:['Address','Location (R)']},{image:'/original',lat:33.034887,lng:-96.746816},location,forms);
 assert.equal(draft.requestType,'Curb Repair');assert.match(draft.locationDetails,/33.034887, -96.746816/);
 assert.equal(draftFor({...a,cityForm:'Curb Repair',requiredMissing:['Phone']},{image:'/original'},location,forms),null);
});
