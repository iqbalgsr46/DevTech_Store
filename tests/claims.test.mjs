import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClaim, retrieveClaim, requireAdmin } from '../src/lib/server/claim-core.ts';

test('admin requires verified allowlisted identity', () => {
  assert.throws(() => requireAdmin(null, ['merchant']), /Unauthorized/);
  assert.throws(() => requireAdmin({ uid: 'stranger' }, ['merchant']), /Forbidden/);
  assert.throws(() => requireAdmin({ uid: 'merchant' }, []), /Forbidden/);
  assert.doesNotThrow(() => requireAdmin({ uid: 'merchant' }, ['merchant']));
});

test('encrypted fixture persists across database reopen, only matching code retrieves account', async () => {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'claim-test-'));
  const file = join(dir, 'fixtures.sqlite');
  let db = new DatabaseSync(file);
  db.exec('CREATE TABLE claims (hash TEXT PRIMARY KEY, record TEXT NOT NULL)');
  const store = {
    insert: async (hash, record) => { db.prepare('INSERT INTO claims VALUES (?, ?)').run(hash, JSON.stringify(record)); },
    get: async (hash) => { const row = db.prepare('SELECT record FROM claims WHERE hash=?').get(hash); return row ? JSON.parse(row.record) : null; }
  };
  try {
    const fixture = { email: 'fixture@example.invalid', password: 'fixture-password', secret2fa: 'JBSWY3DPEHPK3PXP' };
    const key = 'a'.repeat(64);
    const code = await createClaim(fixture, store, key);
    assert.match(code, /^[A-Za-z0-9_-]{43}$/);
    const raw = JSON.stringify(db.prepare('SELECT * FROM claims').all());
    for (const value of [...Object.values(fixture), code]) assert.equal(raw.includes(value), false);
    db.close(); db = new DatabaseSync(file);
    assert.deepEqual(await retrieveClaim(code, store, key), fixture);
    await assert.rejects(() => retrieveClaim('z'.repeat(43), store, key), /Invalid claim/);
    await assert.rejects(() => retrieveClaim(code, store, 'b'.repeat(64)));
    await assert.rejects(() => createClaim({ ...fixture, secret2fa: 'invalid!' }, store, key));
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('invalid code never returns credentials or queries the store', async () => {
  let reads = 0;
  const store = { insert: async () => {}, get: async () => { reads++; return null; } };
  await assert.rejects(() => retrieveClaim('DT-public-order', store, 'a'.repeat(64)), /Invalid claim/);
  assert.equal(reads, 0);
});
