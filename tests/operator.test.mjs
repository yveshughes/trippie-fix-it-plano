import {test} from 'node:test';import assert from 'node:assert/strict';import {operate} from '../scripts/operator.mjs';
test('operator reset requires explicit confirmation and cannot target LIVE',async()=>{
 const calls=[];const options={password:'test-operator-password',baseUrl:'https://portal.example',fetcher:async(url,request)=>{calls.push({url,request});return Response.json({generation:2});}};
 await assert.rejects(operate(['clear-demo'],options));await assert.rejects(operate(['clear-demo','live'],options));assert.equal(calls.length,0);
 await operate(['clear-demo','--confirm'],options);assert.equal(calls[0].request.method,'DELETE');assert.deepEqual(JSON.parse(calls[0].request.body),{mode:'demo'});assert.equal(calls[0].request.redirect,'error');
 await assert.rejects(operate(['status'],{...options,baseUrl:'http://external.example'}));assert.equal(calls.length,1);
});
