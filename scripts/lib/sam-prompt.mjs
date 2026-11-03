import {createHash} from 'node:crypto';
import {buildObjectPrompt} from '@meta-sam/parser';
export function samPrompt(report,override){
 const {width,height}=report;
 const point=override?.point||report.assessment.samPoint;if(!point)return null;
 const valid=p=>p&&['x','y'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=1);
 const region=override?.cropRegion||{left:0,top:0,width,height};
 if(!['left','top','width','height'].every(k=>Number.isInteger(region[k]))||region.left<0||region.top<0||region.width<1||region.height<1||region.left+region.width>width||region.top+region.height>height)throw new Error('Invalid SAM crop');
 const positivePoints=override?.positivePoints||[point],negativePoints=override?.negativePoints||[];
 if(!positivePoints.length||![...positivePoints,...negativePoints].every(valid))throw new Error('Invalid SAM points');
 const inside=p=>p.x*width>=region.left&&p.x*width<region.left+region.width&&p.y*height>=region.top&&p.y*height<region.top+region.height;
 const px=p=>({x:Math.min(region.width-1,Math.floor(p.x*width)-region.left),y:Math.min(region.height-1,Math.floor(p.y*height)-region.top)});
 if(!positivePoints.every(inside))throw new Error('SAM positive point outside crop');
 const positives=positivePoints.map(p=>({...px(p),label:'positive'})),negatives=negativePoints.filter(inside).map(p=>({...px(p),label:'negative'}));
 let box;
 if(override?.box){const b=override.box;if(!['left','top','right','bottom'].every(k=>Number.isFinite(b[k])&&b[k]>=0&&b[k]<=1)||b.right<=b.left||b.bottom<=b.top)throw new Error('Invalid SAM box');box={left:Math.floor(b.left*width)-region.left,top:Math.floor(b.top*height)-region.top,right:Math.ceil(b.right*width)-region.left,bottom:Math.ceil(b.bottom*height)-region.top};}
 const prompt=buildObjectPrompt({size:{width:region.width,height:region.height},objects:[{id:0,prompts:[{...(box?{box}:{}),points:[...positives,...negatives]}]}]});
 const signature=createHash('sha256').update(JSON.stringify({sourceSha256:report.sourceSha256,region,prompt})).digest('hex');
 return {region,point:positivePoints[0],positives,negatives,prompt,signature,advanced:Boolean(override?.box||override?.positivePoints||override?.negativePoints||override?.cropRegion)};
}
export function matchesSamPrompt(saved,report,config){return saved.sourceSha256===report.sourceSha256&&(saved.promptSignature?saved.promptSignature===config.signature:!config.advanced&&saved.point?.x===config.point.x&&saved.point?.y===config.point.y);}
