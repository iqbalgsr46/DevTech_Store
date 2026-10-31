import 'server-only';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, open, link, unlink, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdmin, type ClaimStore, type StoredClaim } from './claim-core';

function getPersistentStoreDirectory() {
  if (process.env.CLAIMS_DATA_DIR) {
    return path.resolve(process.env.CLAIMS_DATA_DIR);
  }
  return path.join(process.cwd(), '.data', 'claims');
}

function getLocalStore(): ClaimStore {
  const dir = getPersistentStoreDirectory();
  function targetPath(hash: string) {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('Invalid request');
    return path.join(dir, `${hash}.json`);
  }
  async function mutate(hash: string, operation: (target: string) => Promise<void>) {
    const target = targetPath(hash);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    // Exclusive cross-process lock. A stale crash lock fails closed until operator recovery.
    const lock = await open(`${target}.lock`, 'wx', 0o600);
    try { await operation(target); }
    finally { await lock.close(); await unlink(`${target}.lock`); }
  }
  async function atomicWrite(target: string, record: StoredClaim, replace: boolean) {
    const temp = path.join(dir, `.${randomBytes(16).toString('hex')}.tmp`);
    try {
      const handle = await open(temp, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(record), 'utf8'); await handle.sync(); }
      finally { await handle.close(); }
      if (replace) await rename(temp, target);
      else await link(temp, target);
    } finally {
      await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
  return {
    async insert(hash, record) {
      await mutate(hash, async target => atomicWrite(target, record, false));
    },
    async update(hash, patch) {
      await mutate(hash, async target => {
        let existing: StoredClaim;
        try { existing = JSON.parse(await readFile(target, 'utf8')) as StoredClaim; }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Invalid claim');
          throw error;
        }
        await atomicWrite(target, { ...existing, sealed: patch.sealed }, true);
      });
    },
    async get(hash: string): Promise<StoredClaim | null> {
      try {
        const file = path.join(dir, `${hash}.json`);
        const content = await readFile(file, 'utf8');
        return JSON.parse(content) as StoredClaim;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          return null;
        }
        throw err;
      }
    },
    async delete(hash: string): Promise<void> {
      await mutate(hash, async target => {
        await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
      });
    },
    async list(): Promise<Array<{ hash: string; record: StoredClaim }>> {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const results: Array<{ hash: string; record: StoredClaim }> = [];
      for (const file of await readdir(dir)) {
        if (/^[a-f0-9]{64}\.json$/.test(file)) {
          const content = await readFile(path.join(dir, file), 'utf8');
          results.push({ hash: file.slice(0, -5), record: JSON.parse(content) as StoredClaim });
        }
      }
      return results.sort((a, b) => b.record.createdAt - a.record.createdAt);
    },
  };
}

const rateLimitBuckets = new Map<string, { minute: number; count: number }>();

function checkLocalRateLimit(bucket: string, limit: number): void {
  const currentMinute = Math.floor(Date.now() / 60000);
  const entry = rateLimitBuckets.get(bucket);
  if (!entry || entry.minute !== currentMinute) {
    rateLimitBuckets.set(bucket, { minute: currentMinute, count: 1 });
    return;
  }
  if (entry.count >= limit) {
    throw new Error('Rate limited');
  }
  entry.count += 1;
}

// Separate from the legacy client-readable RTDB settings/redeemLinks tree.
export function claimBackend() {
  const { FIREBASE_SERVICE_ACCOUNT_JSON, CLAIM_ENCRYPTION_KEY, CLAIM_ADMIN_UIDS, CLAIM_FIRESTORE_RULES_CONFIRMED } = process.env;
  const backend = process.env.CLAIM_STORAGE_BACKEND;
  const allowed = (CLAIM_ADMIN_UIDS || '').split(',').map(uid => uid.trim()).filter(Boolean);
  if (!FIREBASE_SERVICE_ACCOUNT_JSON || !/^[a-f0-9]{64}$/i.test(CLAIM_ENCRYPTION_KEY || '') || !allowed.length || !['local', 'firestore'].includes(backend || '')) {
    console.error('claimBackend config check failed:', {
      hasSA: Boolean(FIREBASE_SERVICE_ACCOUNT_JSON),
      keyValid: /^[a-f0-9]{64}$/i.test(CLAIM_ENCRYPTION_KEY || ''),
      keyLen: CLAIM_ENCRYPTION_KEY?.length,
      allowedCount: allowed.length,
      backend
    });
    throw new Error('Not configured');
  }
  if (backend === 'firestore' && CLAIM_FIRESTORE_RULES_CONFIRMED !== 'true') throw new Error('Not configured');
  if (backend === 'local' && process.env.NODE_ENV === 'production' && (!process.env.CLAIMS_DATA_DIR || !path.isAbsolute(process.env.CLAIMS_DATA_DIR))) throw new Error('Not configured');
  {
    const app = getApps().find(a => a.name === 'private-claims') || initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)) }, 'private-claims');
    const db = backend === 'firestore' ? (process.env.FIREBASE_DATABASE_ID ? getFirestore(app, process.env.FIREBASE_DATABASE_ID) : getFirestore(app)) : null;
    const store: ClaimStore = db ? {
      async insert(hash, record) { await db.collection('privateAccountClaims').doc(hash).create(record); },
      async update(hash, patch) { await db.collection('privateAccountClaims').doc(hash).update({ sealed: patch.sealed }); },
      async get(hash) { const snapshot = await db.collection('privateAccountClaims').doc(hash).get(); return snapshot.exists ? snapshot.data() as Awaited<ReturnType<ClaimStore['get']>> : null; },
      async delete(hash) { await db.collection('privateAccountClaims').doc(hash).delete(); },
      async list() {
        const snapshot = await db.collection('privateAccountClaims').orderBy('createdAt', 'desc').get();
        return snapshot.docs.map(doc => ({ hash: doc.id, record: doc.data() as StoredClaim }));
      },
    } : getLocalStore();
    return { store, key: CLAIM_ENCRYPTION_KEY!, async authorize(header: string | null) {
      if (!header?.startsWith('Bearer ')) throw new Error('Unauthorized');
      let identity;
      try { identity = await getAuth(app).verifyIdToken(header.slice(7), true); } catch { throw new Error('Unauthorized'); }
      requireAdmin(identity, allowed);
      return identity.uid;
    }, async rateLimit(bucket: string, limit: number) {
      if (!db) return checkLocalRateLimit(bucket, limit);
      // Global per-minute quota is deliberately independent of spoofable proxy headers.
      const ref = db.collection('privateClaimRateLimits').doc(bucket);
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(ref);
        const minute = Math.floor(Date.now() / 60000);
        const previous = snapshot.data();
        const count = previous?.minute === minute ? Number(previous.count) : 0;
        if (count >= limit) throw new Error('Rate limited');
        transaction.set(ref, { minute, count: count + 1 });
      });
    } };
  }


}
