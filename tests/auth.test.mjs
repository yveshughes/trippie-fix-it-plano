import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminAuth,deviceAuth,authResponse } from '../server/auth.mjs';
test('protected writes require credentials and reject foreign browser origins',()=>{
 process.env.VERCEL='1';
 process.env.TRIPPIE_ADMIN_PASSWORD='test-only-admin-password';
 process.env.TRIPPIE_DEVICE_TOKEN='test-only-capture-token';
 const basic='Basic '+Buffer.from('trippie:test-only-admin-password').toString('base64');
 const request=headers=>new Request('https://fixitplano.example/api/workspace',{headers:{host:'fixitplano.example',...headers}});
 assert.equal(adminAuth(request({})),false);
 assert.equal(authResponse().headers.has('WWW-Authenticate'),false,'API errors must not open browser sign-in dialogs');
 assert.equal(adminAuth(request({authorization:basic})),true);
 assert.equal(adminAuth(request({authorization:basic,origin:'https://foreign.example'})),false);
 assert.equal(adminAuth(request({authorization:basic,'sec-fetch-site':'cross-site'})),false);
 assert.equal(adminAuth(request({authorization:basic,origin:'https://fixitplano.example'})),true);
 assert.equal(deviceAuth(request({authorization:'Bearer test-only-capture-token'})),true);
 assert.equal(adminAuth(request({authorization:'Bearer test-only-capture-token'})),false);
 assert.equal(deviceAuth(request({authorization:basic})),false);
});

test('loopback browser writes accept the browser host even when Next normalizes the URL',()=>{
 process.env.VERCEL='';
 const request=headers=>new Request('http://localhost:3015/api/workspace',{headers:{host:'127.0.0.1:3015',...headers}});
 assert.equal(adminAuth(request({origin:'http://127.0.0.1:3015','sec-fetch-site':'same-origin'})),true);
 assert.equal(adminAuth(request({origin:'https://foreign.example','sec-fetch-site':'same-origin'})),false);
 assert.equal(adminAuth(request({origin:'http://127.0.0.1:3015','sec-fetch-site':'cross-site'})),false);
 assert.equal(adminAuth(new Request('http://localhost:3016/api/workspace',{headers:{host:'127.0.0.1:3016',origin:'http://127.0.0.1:3016'}})),false);
 process.env.VERCEL='1';
 assert.equal(adminAuth(request({origin:'http://127.0.0.1:3015','sec-fetch-site':'same-origin'})),false);
});
