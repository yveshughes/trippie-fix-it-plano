import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = await mkdtemp(path.join(tmpdir(), 'trippie-workspace-'));
process.env.TRIPPIE_DATA_DIR = root;
// These are local isolation tests, independent of cloud credentials.
process.env.SUPABASE_URL = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
const {isCloud}=await import('../server/config.mjs');
assert.equal(isCloud(),false,'Isolation tests must never use a configured cloud database');
const store = await import('../server/store.mjs');
test('clearing DEMO preserves LIVE and fences late writes', async () => {
  try {
    await store.put('observation', {id:'live:one',mode:'live',generation:0,title:'Real photo'});
    const retained=await store.put('observation',{id:'live:one',mode:'live',generation:0,title:'Do not overwrite'},{ifAbsent:true});
    assert.equal(retained.title,'Real photo');
    await store.put('observation', {id:'demo:one',mode:'demo',generation:0,title:'Test photo'});
    const liveAsset = await store.saveAsset(Buffer.from('live image'),{mode:'live',generation:0,captureId:'real'});
    const demoAsset = await store.saveAsset(Buffer.from('test image'),{mode:'demo',generation:0,captureId:'test'});
    await store.put('job',{id:'demo:job',mode:'demo',generation:0,state:'running'});
    const result = await store.clearDemo();
    assert.equal(result.generation,1);
    assert.equal(result.fileErrors,0);
    assert.equal((await store.list('observation','live')).length,1);
    assert.deepEqual(await store.list('observation','demo'),[]);
    assert.deepEqual(await store.list('job','demo'),[]);
    assert.equal((await store.assetBytes(liveAsset)).toString(),'live image');
    await assert.rejects(store.assetBytes(demoAsset));
    await assert.rejects(store.put('observation',{id:'demo:late',mode:'demo',generation:0}));
    await assert.rejects(store.put('observation',{id:'live:one',mode:'demo',generation:1}));
    await Promise.all(Array.from({length:12},(_,i)=>store.put('observation',{id:'demo:'+i,mode:'demo',generation:1})));
    assert.equal((await store.list('observation','demo')).length,12);
    assert.equal((await store.get('observation','live:one')).title,'Real photo');
    assert.equal((await store.clearDemo()).generation,2);
    await assert.rejects(store.saveAsset(Buffer.from('stale upload'),{mode:'demo',generation:1,captureId:'stale'}));
    assert.deepEqual(await readdir(path.join(root,'assets/demo/1/stale')),[]);
    const raced = await Promise.allSettled([
      store.saveAsset(Buffer.from('racing upload'),{mode:'demo',generation:2,captureId:'racing'}),
      store.clearDemo()
    ]);
    assert.equal(raced[1].status,'fulfilled');
    assert.deepEqual(await store.list('asset','demo'),[]);
    assert.deepEqual(await readdir(path.join(root,'assets/demo/2/racing')),[]);
    assert.equal((await store.assetBytes(liveAsset)).toString(),'live image');
  } finally { await rm(root,{recursive:true,force:true}); }
});
