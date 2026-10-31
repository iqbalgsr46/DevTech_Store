import { getStorePricing, updateStorePricing } from '@/lib/server/pricing-store';
import { claimBackend } from '@/lib/server/claim-firebase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store, private',
  'Pragma': 'no-cache',
};

export async function GET() {
  try {
    const pricing = await getStorePricing();
    return Response.json({ pricing }, { headers });
  } catch {
    return Response.json(
      { pricing: { price: 75000, originalPrice: 150000, updatedAt: Date.now() } },
      { headers }
    );
  }
}

export async function POST(request: Request) {
  try {
    const backend = claimBackend();
    const uid = await backend.authorize(request.headers.get('authorization'));
    await backend.rateLimit('admin-pricing-' + uid, 30);

    const body = await request.json();
    const price = Number(body?.price);
    const originalPrice = body?.originalPrice ? Number(body.originalPrice) : undefined;

    if (!price || isNaN(price)) {
      return Response.json({ error: 'Harga harus berupa angka valid.' }, { status: 400, headers });
    }

    const updated = await updateStorePricing(price, originalPrice);
    return Response.json({ success: true, pricing: updated }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memperbarui harga.';
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return Response.json({ error: message }, { status, headers });
  }
}
