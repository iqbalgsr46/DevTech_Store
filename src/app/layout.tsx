import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://devtechstore.my.id"),
  title: {
    default: "DevTech AI Store - Jual Akun ChatGPT Plus Murah & Bergaransi Resmi",
    template: "%s | DevTech AI Store",
  },
  description:
    "Beli Akun ChatGPT Plus Murah Resmi & Bergaransi. Akses GPT-4o, OpenAI o1 Reasoning, DALL-E 3, Canvas, Advanced Voice Mode. Pembayaran QRIS Cepat & Praktis.",
  keywords: [
    "DevTech AI Store",
    "devtechstore.my.id",
    "chatgpt plus murah",
    "jual chatgpt plus",
    "langganan chatgpt plus indonesia",
    "beli akun chatgpt plus",
    "chatgpt plus resmi bergaransi",
    "gpt 4o openai indonesia",
    "2fa live chatgpt",
  ],
  authors: [{ name: "DevTech AI Store" }],
  creator: "DevTech AI Store",
  publisher: "DevTech AI Store",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  alternates: {
    canonical: "https://devtechstore.my.id",
  },
  verification: {
    google: "_2Q1cke-Z0W6oJhYJWeYX9MDqSui1HvRqZ7w5q7qs_U",
  },
  openGraph: {
    title: "DevTech AI Store - Jual Akun ChatGPT Plus Murah & Bergaransi",
    description: "Akses Penuh Akun ChatGPT Plus GPT-4o & o1 Reasoning Resmi, Aman & Bergaransi. Bayar via QRIS Cepat.",
    url: "https://devtechstore.my.id",
    siteName: "DevTech AI Store",
    locale: "id_ID",
    type: "website",
    images: [
      {
        url: "/logo.jpeg",
        width: 1200,
        height: 630,
        alt: "DevTech AI Store Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevTech AI Store - Jual Akun ChatGPT Plus Murah",
    description: "Akses Penuh ChatGPT Plus GPT-4o & o1 Reasoning Resmi & Bergaransi dengan Harga Terbaik.",
    images: ["/logo.jpeg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Structured Data (JSON-LD) untuk Google Search Rich Snippet
  const jsonLd = {
    "@graph": [
      {
        "@context": "https://schema.org",
        "@type": "Store",
        "name": "DevTech AI Store",
        "url": "https://devtechstore.my.id",
        "logo": "https://devtechstore.my.id/logo.jpeg",
        "description": "DevTech AI Store adalah penyedia layanan langganan Google AI Pro premium resmi dan bergaransi di Indonesia, bukan perusahaan pembuat perangkat lunak (software development). Kami fokus pada penjualan lisensi AI.",
        "priceRange": "Rp15.000 - Rp60.000",
        "paymentAccepted": "QRIS, Transfer Bank",
        "currenciesAccepted": "IDR",
        "offers": {
          "@type": "Offer",
          "priceCurrency": "IDR",
          "price": "15000",
          "availability": "https://schema.org/InStock",
          "url": "https://devtechstore.my.id"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Apa itu DevTech AI Store?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "DevTech AI Store adalah toko online di Indonesia yang khusus menyediakan layanan langganan Google AI Pro dengan harga terjangkau, aman, dan bergaransi. Kami tidak menyediakan layanan integrasi LLM atau pembuatan software, melainkan murni toko penyedia akses AI resmi."
            }
          },
          {
            "@type": "Question",
            "name": "Apakah DevTech AI Store sama dengan DevTechAI?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Tidak. DevTech AI Store (devtechstore.my.id) adalah entitas independen di Indonesia yang fokus pada penjualan paket langganan Google AI Pro untuk end-user. Kami tidak terafiliasi dengan perusahaan software development global bernama DevTechAI."
            }
          }
        ]
      }
    ]
  };

  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} h-full antialiased font-sans`}
    >
      <head>
        <meta name="google-site-verification" content="_2Q1cke-Z0W6oJhYJWeYX9MDqSui1HvRqZ7w5q7qs_U" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-white text-slate-900 selection:bg-slate-900 selection:text-white overflow-x-hidden">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
