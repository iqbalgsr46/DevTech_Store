import Image from "next/image";
import Link from "next/link";
import { getStorePricing } from "@/lib/server/pricing-store";
import { formatRupiah } from "@/lib/pricing";
import ServerCheckout from "@/components/ServerCheckout";
import {
  Sparkles,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Lock,
  Headphones,
  Palette,
  FileCode,
  Compass,
  ArrowRight,
  Clock,
  Layers,
  Flame,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const storePricing = await getStorePricing();
  const price = formatRupiah(storePricing.price);
  const originalPrice = formatRupiah(storePricing.originalPrice || storePricing.price * 2);

  return (
    <div className="min-h-screen bg-[#070b0e] text-[#edf3ef] flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-16 sm:h-20 border-b border-[#1c2923] bg-[#070b0e]/90 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/devtech-navbar.jpg"
            alt="Logo DevTech AI Store"
            width={40}
            height={40}
            className="rounded-xl border border-[#2b4234] object-cover shadow-sm"
            priority
          />
          <div>
            <span className="font-bold text-sm sm:text-base tracking-tight block text-white">DevTech Store</span>
            <span className="text-[10px] text-emerald-400 font-mono tracking-widest font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              CHATGPT PLUS OFFICIAL
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/claim"
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-[#0e1b14] border border-emerald-500/40 text-emerald-300 hover:bg-[#162a20] hover:border-emerald-400 transition shadow-sm active:scale-95"
          >
            <Terminal size={14} className="text-emerald-400" />
            <span className="font-mono">&gt;_ Terminal Klaim</span>
          </Link>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-10 sm:space-y-16">
        {/* Hero Section / Product Card */}
        <section className="bg-gradient-to-b from-[#101920] to-[#0c1318] border border-[#22352b] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/80">
          <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
            {/* Artwork Column */}
            <div className="md:col-span-5 bg-gradient-to-br from-[#0c1a14] via-[#09130f] to-[#050c09] p-6 sm:p-10 flex flex-col items-center justify-center gap-6 border-b md:border-b-0 md:border-r border-[#22352b] relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12)_0%,transparent_70%)] pointer-events-none" />
              
              <div className="relative group">
                <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />
                <Image
                  src="/chatgpt-official.svg"
                  alt="Logo ChatGPT Official"
                  width={140}
                  height={140}
                  priority
                  unoptimized
                  className="relative drop-shadow-[0_0_35px_rgba(16,185,129,0.4)]"
                />
              </div>

              <div className="text-center space-y-1 relative z-10">
                <div className="flex items-center justify-center gap-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  <span>ChatGPT</span>
                  <span className="text-xs sm:text-sm font-bold px-2.5 py-1 rounded-md border border-emerald-400/50 bg-emerald-500/10 text-emerald-300">
                    PLUS
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono">Dedicated Private License</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 pt-2 relative z-10">
                <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded bg-[#102219] text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                  <ShieldCheck size={12} /> 100% Private (1 User)
                </span>
                <span className="text-[10px] font-bold tracking-wide uppercase px-2.5 py-1 rounded bg-[#14232c] text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
                  <Clock size={12} /> Garansi 30 Hari
                </span>
              </div>
            </div>

            {/* Details Column */}
            <div className="md:col-span-7 p-6 sm:p-9 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono font-semibold">
                  <Sparkles size={13} className="text-emerald-400" />
                  AKUN RESMI EKSKLUSIF · BUKAN SHARING
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
                    ChatGPT Plus Private
                    <span className="block text-lg sm:text-xl font-medium text-slate-300 mt-1">
                      Langganan 1 Bulan Penuh (Dedicated)
                    </span>
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Nikmati akses penuh ke ekosistem AI tercanggih OpenAI. Akun pribadi milik Anda sendiri, privasi histori percakapan 100% terjaga, dan bebas ganti password serta email recovery.
                  </p>
                </div>

                {/* Price Display */}
                <div className="bg-[#091014] border border-[#1d2d25] rounded-xl p-4 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block mb-0.5">HARGA PROMO RESMI TOKO:</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">{price}</span>
                      <span className="text-xs text-slate-400 font-mono">/ 1 bulan</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs line-through text-slate-500 block">{originalPrice}</span>
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                      HEMAT 50%
                    </span>
                  </div>
                </div>

                {/* Key Quick Highlights */}
                <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span>Akses Semua Model AI</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span>Advanced Voice Mode</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span>DALL-E 3 Ultra HD</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <span>Full Garansi 30 Hari</span>
                  </div>
                </div>
              </div>

              {/* Checkout CTA */}
              <div className="space-y-3 pt-2">
                <ServerCheckout className="w-full min-h-[50px] rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 hover:brightness-110 text-[#041a10] font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition" />
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Lock size={12} className="text-emerald-400" />
                    Order & Pembayaran Aman via WhatsApp
                  </span>
                  <Link href="/claim" className="text-emerald-300 hover:underline flex items-center gap-1 font-mono">
                    Punya Kode Klaim? &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Unlocked AI Models Catalog */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-semibold">
              <Flame size={13} className="text-emerald-400" />
              FULL UNLOCKED CATALOG
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Akses Semua Model AI Unggulan
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Langganan Plus membuka seluruh katalog arsitektur model tercanggih OpenAI hingga tier penalaran tertinggi:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Model 6.1 Sol Max */}
            <div className="bg-[#0e161c] border border-emerald-500/40 hover:border-emerald-400/80 rounded-2xl p-5 sm:p-6 space-y-3 transition duration-300 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition duration-500 pointer-events-none" />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    6.1
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">6.1 Sol Max Tier</h3>
                    <span className="text-[10px] text-emerald-400 font-mono">Flagship Multi-Agent Reasoning</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300">
                  TOP TIER
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Akses eksklusif tier model penalaran eksperimental tertinggi dengan arsitektur multi-agen otonom. Mampu memecahkan rantai logika berlapis, perancangan arsitektur sistem tingkat enterprise, dan penalaran matematika super-kompleks tanpa batasan.
              </p>
            </div>

            {/* Model o1 & o1-pro */}
            <div className="bg-[#0e161c] border border-[#21352b] hover:border-emerald-500/50 rounded-2xl p-5 sm:p-6 space-y-3 transition duration-300 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 font-bold text-sm">
                    o1
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">OpenAI o1 & o1-pro</h3>
                    <span className="text-[10px] text-teal-300 font-mono">Deep Chain-of-Thought</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#10222a] border border-teal-500/40 text-teal-300">
                  REASONING
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Model penalaran mendalam terkuat yang berpikir sebelum menjawab layaknya ilmuwan. Sangat superior untuk memecahkan coding rumit, kalkulus, algoritma olimpiade, dan pembuktian sains matematis.
              </p>
            </div>

            {/* Model o3-mini */}
            <div className="bg-[#0e161c] border border-[#21352b] hover:border-emerald-500/50 rounded-2xl p-5 sm:p-6 space-y-3 transition duration-300 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-sm">
                    o3
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">OpenAI o3-mini</h3>
                    <span className="text-[10px] text-cyan-300 font-mono">High-Speed Code Generation</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#0e1e24] border border-cyan-500/40 text-cyan-300">
                  ULTRA FAST
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Generasi baru penalaran ringkas dengan latensi ekstra rendah. Menghasilkan kode pemrograman siap produksi, penulisan unit test, serta debugging script secara kilat tanpa jeda antrean.
              </p>
            </div>

            {/* Model GPT-4o & GPT-4o mini */}
            <div className="bg-[#0e161c] border border-[#21352b] hover:border-emerald-500/50 rounded-2xl p-5 sm:p-6 space-y-3 transition duration-300 shadow-lg">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold text-sm">
                    4o
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">GPT-4o & GPT-4o mini</h3>
                    <span className="text-[10px] text-emerald-300 font-mono">Flagship Omni Multimodal</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#102219] border border-emerald-500/40 text-emerald-300">
                  FLAGSHIP
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Model multimodal serba bisa dengan jendela konteks 128k token. Menganalisis dokumen PDF beratus halaman, gambar beresolusi tinggi, grafik data, serta percakapan audio cerdas secara instan.
              </p>
            </div>
          </div>
        </section>

        {/* Section: Exclusive Plus Features */}
        <section className="space-y-6">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono font-semibold">
              <Zap size={13} className="text-emerald-400" />
              FITUR EKSKLUSIF PLUS
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Segala Keunggulan ChatGPT Plus
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Tingkatkan produktivitas belajar, riset, dan coding dengan fitur premium OpenAI:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-[#0b1216] border border-[#1f2f27] rounded-xl p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Headphones size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">Advanced Voice Mode</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Percakapan suara dua arah ultra-realtime layaknya berbicara langsung dengan manusia. Dilengkapi emosi, intonasi, dan kemampuan memotong percakapan secara natural.
              </p>
            </div>

            <div className="bg-[#0b1216] border border-[#1f2f27] rounded-xl p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Palette size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">DALL-E 3 Ultra HD</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Generate ilustrasi visual fotorealistik, mockup desain, render 3D, dan seni digital berkualitas tinggi langsung dari instruksi teks tanpa batas prompt ketat.
              </p>
            </div>

            <div className="bg-[#0b1216] border border-[#1f2f27] rounded-xl p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <FileCode size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">Canvas Workspace</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ruang kerja editor berdampingan untuk menulis naskah dan mengedit kode pemrograman secara live dengan saran inline, revisi spesifik baris per baris, dan debugging.
              </p>
            </div>

            <div className="bg-[#0b1216] border border-[#1f2f27] rounded-xl p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Compass size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">Deep Research Agent</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Agen otonom yang menjelajahi dan merangkum puluhan referensi ilmiah dan website berita di seluruh dunia untuk menyusun laporan riset komprehensif dalam sekejap.
              </p>
            </div>

            <div className="bg-[#0b1216] border border-[#1f2f27] rounded-xl p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">100% Akun Private</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bukan akun sharing / patungan. 1 akun eksklusif untuk 1 pembeli. Histori chat aman & pribadi, bebas ganti password, dan bebas menambahkan email recovery Anda sendiri.
              </p>
            </div>

            <div className="bg-[#0b1216] border border-[#1f2f27] rounded-xl p-5 space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Layers size={20} />
              </div>
              <h3 className="font-bold text-white text-sm">Prioritas Server 24/7</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bebas dari antrean limit jam sibuk OpenAI. Nikmati throughput kecepatan generasi token tertinggi dengan alokasi bandwidth GPU server prioritas setiap saat.
              </p>
            </div>
          </div>
        </section>

        {/* Section: 3-Step Simple Process */}
        <section className="bg-[#0b1216] border border-[#1f2e26] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">3 Langkah Mudah Aktivasi Akun</h2>
            <p className="text-xs sm:text-sm text-slate-400">Proses instan tanpa ribet, akun langsung siap pakai</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#070c0f] border border-[#18251e] rounded-xl p-4 space-y-2 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-sm mx-auto flex items-center justify-center border border-emerald-500/40">
                1
              </div>
              <h4 className="font-bold text-white text-sm">Pesan via WhatsApp</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Klik tombol pesan, lakukan pembayaran QRIS/Transfer, dan terima kode klaim rahasia dari admin.
              </p>
            </div>

            <div className="bg-[#070c0f] border border-[#18251e] rounded-xl p-4 space-y-2 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-sm mx-auto flex items-center justify-center border border-emerald-500/40">
                2
              </div>
              <h4 className="font-bold text-white text-sm">Buka Terminal Klaim</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kunjungi halaman terminal klaim, masukkan kode lisensi Anda, dan biarkan sistem mendekripsi akun.
              </p>
            </div>

            <div className="bg-[#070c0f] border border-[#18251e] rounded-xl p-4 space-y-2 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold text-sm mx-auto flex items-center justify-center border border-emerald-500/40">
                3
              </div>
              <h4 className="font-bold text-white text-sm">Login ke ChatGPT</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ambil 6-digit OTP melalui 2fa.live, langsung login di chatgpt.com, dan ganti password sesuai keinginan.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/claim"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-extrabold px-6 py-3 text-xs sm:text-sm transition active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              <Terminal size={16} />
              <span>Buka Terminal Klaim Akun Sekarang</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#18241e] bg-[#060a0d] py-6 px-4 text-center text-xs text-slate-500 space-y-2">
        <p className="font-mono text-[11px] text-slate-400">
          DevTech AI Store &bull; Penyedia Akun Private ChatGPT Plus Resmi Bergaransi 30 Hari
        </p>
        <p className="text-[10px] text-slate-600">
          Penjual independen pihak ketiga. Semua hak cipta model OpenAI (GPT-4o, o1, o3-mini) adalah milik OpenAI Inc.
        </p>
      </footer>
    </div>
  );
}
