import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth,deviceAuth } from '../server/auth.mjs';
test('deployed data requires credentials and rejects foreign browser origins',()=>{
 process.env.VERCEL='1';
 process.env.TRIPPIE_ADMIN_PASSWORD='test-only-admin-password';
 process.env.TRIPPIE_DEVICE_TOKEN='test-only-capture-token';
 const basic='Basic '+Buffer.from('trippie:test-only-admin-password').toString('base64');
 const request=headers=>new Request('https://fixitplano.example/api/workspace',{headers:{host:'fixitplano.example',...headers}});
 assert.equal(adminAuth(request({})),false);
 assert.equal(adminAuth(request({authorization:basic})),true);
 assert.equal(adminAuth(request({authorization:basic,origin:'https://foreign.example'})),false);
 assert.equal(adminAuth(request({authorization:basic,'sec-fetch-site':'cross-site'})),false);
 assert.equal(adminAuth(request({authorization:basic,origin:'https://fixitplano.example'})),true);
 assert.equal(deviceAuth(request({authorization:'Bearer test-only-capture-token'})),true);
 assert.equal(adminAuth(request({authorization:'Bearer test-only-capture-token'})),false);
 assert.equal(deviceAuth(request({authorization:basic})),false);
});
