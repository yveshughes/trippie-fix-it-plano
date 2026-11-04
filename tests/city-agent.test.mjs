import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../android/app/src/main/assets/city-agent.js',import.meta.url),'utf8');
function page({body='',hash='',receiptOnly=false,dispatch=false,offset=0,photo='capture.jpg'}={}){
 let clicks=0;
 const config={latitude:33,longitude:-96,captureId:'capture',description:'Broken curb',locationDetails:'GPS exact',dispatch,receiptOnly};
 const element=(text,value)=>({innerText:text,textContent:text,value,getClientRects:()=>[{}],click(){clicks++}});
 const address=element('','33, -96'),desc=element('',config.description),loc=element('',config.locationDetails);loc.getAttribute=()=> 'Location (R)';
 const upload={files:[{name:photo}]},submit=element('Submit'),link={getClientRects:()=>[{}],href:`https://maps.google.com/maps?ll=${33+offset},-96&z=18`};
 const elements={'#request-address-input input':address,'#request-description-input':desc,'#file_upload':upload};
 const doc={body:{innerText:body},addEventListener(){},querySelector:q=>elements[q]||null,querySelectorAll:q=>q==='textarea'?[loc]:q==='a[href]'?[link]:q==='button'?[submit]:[]};
 const window={__trippieCity:{phase:'verify',filledAt:0,started:Date.now(),gated:true}};
 const context=vm.createContext({document:doc,window,location:{origin:'https://iframe.publicstuff.com',href:'https://iframe.publicstuff.com/#?client_id=162'+hash,hash:'?client_id=162'+hash},URL,Date,Event,Math,config});
 return {doc,run:()=>vm.runInContext(script+'(config)',context),config,window,clicks:()=>clicks};
}
test('preparation validates photo, field contents and map before allowing a city click',()=>{
 const ready=page();assert.equal(ready.run().stage,'ready');assert.equal(ready.clicks(),0);
 assert.equal(page({offset:0.1}).run().stage,'blocked');
 assert.equal(page({photo:'different.jpg'}).run().stage,'blocked');
});
test('authorized dispatch clicks once and receipt-only reload never clicks again',()=>{
 const p=page({dispatch:true});assert.equal(p.run().stage,'awaiting');assert.equal(p.clicks(),1);p.run();assert.equal(p.clicks(),1);
 const reload=page({dispatch:true,receiptOnly:true});assert.equal(reload.run().stage,'awaiting');assert.equal(reload.clicks(),0);
});
test('a thank-you without a city-issued identifier does not become a receipt',()=>{
 assert.equal(page({receiptOnly:true,body:'Thank you for your request'}).run().stage,'awaiting');
 assert.equal(page({receiptOnly:true,body:'Curb Repair Request submitted. Request #123456'}).run().stage,'awaiting');
});

test('a ready form remains ready while waiting for the native submit action',()=>{
 const p=page();assert.equal(p.run().stage,'ready');
 p.window.__trippieCity.started=0;
 assert.equal(p.run().stage,'ready');assert.equal(p.clicks(),0);
});

test('the registration dialog uses its visible anonymous option exactly once',()=>{
 const p=page({receiptOnly:true});p.window.__trippieCity.dispatched=true;
 let skips=0;
 const skip={getClientRects:()=>[{}],innerText:'skip',getAttribute:()=> 'anonymousSubmit()',click(){skips++}};
 const modal={getClientRects:()=>[{}],innerText:'Or skip to submit anonymously.',querySelectorAll:()=>[skip]};
 p.doc.querySelectorAll=q=>q==='.login-modal,.registration-modal'?[modal]:[];
 assert.equal(p.run().stage,'awaiting');assert.equal(skips,1);
 p.run();assert.equal(skips,1);
});
test('the city success modal supplies its own exact case identifier',()=>{
 const p=page({receiptOnly:true});
 const modal={getClientRects:()=>[{}],innerText:'Success! Curb Repair # 123456 was successfully submitted to Fix It Plano.',querySelector:()=>({textContent:'123456'})};
 p.doc.querySelectorAll=q=>q==='.confirmation-modal'?[modal]:[];
 const r=p.run();assert.equal(r.stage,'confirmed');assert.equal(r.receipt,'123456');assert.match(r.url,/request_id=123456/);
});
