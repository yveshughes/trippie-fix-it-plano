/* DOM-only city-form adapter. Never uses Angular's private scope or city APIs. */
(function (config) {
  'use strict';
  if (location.origin !== 'https://iframe.publicstuff.com') return {stage:'blocked',message:'Unexpected city origin'};
  const s = window.__trippieCity || (window.__trippieCity = {phase:'select',started:Date.now()});
  if(!s.gated){document.addEventListener('click',e=>{if(e.target.closest?.('button')?.textContent.trim()==='Submit'&&!s.authorized){e.preventDefault();e.stopImmediatePropagation();}},true);document.addEventListener('submit',e=>{if(!s.authorized){e.preventDefault();e.stopImmediatePropagation();}},true);s.gated=true;}
  const visible = e => !!e && e.getClientRects().length > 0;
  const text = e => (e.innerText || e.textContent || '').trim();
  const find = (selector, label) => [...document.querySelectorAll(selector)].find(e => visible(e) && text(e) === label);
  const set = (e,v) => { if (!e) throw Error('Required field unavailable'); const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(e,v); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); e.dispatchEvent(new KeyboardEvent('keyup',{key:v.slice(-1),keyCode:v.charCodeAt(v.length-1),which:v.charCodeAt(v.length-1),bubbles:true})); };
  const result = (stage,message,extra={}) => ({stage,message,...extra});
  const body = document.body.innerText;
  // Only a city-issued request identifier on a confirmation/detail page is success.
  if (s.dispatched || config.receiptOnly) {
    const confirmation=[...document.querySelectorAll('.confirmation-modal')].find(visible);
    if(confirmation && /Success!/i.test(text(confirmation)) && /Curb Repair/i.test(text(confirmation)) && /was successfully submitted to Fix It Plano/i.test(text(confirmation))) {
      const receipt=text(confirmation.querySelector('[ng-bind="request.id"]')||{textContent:''});
      if(/^\d{4,20}$/.test(receipt))return result('confirmed','City confirmation received',{receipt,url:'https://iframe.publicstuff.com/#?client_id=162&request_id='+receipt,evidence:text(confirmation)});
      return result('attention','City accepted the request but has not displayed a tracking number; do not resend',{evidence:text(confirmation)});
    }
    const loginModal=[...document.querySelectorAll('.login-modal,.registration-modal')].find(visible);
    if(s.dispatched && loginModal && !s.anonymousSent) {
      const skip=[...loginModal.querySelectorAll('a')].find(e=>visible(e)&&text(e)==='skip'&&e.getAttribute('ng-click')==='anonymousSubmit()');
      if(skip && /to submit anonymously/i.test(text(loginModal))) {s.anonymousSent=true;skip.click();return result('awaiting','Submitting through the city’s anonymous reporting option');}
    }
    if (/captcha|verify you are human/i.test(body)) return result('attention','City verification needs your attention');
    if (visible(document.querySelector('input[type=password]'))) return result('attention','City account sign-in required');
    return result('awaiting','Waiting for the city response',{evidence:body.slice(0,12000)});
  }
  if (s.phase!=='ready' && Date.now()-s.started>120000) return result('attention','City form changed or timed out; no request sent');
  if (s.phase==='select') {
    const category=find('h3,h2','Curb Repair');
    if (category) s.phase='fill';
    else {
      const curb=[...document.querySelectorAll('a')].find(e=>visible(e)&&/^Curb Repair(?:\s|$)/.test(text(e)));
      if(curb){curb.click();return result('preparing','Selecting Curb Repair');}
      const streets=[...document.querySelectorAll('a')].find(e=>visible(e)&&/Streets and Traffic/.test(text(e)));
      if(streets){streets.click();return result('preparing','Opening Streets and Traffic');}
      const search=document.querySelector('input[placeholder="Search..."]');
      if(visible(search)&&search.value!=='Curb'){set(search,'Curb');return result('preparing','Finding the city request type');}
      return result('preparing','Loading city request types');
    }
  }
  if (s.phase==='fill') {
    const address=document.querySelector('#request-address-input input');
    const locationField=[...document.querySelectorAll('textarea')].find(e=>visible(e)&&e.getAttribute('aria-label')==='Location (R)');
    const description=document.querySelector('#request-description-input');
    if(!visible(address)||!visible(locationField)||!visible(description)) return result('preparing','Waiting for required city fields');
    const initialMap=[...document.querySelectorAll('a[href]')].find(e=>visible(e)&&e.href.includes('maps.google.com/maps?ll='));
    if(!initialMap)return result('preparing','Waiting for city map');
    s.initialMap=initialMap.href.match(/[?&]ll=([-\d.]+),([-\d.]+)/)?.[0];
    address.focus();
    set(address,config.latitude+', '+config.longitude);
    address.blur();
    set(locationField,config.locationDetails);
    set(description,config.description);
    s.phase='attach';s.filledAt=Date.now();
    return result('preparing','Location and case description entered');
  }
  if(s.phase==='attach') {
    const input=document.querySelector('#file_upload');
    if(!input)return result('attention','City photo field unavailable');
    if(!input.files?.length)return result('preparing','Attaching original photo',{needsPhoto:true});
    if(input.files[0].name!==config.captureId+'.jpg')return result('blocked','Unexpected photo selected');
    s.phase='verify';
  }
  if(s.phase==='verify'||s.phase==='ready') {
    const address=document.querySelector('#request-address-input input');
    const desc=document.querySelector('#request-description-input');
    const loc=[...document.querySelectorAll('textarea')].find(e=>visible(e)&&e.getAttribute('aria-label')==='Location (R)');
    const mapLink=[...document.querySelectorAll('a[href]')].find(e=>visible(e)&&e.href.includes('maps.google.com/maps?ll='));
    const ll=mapLink?.href.match(/[?&]ll=([-\d.]+),([-\d.]+)/);
    if(!ll||ll[0]===s.initialMap||Date.now()-s.filledAt<5000)return result('preparing','Checking city map location');
    const dy=(Number(ll[1])-config.latitude)*111320, dx=(Number(ll[2])-config.longitude)*111320*Math.cos(config.latitude*Math.PI/180);
    if(Math.hypot(dx,dy)>50)return result('blocked','City map is too far from capture GPS; no request sent');
    if(!address?.value||desc?.value!==config.description||loc?.value!==config.locationDetails||document.querySelector('#file_upload')?.files?.[0]?.name!==config.captureId+'.jpg')return result('blocked','City evidence validation failed');
    if(visible(document.querySelector('input[type=password]')))return result('attention','City sign-in required');
    const submit=find('button','Submit');
    if(!submit||submit.disabled)return result('attention','City form is not ready to submit');
    s.phase='ready';
    if(config.dispatch===true){s.dispatched=true;s.phase='sent';s.authorized=true;try{submit.click();}finally{s.authorized=false;}return result('awaiting','Sending case to Fix It Plano');}
    return result('ready','City form prepared · original photo attached',{mapOffsetMeters:Math.round(Math.hypot(dx,dy))});
  }
  return result('attention','City workflow needs review');
})
