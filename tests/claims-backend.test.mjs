import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../src/lib/server/claim-core.ts';
const require = createRequire(import.meta.url);
const fixture = { email: 'fixture@example.invalid', password: 'fixture-password', secret2fa: 'JBSWY3DPEHPK3PXP' };
function load(env, db) {
  const source = readFileSync(new URL('../src/lib/server/claim-firebase.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  const calls = [];
  const mocks = {
    'server-only': {}, './claim-core': core,
    'firebase-admin/app': { cert: () => ({}), getApps: () => [], initializeApp: () => ({}) },
    'firebase-admin/auth': { getAuth: () => ({ verifyIdToken: async (token, revoked) => {
      calls.push({ token, revoked });
      if (token === 'verified-admin') return { uid: 'merchant' };
      if (token === 'verified-outsider') return { uid: 'outsider' };
      throw new Error('invalid token');
    } }) },
    'firebase-admin/firestore': { getFirestore: () => db },
  };
  vm.runInNewContext(compiled, { exports, require: name => name in mocks ? mocks[name] : require(name), process: { env, cwd: () => process.cwd() }, Buffer });
  return { backend: exports.claimBackend, calls };
}
const configured = { CLAIM_STORAGE_BACKEND: 'local', FIREBASE_SERVICE_ACCOUNT_JSON: '{}', CLAIM_ENCRYPTION_KEY: 'a'.repeat(64), CLAIM_ADMIN_UIDS: 'merchant', NODE_ENV: 'test' };
test('incomplete configuration fails closed rather than selecting an insecure fallback', () => {
  for (const env of [{}, { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'public-id' }, ...['CLAIM_ENCRYPTION_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'CLAIM_ADMIN_UIDS'].map(key => ({ ...configured, [key]: '' })), { ...configured, CLAIM_ADMIN_UIDS: ' , ' }, { ...configured, CLAIM_ENCRYPTION_KEY: 'invalid' }, { ...configured, CLAIM_STORAGE_BACKEND: 'unknown' }, { ...configured, CLAIM_STORAGE_BACKEND: 'firestore' }, { ...configured, NODE_ENV: 'production' }, { ...configured, NODE_ENV: 'production', CLAIMS_DATA_DIR: 'relative/path' }]) {
    assert.throws(() => load(env).backend(), /Not configured/);
  }
});
test('local backend verifies token revocation and the UID allowlist', async () => {
  const { backend, calls } = load(configured);
  const service = backend();
  for (const header of [null, 'Bearer arbitrary-token', 'Bearer ']) await assert.rejects(service.authorize(header), /Unauthorized/);
  await assert.rejects(service.authorize('Bearer verified-outsider'), /Forbidden/);
  assert.equal(await service.authorize('Bearer verified-admin'), 'merchant');
  assert.ok(calls.length > 0 && calls.every(call => call.revoked === true));
});

async function exerciseCrud(service, reopen) {
  const code = await core.createClaim(fixture, service.store, service.key);
  const hash = createHash('sha256').update(code).digest('hex');
  const before = await service.store.get(hash);
  await assert.rejects(service.store.insert(hash, before));
  const updated = { ...fixture, password: 'changed-password' };
  await core.updateClaim(hash, updated, service.store, service.key);
  const restarted = reopen();
  assert.deepEqual(await core.retrieveClaim(code, restarted.store, restarted.key), updated);
  const after = await restarted.store.get(hash);
  assert.equal(after.sealedCode, before.sealedCode);
  assert.equal(after.createdAt, before.createdAt);
  assert.equal((await restarted.store.list()).length, 1);
  for (const value of [...Object.values(fixture), code, updated.password]) assert.equal(JSON.stringify(after).includes(value), false);
  await core.deleteClaim(hash, restarted.store);
  await assert.rejects(core.retrieveClaim(code, restarted.store, restarted.key), /Invalid claim/);
  await assert.rejects(restarted.store.update(hash, { sealed: before.sealed }));
  assert.equal(await restarted.store.get(hash), null);
}

test('local CRUD persists atomic edits without changing issued codes', async () => {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'claims-backend-'));
  const env = { ...configured, CLAIMS_DATA_DIR: dir, CLAIM_ENCRYPTION_KEY: randomBytes(32).toString('hex') };
  try {
    await exerciseCrud(load(env).backend(), () => load(env).backend());
    assert.deepEqual(readdirSync(dir), []);
    writeFileSync(join(dir, `${'b'.repeat(64)}.json`), 'corrupt fixture');
    await assert.rejects(load(env).backend().store.list());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Firestore adapter uses create for insertion and update for credential edits', async () => {
  const records = new Map();
  const db = { collection: () => ({
    doc: hash => ({
      create: async record => { if (records.has(hash)) throw Error('exists'); records.set(hash, { ...record }); },
      update: async patch => { if (!records.has(hash)) throw Error('missing'); records.set(hash, { ...records.get(hash), ...patch }); },
      get: async () => ({ exists: records.has(hash), data: () => records.get(hash) }),
      delete: async () => { records.delete(hash); },
    }),
    orderBy: () => ({ get: async () => ({ docs: [...records].map(([id, record]) => ({ id, data: () => record })) }) }),
  }) };
  const env = { ...configured, CLAIM_STORAGE_BACKEND: 'firestore', CLAIM_FIRESTORE_RULES_CONFIRMED: 'true' };
  await exerciseCrud(load(env, db).backend(), () => load(env, db).backend());
});
