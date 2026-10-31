import {
  createOrder,
  checkOrderRateLimit,
  InvalidOrderError,
  OrderRateLimitError,
} from "../../../lib/server/orders";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
const failure = (message: string, status: number) => Response.json({ error: message }, { status, headers });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.ORDER_PUBLIC_ORIGIN || new URL(request.url).origin;
  if (origin !== expected) return failure("Origin tidak diizinkan.", 403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return failure("Gunakan JSON.", 415);
  if (Number(request.headers.get("content-length")) > 2048) return failure("Permintaan terlalu besar.", 413);
  let body: unknown;
  try {
    const reader = request.body?.getReader();
    if (!reader) return failure("Data tidak valid.", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return failure("Permintaan terlalu besar.", 413); }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return failure("Data tidak valid.", 400); }
  try {
    await checkOrderRateLimit();
    const order = await createOrder(body);
    return Response.json({ order, receiptPath: `/orders/${order.receiptToken}` }, { status: 201, headers });
  } catch (error) {
    if (error instanceof InvalidOrderError) return failure("Produk atau data pesanan tidak valid.", 400);
    if (error instanceof OrderRateLimitError) return failure("Terlalu banyak permintaan. Silakan coba lagi nanti.", 429);
    console.error("Order persistence unavailable");
    return failure("Pesanan belum dapat disimpan. Silakan coba lagi.", 503);
  }
}
