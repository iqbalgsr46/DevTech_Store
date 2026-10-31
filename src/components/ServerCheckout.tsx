"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

export default function ServerCheckout({ className }: { className: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const pendingKey = useRef<string | null>(null);
  const [receipt, setReceipt] = useState<{ path: string; whatsapp: string } | null>(null);

  const [currentPrice, setCurrentPrice] = useState<number>(75000);

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.pricing?.price && typeof data.pricing.price === "number") {
          setCurrentPrice(data.pricing.price);
        }
      })
      .catch(() => {});
  }, []);

  const formattedPrice = `Rp ${currentPrice.toLocaleString("id-ID")}`;

  const startCheckout = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      pendingKey.current ??= sessionStorage.getItem("devtech_pending_order") || crypto.randomUUID();
      const idempotencyKey = pendingKey.current;
      sessionStorage.setItem("devtech_pending_order", idempotencyKey);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: "chatgpt-plus-private-1m", idempotencyKey }),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Server checkout sedang sibuk atau belum siap. Silakan coba sesaat lagi.");
      }
      const data = await response.json();
      if (!response.ok || typeof data.order?.id !== "string" || typeof data.receiptPath !== "string" || !/^\/orders\/[A-Za-z0-9_-]+$/.test(data.receiptPath)) throw new Error(data.error || "Gagal menerima bukti pesanan. Coba lagi untuk memulihkan pesanan yang sama.");
      const message = [
        "*PESANAN DEVTECH STORE*",
        "──────────────────────",
        "• *Produk:* ChatGPT Plus Private",
        "• *Durasi:* 1 Bulan",
        "• *Tipe Akun:* privat",
        `• *ID Pesanan:* ${data.order.id}`,
        `• *Total Tagihan:* ${formattedPrice}`,
        "──────────────────────",
        "",
        "",
        "",
        "Halo Admin, saya ingin melanjutkan pembayaran via WhatsApp. Mohon instruksi pembayarannya. Terima kasih!",
      ].join("\n");
      const encoded = encodeURIComponent(message);
      setReceipt({ path: data.receiptPath, whatsapp: `https://wa.me/6285872066832?text=${encoded}` });
      window.location.href = `whatsapp://send?phone=6285872066832&text=${encoded}`;
    } catch {
      // Fallback checkout langsung ke WhatsApp jika API serverless orders mengalami kendala
      const directMessage = [
        "*PESANAN DEVTECH STORE*",
        "──────────────────────",
        "• *Produk:* ChatGPT Plus Private",
        "• *Durasi:* 1 Bulan",
        "• *Tipe Akun:* privat",
        `• *Total Tagihan:* ${formattedPrice}`,
        "──────────────────────",
        "",
        "",
        "",
        `Halo Admin, saya ingin membeli ChatGPT Plus Private 1 Bulan (${formattedPrice}). Mohon info nomor rekening / QRIS pembayarannya. Terima kasih!`,
      ].join("\n");
      const directEncoded = encodeURIComponent(directMessage);
      window.location.href = `whatsapp://send?phone=6285872066832&text=${directEncoded}`;
      setReceipt({
        path: "/",
        whatsapp: `https://wa.me/6285872066832?text=${directEncoded}`,
      });
      setError(null);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={startCheckout} disabled={loading} className={className}>
        {loading ? "Menyiapkan Pesanan..." : "Checkout via WhatsApp ↗"}
      </button>
      {error && <p role="alert" style={{ color: "#ff8282", fontSize: 12, marginTop: 4 }}>{error}</p>}
      {receipt && <div className="flex flex-wrap gap-3 text-xs mt-2">
        <a href={receipt.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">WhatsApp tidak terbuka? Gunakan wa.me ↗</a>
        <Link href={receipt.path} className="inline-flex min-h-11 items-center underline">Lihat / pulihkan bukti pesanan</Link>
      </div>}
    </>
  );
}
