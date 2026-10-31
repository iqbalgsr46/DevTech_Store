import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../src/lib/server/claim-core.ts';
const require = createRequire(import.meta.url);
const base = 'https://claims.example.invalid';
function route(backend) {
 const source = readFileSync(new URL('../src/app/api/claims/route.ts', import.meta.url), 'utf8');
 const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const exports = {};
 vm.runInNewContext(compiled, { exports, require: name => name === '@/lib/server/claim-firebase' ? { claimBackend: backend } : name === '@/lib/server/claim-core' ? core : require(name), Response, Request, URL, TextDecoder, Buffer, Error });
 return exports;
}
const unavailable = route(() => { throw Error('Not configured'); });
async function fetch(url, options) { return unavailable.POST(new Request(url, options)); }

test('all privileged routes authorize before accessing inventory', async () => {
 let checks = 0;
 const api = route(() => ({ authorize: async () => { checks++; throw Error('Unauthorized'); }, store: new Proxy({}, { get() { throw Error('store accessed'); } }) }));
 for (const action of ['create', 'update', 'delete']) {
  const res = await api.POST(new Request(base + '/api/claims', { method: 'POST', headers: { origin: base, 'content-type': 'application/json', authorization: 'Bearer arbitrary' }, body: JSON.stringify({ action }) }));
  assert.equal(res.status, 401); assert.match(res.headers.get('cache-control'), /no-store/);
 }
 assert.equal((await api.GET(new Request(base + '/api/claims'))).status, 401);
 assert.equal(checks, 4);
});
test('configuration and internal failures return sanitized unavailable responses', async () => {
 const api = route(() => { throw Error('private internal failure'); });
 const res = await api.GET(new Request(base + '/api/claims'));
 assert.equal(res.status, 503);
 assert.match(res.headers.get('cache-control'), /no-store/);
 assert.equal((await res.text()).includes('private internal failure'), false);
});
test('inventory GET is rate limited and rejects corrupt encrypted records', async () => {
 let limits = 0;
 const api = route(() => ({ key: 'a'.repeat(64), authorize: async () => 'merchant', rateLimit: async () => { limits++; }, store: { list: async () => [{ hash: 'b'.repeat(64), record: { sealed: 'corrupt', createdAt: 1 } }] } }));
 const res = await api.GET(new Request(base + '/api/claims'));
 assert.equal(res.status, 503);
 assert.equal(limits, 1);
 assert.equal('accounts' in await res.json(), false);
});
test('claim API rejects cross-origin POST without credentials', async () => {
 const res = await fetch(base + '/api/claims', { method: 'POST', headers: { origin: 'https://evil.invalid', 'content-type': 'application/json' }, body: JSON.stringify({action:'claim',code:'DT-invalid'}) });
 assert.equal(res.status, 403); assert.match(res.headers.get('cache-control'), /no-store/);
 assert.equal('account' in await res.json(), false);
});
test('unconfigured claim and unauthenticated create fail closed', async () => {
 for (const body of [{action:'claim',code:'DT-invalid'},{action:'create',account:{}}]) {
 const res = await fetch(base + '/api/claims', { method:'POST', headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(body) });
 assert.ok([400,401,404,503].includes(res.status)); assert.match(res.headers.get('cache-control'), /no-store/);
 const data=await res.json(); assert.equal('account' in data,false); assert.equal('code' in data,false);
 }
});
