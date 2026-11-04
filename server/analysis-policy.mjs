const decisions=['prepare_case','follow_up','no_issue','phone_escalation','routing_review'];
export function validateAssessment(input,candidateIds=[]) {
 const a=input;
 if(!a||!decisions.includes(a.decision)||!['High','Medium','Low'].includes(a.priority))throw new Error('Invalid analysis decision');
 for(const k of ['title','issueType','cityForm','description','samTarget'])if(typeof a[k]!=='string'||a[k].length>6000)throw new Error('Invalid analysis text');
 for(const k of ['observations','uncertainties','requiredMissing'])if(!Array.isArray(a[k])||a[k].length>30||a[k].some(x=>typeof x!=='string'||x.length>1000))throw new Error('Invalid analysis facts');
 if(a.existingCaseId!=null&&!candidateIds.includes(a.existingCaseId))throw new Error('Unknown existing case');
 const point=a.samPoint;
 if(point!==null&&(!point||!['x','y'].every(k=>Number.isFinite(point[k])&&point[k]>=0&&point[k]<1)))throw new Error('Invalid SAM point');
 if(a.samBox!=null){const b=a.samBox;if(!['left','top','right','bottom'].every(k=>Number.isFinite(b[k])&&b[k]>=0&&b[k]<=1)||b.right<=b.left||b.bottom<=b.top||!point||point.x<b.left||point.x>=b.right||point.y<b.top||point.y>=b.bottom)throw new Error('Invalid SAM box');}
 return a;
}
export function draftFor(assessment,observation,location,forms) {
 if(assessment.decision!=='prepare_case')return null;
 // Only exact audited forms with no required contact/ownership/choice fields can be prepared unattended.
 const allowed=['Pothole Report','Sidewalk Repair Request','ADA Access Issues','Tree/Shrub Issue','Curb Repair'];
 const unresolved=assessment.requiredMissing.filter(field=>!location || !['address','location','location (r)','mapped location'].includes(field.toLowerCase().trim()));
 const route=forms.find(row=>allowed.includes(row[1]) && row[1]===assessment.cityForm && ['address; description','address; location (r); description'].includes(row[2].toLowerCase()));
 if(!route||!location||unresolved.length||!assessment.description.trim())return null;
 return {requestType:route[1],address:location.label,...(route[1]==='Curb Repair'?{locationDetails:`Curb at phone GPS ${observation.lat}, ${observation.lng}; about ${location.distanceToIntersectionMeters} metres ${location.directionFromIntersection} of ${location.intersection.join(' & ')}.`}:{}),description:`${assessment.description.trim()} Estimated location: about ${location.distanceToIntersectionMeters} metres ${location.directionFromIntersection} of ${location.intersection.join(' & ')}, Plano. Location is estimated from phone GPS; the defect has not been measured.`,photo:observation.image};
}
export function candidateCase(current,record) {
 if(record.mode!==current.mode||record.generation!==current.generation||record.id===current.id||!record.observation?.submission||!record.observation?.caseRepresentative)return false;
 if(record.captureHash===current.captureHash)return true;
 const a=current.observation,b=record.observation;
 if(a.lat==null||a.lng==null||b.lat==null||b.lng==null||a.gpsAccuracyMeters==null||a.gpsAccuracyMeters>30||b.gpsAccuracyMeters==null||b.gpsAccuracyMeters>30)return false;
 const meters=Math.hypot((a.lat-b.lat)*111195,(a.lng-b.lng)*111195*Math.cos(a.lat*Math.PI/180));
 return meters<=40;
}
