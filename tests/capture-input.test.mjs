import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateCapture,limitedBody,MAX_CAPTURE_BYTES} from '../server/capture-input.mjs';
const capture={id:'1e141126-d308-4370-b529-0b59546a1b04',mode:'demo',generation:2,requestedAt:'2026-11-03T12:00:00Z',location:null};
test('capture metadata preserves unknown location and validates frozen workspace and GPS',()=>{
 assert.equal(validateCapture(capture).location,null);
 assert.equal(validateCapture({...capture,purpose:'obstacle-practice',targetHint:' chair '}).targetHint,'chair');
 assert.throws(()=>validateCapture({...capture,mode:'live',purpose:'obstacle-practice'}));
 assert.throws(()=>validateCapture({...capture,purpose:'obstacle-practice',targetHint:'x'.repeat(81)}));
 assert.throws(()=>validateCapture({...capture,generation:-1}));
 assert.throws(()=>validateCapture({...capture,mode:'test'}));
 assert.throws(()=>validateCapture({...capture,location:{latitude:33,longitude:-96,ageAtRequestMs:30001}}));
 assert.throws(()=>validateCapture({...capture,location:{latitude:91,longitude:-96,ageAtRequestMs:0}}));
 assert.equal(validateCapture({...capture,location:{latitude:33,longitude:-96,ageAtRequestMs:30,accuracyMeters:8}}).location.accuracyMeters,8);
});
test('capture upload enforces an actual byte limit, including chunked bodies',async()=>{
 assert.equal((await limitedBody(new Request('http://localhost',{method:'POST',body:'photo'}))).toString(),'photo');
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_CAPTURE_BYTES));c.enqueue(new Uint8Array(1));c.close();}});
 await assert.rejects(limitedBody(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'})),/4 MB/);
});
test('mission survives capture validation without changing GPS',()=>{
 const location={latitude:33.03488724399358,longitude:-96.74681640230119,ageAtRequestMs:1733,accuracyMeters:1.5306122};
 const result=validateCapture({...capture,purpose:'inspection',location,mission:{goal:'Capture sidewalk hazards',mode:'patrol'}});
 assert.deepEqual(result.mission,{goal:'Capture sidewalk hazards',mode:'patrol'});
 assert.equal(result.location.latitude,location.latitude);assert.equal(result.location.longitude,location.longitude);
 assert.throws(()=>validateCapture({...capture,mission:{goal:'x'.repeat(241),mode:'patrol'}}));
 assert.throws(()=>validateCapture({...capture,mission:{goal:'Go',mode:'invalid'}}));
});
