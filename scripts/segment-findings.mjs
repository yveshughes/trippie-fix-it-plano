import OpenAI from 'openai';
import {samPrompt,matchesSamPrompt} from './lib/sam-prompt.mjs';
import sharp from 'sharp';
import {parse} from 'dotenv';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {buildObjectPrompt,parseImageStream,recordsOfKind,decodeMaskToRaster,decodeMaskToSVGPath} from '@meta-sam/parser';
let env={};try{env=parse(await readFile('.env.local'));}catch(error){if(error.code!=='ENOENT')throw error;}
let key=env.MODEL_API_KEY||process.env.MODEL_API_KEY;
if(!key){console.error('Set MODEL_API_KEY in .env.local. No SAM requests sent.');process.exit(2);}
const root=path.resolve('private/pixel-analysis');
let entries=[];try{entries=await readdir(root,{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
const client=new OpenAI({apiKey:key,baseURL:'https://api.meta.ai/v1',maxRetries:0,timeout:90000});
let count=0;
for(const entry of entries.filter(x=>x.isDirectory())){
 const folder=path.join(root,entry.name);let report;try{report=JSON.parse(await readFile(path.join(folder,'assessment.json'),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 let override;try{override=JSON.parse(await readFile(path.join(folder,'sam-prompt-review.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const config=samPrompt(report,override);
 if(!config||report.assessment.decision==='no_issue')continue;
 const {point,region,prompt}=config;
 try{const saved=JSON.parse(await readFile(path.join(folder,'segmentation.json'),'utf8'));if(matchesSamPrompt(saved,report,config)){await readFile(path.join(folder,'sam-highlight.jpg'));console.log(entry.name+': using saved SAM output');continue;}}catch{}
 const original=await readFile(path.join(folder,'original-view.jpg'));const {width,height}=report;
 const image=config.advanced?await sharp(original).extract(region).jpeg({quality:95}).toBuffer():original;
 const px=config.positives[0].x,py=config.positives[0].y;
 try{
  const {data:events,request_id:requestId}=await client.responses.create({model:'sam-3.1',input:[{type:'message',role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:'data:image/jpeg;base64,'+image.toString('base64'),detail:'auto'}]}],stream:true,metadata:{mask_encoding:'one_bit'}}).withResponse();
  const result=await parseImageStream(events).finalResult;
  if(result.outcome.status!=='completed')throw new Error('Incomplete segmentation');
  const masks=recordsOfKind(result.records,'mask').filter(r=>r.mask.width*r.mask.height<=4000000);
  const contains=(r,p)=>{const b=r.bounds;if(p.x<b.left||p.y<b.top||p.x>=b.right||p.y>=b.bottom)return false;const x=Math.floor((p.x-b.left)*r.mask.width/(b.right-b.left)),y=Math.floor((p.y-b.top)*r.mask.height/(b.bottom-b.top));return decodeMaskToRaster(r.mask)[y*r.mask.width+x]===1;};
  const containing=masks.find(r=>config.positives.every(p=>contains(r,p))&&!config.negatives.some(p=>contains(r,p)));
  // Do not silently choose a different object if the returned mask misses the selected point.
  if(!containing)throw new Error('No mask satisfies all positive and negative prompts');
  const d=decodeMaskToSVGPath(containing.mask);if(!d)throw new Error('Empty mask');
  const b=containing.bounds;const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><g transform="translate(${region.left+b.left} ${region.top+b.top}) scale(${(b.right-b.left)/containing.mask.width} ${(b.bottom-b.top)/containing.mask.height})"><path d="${d}" fill="#c8ff59" fill-opacity="0.16" stroke="#ceff61" stroke-width="${Math.max(2,Math.min(width,height)*.004)}" vector-effect="non-scaling-stroke"/></g></svg>`;
  await writeFile(path.join(folder,'sam-outline.svg'),svg);
  await sharp(original).composite([{input:Buffer.from(svg)}]).jpeg({quality:92}).toFile(path.join(folder,'sam-highlight.jpg'));
  await writeFile(path.join(folder,'segmentation.json'),JSON.stringify({sourceSha256:report.sourceSha256,model:'sam-3.1',provider:'Meta Model API',requestId,point,promptSignature:config.signature,prompt,region,promptOverride:override,width,height,target:report.assessment.samTarget,completedAt:new Date().toISOString(),selectedMask:containing},null,2));
  count++;console.log(entry.name+': actual SAM outline saved');
 }catch(error){console.error(entry.name+': SAM failed ('+(error.status||error.name||'Error')+'). No substitute mask generated.');if([401,402,403,429].includes(error.status)){process.exitCode=1;break;}}
}
console.log('New SAM results: '+count);
