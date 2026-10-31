import Link from "next/link";
import { notFound } from "next/navigation";
import { readOrder } from "../../../lib/server/orders";
import styles from "../../checkout-polish.module.css";

export const dynamic = "force-dynamic";

export default async function OrderReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await readOrder(token);
  if (!order) notFound();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.brand}><span>DevTech<span className={styles.brandSub}>Receipt</span></span></div>
        <nav><Link className={styles.terminal} href="/">&lt;_ Kembali</Link></nav>
      </header>
      <main className={styles.main}>
        <article className={styles.product} style={{ gridTemplateColumns: "1fr", maxWidth: 540 }}>
          <div className={styles.details}>
            <p className={styles.eyebrow}>DETAIL PESANAN KANONIKAL</p>
            <h1>{order.productName}</h1>
            <p className={styles.description}>ID Pesanan: {order.id}</p>
            <div className={styles.price}>Rp {order.amount.toLocaleString("id-ID")}<span>/ {order.durationMonths} bulan</span></div>
            <p className={styles.note}>Status: Belum dibayar (pending_confirmation)</p>
            <p className={styles.note}>Dibuat: {new Date(order.createdAt).toLocaleString("id-ID")}</p>
          </div>
        </article>
      </main>
    </div>
  );
}
