import Image from "next/image";
import Link from "next/link";
import { HARGA_PRIVATE, formatRupiah } from "@/lib/pricing";
import ServerCheckout from "@/components/ServerCheckout";
import styles from "./checkout-polish.module.css";

export default function CheckoutPage() {
  const price = formatRupiah(HARGA_PRIVATE[1]);
  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brand}><Image src="/devtech-navbar.jpg" alt="Logo DevTech AI Store" width={44} height={44} className={styles.brandLogo} priority /><span>DevTech<span className={styles.brandSub}>AI Store</span></span></div>
        <nav aria-label="Navigasi utama"><Link className={styles.terminal} href="/claim">&gt;_ Terminal Klaim</Link></nav>
      </header>
      <main className={styles.main}>
        <article className={styles.product}>
          <div className={styles.artwork}>
            <Image src="/chatgpt-official.svg" alt="Logo ChatGPT" width={160} height={160} priority unoptimized className={styles.logo} />
            <span className={styles.wordmark}>ChatGPT <span>Plus</span></span>
          </div>
          <div className={styles.details}>
            <p className={styles.eyebrow}>AKUN PRIVATE · 1 PENGGUNA</p>
            <h1>ChatGPT Plus<span>Private 1 Bulan</span></h1>
            <p className={styles.description}>Akun pribadi, bukan sharing. Langganan Plus aktif selama 1 bulan.</p>
            <div className={styles.price}>{price}<span>/ 1 bulan</span></div>
            <ServerCheckout className={styles.checkout} />
            <p className={styles.note}>Pemesanan, pembayaran, dan konfirmasi hanya melalui WhatsApp. Kode dari admin ditukarkan di Terminal Klaim.</p>
          </div>
        </article>
      </main>
      <footer className={styles.footer}>Penjual independen, bukan bagian dari OpenAI.</footer>
    </div>
  );
}

