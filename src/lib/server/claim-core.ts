import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export interface ClaimAccount { email: string; password: string; secret2fa: string }
function encryptionKey(key: string) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('Not configured');
  return Buffer.from(key, 'hex');
}
function validateAccount(value: unknown): ClaimAccount {
  const a = value as ClaimAccount;
  if (!a || typeof a.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) || a.email.length > 254 || typeof a.password !== 'string' || !a.password || a.password.length > 1024 || typeof a.secret2fa !== 'string' || !/^[A-Z2-7]{16,128}$/.test(a.secret2fa)) throw new Error('Invalid account');
  return { email: a.email, password: a.password, secret2fa: a.secret2fa };
}
export interface ClaimStore {
  insert(hash: string, record: StoredClaim): Promise<void>;
  update(hash: string, patch: Pick<StoredClaim, 'sealed'>): Promise<void>;
  get(hash: string): Promise<StoredClaim | null>;
  delete?(hash: string): Promise<void>;
  list?(): Promise<Array<{ hash: string; record: StoredClaim }>>;
}
export interface StoredClaim { sealed: string; sealedCode?: string; createdAt: number }
export async function retrieveClaim(code: string, store: ClaimStore, key: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw new Error('Invalid claim');
  const record = await store.get(createHash('sha256').update(code).digest('hex'));
  if (!record) throw new Error('Invalid claim');
  const bytes = Buffer.from(record.sealed, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(key), bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(createHash('sha256').update(code).digest('hex')));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return validateAccount(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8')));
}
export function requireAdmin(identity: { uid: string } | null, allowed: string[]) {
  if (!identity) throw new Error('Unauthorized');
  if (!allowed.includes(identity.uid)) throw new Error('Forbidden');
}
export async function createClaim(input: unknown, store: ClaimStore, key: string) {
  const account = validateAccount(input);
  const code = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(code).digest('hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(hash));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(account), 'utf8'), cipher.final()]);
  // Also encrypt the code for admin retrieval so plaintext code is never stored in DB
  const codeIv = randomBytes(12);
  const codeCipher = createCipheriv('aes-256-gcm', encryptionKey(key), codeIv);
  codeCipher.setAAD(Buffer.from(hash));
  const encryptedCode = Buffer.concat([codeCipher.update(code, 'utf8'), codeCipher.final()]);
  await store.insert(hash, {
    sealed: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64'),
    sealedCode: Buffer.concat([codeIv, codeCipher.getAuthTag(), encryptedCode]).toString('base64'),
    createdAt: Date.now(),
  });
  return code;
}

export async function updateClaim(hash: string, input: unknown, store: ClaimStore, key: string) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Invalid request');
  const existing = await store.get(hash);
  if (!existing) throw new Error('Invalid claim');
  const account = validateAccount(input);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(key), iv);
  cipher.setAAD(Buffer.from(hash));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(account), 'utf8'), cipher.final()]);
  await store.update(hash, {
    sealed: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64'),
  });
}

export async function deleteClaim(hash: string, store: ClaimStore) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error('Invalid request');
  if (store.delete) {
    await store.delete(hash);
  }
}
