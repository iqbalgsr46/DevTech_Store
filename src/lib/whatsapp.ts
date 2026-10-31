// WhatsApp Deep Link Generator
// Format pesan dan generate link WhatsApp untuk pre-order (Clean text format tanpa emoji)

const WHATSAPP_NUMBER = "6285872066832";

export interface OrderDataPaket1 {
  paket: "super_power";
  nama: string;
  whatsapp?: string;
  email?: string;
  durasi?: number;
  harga: number;
  voucherCode: string | null;
  diskon: number;
  totalBayar: number;
}

export interface OrderDataPaket2 {
  paket: "invitation";
  nama: string;
  email: string;
  whatsapp: string;
  durasi: number;
  harga: number;
  voucherCode: string | null;
  diskon: number;
  totalBayar: number;
}

export type OrderData = OrderDataPaket1 | OrderDataPaket2;

function formatTanggal(): string {
  const now = new Date();
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"][now.getDay()];
  const tgl = now.getDate();
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ][now.getMonth()];
  const tahun = now.getFullYear();
  const jam = String(now.getHours()).padStart(2, "0");
  const menit = String(now.getMinutes()).padStart(2, "0");

  return `${hari}, ${tgl} ${bulan} ${tahun} pukul ${jam}.${menit}`;
}

function formatRupiahWA(angka: number): string {
  return angka.toLocaleString("id-ID");
}

export function formatOrderMessage(data: OrderData): string {
  if (data.paket === "super_power") {
    const p1Lines = [
      "*ORDER - DevTech AI Store*",
      "━━━━━━━━━━━━━━━━",
      `Nama: ${data.nama}`,
      data.whatsapp ? `WhatsApp: ${data.whatsapp}` : "",
      data.email && data.email !== "-" ? `Email: ${data.email}` : "",
      "━━━━━━━━━━━━━━━━",
      "Paket: ChatGPT Plus (Akun Private Hak Milik)",
      `Durasi: ${data.durasi || 1} Bulan`,
      `Harga: Rp${formatRupiahWA(data.harga)}`,
    ].filter(Boolean);

    if (data.voucherCode && data.diskon > 0) {
      p1Lines.push(`Voucher: ${data.voucherCode} (-Rp${formatRupiahWA(data.diskon)})`);
    }

    p1Lines.push(
      `*Total: Rp${formatRupiahWA(data.totalBayar)}*`,
      "━━━━━━━━━━━━━━━━",
      "",
      "Halo, saya ingin membeli Paket ChatGPT Plus (Akun Private Hak Milik).",
      "Mohon kirimkan Kode Kunci Klaim akun setelah pembayaran terkonfirmasi.",
      "",
      formatTanggal()
    );

    return p1Lines.join("\n");
  }

  // Paket Sharing
  const lines = [
    "*ORDER - DevTech AI Store*",
    "━━━━━━━━━━━━━━━━",
    `Nama: ${data.nama}`,
    `Email: ${data.email}`,
    `WhatsApp: ${data.whatsapp}`,
    "━━━━━━━━━━━━━━━━",
    "Paket: ChatGPT Plus (Akun Sharing)",
    `Durasi: ${data.durasi} Bulan`,
    `Harga: Rp${formatRupiahWA(data.harga)}`,
  ];

  if (data.voucherCode && data.diskon > 0) {
    lines.push(`Voucher: ${data.voucherCode} (-Rp${formatRupiahWA(data.diskon)})`);
  }

  lines.push(
    `*Total: Rp${formatRupiahWA(data.totalBayar)}*`,
    "━━━━━━━━━━━━━━━━",
    "",
    "Halo, saya ingin membeli Paket ChatGPT Plus (Akun Sharing).",
    "Mohon kirimkan Kode Kunci Klaim akun setelah pembayaran terkonfirmasi.",
    "",
    formatTanggal()
  );

  return lines.join("\n");
}

export function generateWhatsAppLink(data: OrderData): string {
  const message = formatOrderMessage(data);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
}
