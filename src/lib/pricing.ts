// Pricing Data & Logic - ChatGPT Plus Store
// Dikhususkan untuk produk tunggal: ChatGPT Plus Private 1 Bulan

export const HARGA_PRIVATE: Record<number, number> = {
  1: 75000,
};

export const PRODUK_CHATGPT_PLUS = {
  id: "chatgpt_plus_private",
  nama: "ChatGPT Plus Private (1 Bulan)",
  harga: 75000,
  durasi: "1 Bulan Penuh (30 Hari)",
  garansi: "Garansi Aktif 30 Hari",
  fitur: [
    "100% Akun Private Eksklusif (1 Pengguna)",
    "Bebas Ganti Password & Email Sendiri",
    "Akses Model GPT-4o, Canvas, OpenAI o1 & o3-mini",
    "DALL·E 3 Image Generation Tanpa Batas Free",
    "Advanced Voice Mode Real-time Interaktif",
    "Advanced Data Analysis (Upload File, Python Cloud)",
    "Custom GPTs Store & Web Browsing Lengkap",
    "Dilengkapi Kunci Otentikasi 2FA (2fa.live)",
  ],
} as const;

export function formatRupiah(angka: number): string {
  return `Rp${angka.toLocaleString("id-ID")}`;
}
