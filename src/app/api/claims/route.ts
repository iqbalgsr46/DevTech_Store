import { claimBackend } from '@/lib/server/claim-firebase';
import { createClaim, retrieveClaim, updateClaim, deleteClaim } from '@/lib/server/claim-core';
import { createDecipheriv } from 'node:crypto';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({ error: 'Forbidden' }, { status: 403, headers });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return Response.json({ error: 'Invalid request' }, { status: 400, headers });
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Invalid request');
    let text = ''; let length = 0;
    const decoder = new TextDecoder();
    while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 4096) { await reader.cancel(); throw new Error('Invalid request'); } text += decoder.decode(value, { stream: true }); }
    const body = JSON.parse(text + decoder.decode());
    const backend = claimBackend();
    if (body.action === 'create') {
      const uid = await backend.authorize(request.headers.get('authorization'));
      await backend.rateLimit('admin-' + uid, 10);
      const code = await createClaim(body.account, backend.store, backend.key);
      return Response.json({ code }, { headers });
    }
    if (body.action === 'update') {
      const uid = await backend.authorize(request.headers.get('authorization'));
      await backend.rateLimit('admin-' + uid, 20);
      if (typeof body.hash !== 'string') throw new Error('Invalid request');
      await updateClaim(body.hash, body.account, backend.store, backend.key);
      return Response.json({ success: true }, { headers });
    }
    if (body.action === 'delete') {
      const uid = await backend.authorize(request.headers.get('authorization'));
      await backend.rateLimit('admin-' + uid, 20);
      if (typeof body.hash !== 'string') throw new Error('Invalid request');
      await deleteClaim(body.hash, backend.store);
      return Response.json({ success: true }, { headers });
    }
    await backend.rateLimit('public', 60);
    if (body.action !== 'claim' || typeof body.code !== 'string') throw new Error('Invalid request');
    const account = await retrieveClaim(body.code, backend.store, backend.key);
    return Response.json({ account }, { headers });
  } catch (error) {
    console.error('Claims API POST error:', error);
    const message = error instanceof Error ? error.message : '';
    const statuses: Record<string, number> = { 'Unauthorized': 401, 'Forbidden': 403, 'Invalid request': 400, 'Invalid account': 400, 'Invalid claim': 404, 'Rate limited': 429 };
    const status = statuses[message] || 503;
    return Response.json({ error: status === 503 ? 'Layanan klaim belum tersedia. Hubungi admin.' : message }, { status, headers });
  }
}

export async function GET(request: Request) {
  try {
    const backend = claimBackend();
    const uid = await backend.authorize(request.headers.get('authorization'));
    await backend.rateLimit('admin-' + uid, 20);
    if (!backend.store.list) throw new Error('Not configured');
    const list = await backend.store.list();
    const accounts = [];
    for (const { hash, record } of list) {
      let email = '';
      let password = '';
      let secret2fa = '';
      let code = '';
      if (!record.sealed) throw new Error('Invalid stored claim');
      if (record.sealed) {
        try {
          const bytes = Buffer.from(record.sealed, 'base64');
          const decipher = createDecipheriv('aes-256-gcm', Buffer.from(backend.key, 'hex'), bytes.subarray(0, 12));
          decipher.setAAD(Buffer.from(hash));
          decipher.setAuthTag(bytes.subarray(12, 28));
          const decrypted = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
          email = decrypted.email || '';
          password = decrypted.password || '';
          secret2fa = decrypted.secret2fa || '';
        } catch { throw new Error('Invalid stored claim'); }
      }
      if (!code && record.sealedCode) {
        try {
          const codeBytes = Buffer.from(record.sealedCode, 'base64');
          const codeDecipher = createDecipheriv('aes-256-gcm', Buffer.from(backend.key, 'hex'), codeBytes.subarray(0, 12));
          codeDecipher.setAAD(Buffer.from(hash));
          codeDecipher.setAuthTag(codeBytes.subarray(12, 28));
          code = Buffer.concat([codeDecipher.update(codeBytes.subarray(28)), codeDecipher.final()]).toString('utf8');
        } catch { throw new Error('Invalid stored claim'); }
      }
      accounts.push({
        hash,
        code,
        email,
        password,
        secret2fa,
        createdAt: record.createdAt || Date.now(),
      });
    }
    return Response.json({ accounts }, { headers });
  } catch (error) {
    console.error('Claims API GET error:', error);
    const message = error instanceof Error ? error.message : '';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : message === 'Rate limited' ? 429 : 503;
    return Response.json({ error: message || 'Layanan klaim belum tersedia.', details: error instanceof Error ? error.message : String(error) }, { status: status === 503 ? 500 : status, headers });
  }
}
