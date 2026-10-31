"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Terminal as TerminalIcon,

  X,
  Minus,
  ExternalLink,

  Copy,
  Check,
  Send,
  ArrowLeft,

  KeyRound,

  MessageSquare,
} from "lucide-react";

interface LogEntry {
  id: string;
  type: "command" | "output" | "success" | "error" | "warning" | "banner" | "box" | "action" | "chatgpt-card";
  text?: string;
  data?: { email: string; password: string; secret2fa: string };
}

// Simple Base32 decode for optional fallback TOTP
function base32ToBytes(base32: string): Uint8Array<ArrayBuffer> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/\s/g, "").replace(/=+$/, "");
  if (!/^[A-Z2-7]+$/.test(cleaned)) throw new Error("Invalid Base32 key");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

// Web Crypto HMAC-SHA1 TOTP generator
async function generateTotp(secret: string): Promise<string> {
  try {
    const keyBytes = base32ToBytes(secret);
    if (keyBytes.length === 0) return "INVALID_KEY";
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    const counterBuffer = new ArrayBuffer(8);
    const view = new DataView(counterBuffer);
    view.setUint32(4, counter, false);

    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "HMAC", hash: { name: "SHA-1" } },
      false,
      ["sign"]
    );

    const signature = await window.crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
    const sigBytes = new Uint8Array(signature);
    const offset = sigBytes[sigBytes.length - 1] & 0x0f;
    const binary =
      ((sigBytes[offset] & 0x7f) << 24) |
      ((sigBytes[offset + 1] & 0xff) << 16) |
      ((sigBytes[offset + 2] & 0xff) << 8) |
      (sigBytes[offset + 3] & 0xff);

    const otp = (binary % 1000000).toString().padStart(6, "0");
    return otp;
  } catch {
    return "ERROR";
  }
}

function TerminalContent() {
  const router = useRouter();
  const [activeCode, setActiveCode] = useState<string>("");
  const [gateInput, setGateInput] = useState<string>("");
  const [gateError, setGateError] = useState<string | null>(null);

  const [inputVal, setInputVal] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [currentStepText, setCurrentStepText] = useState<string>("");

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);



  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = gateInput.trim();
    if (!trimmed) {
      setGateError("Masukkan kode klaim dari admin terlebih dahulu.");
      return;
    }
    setGateError(null);
    setActiveCode(trimmed);
    setGateInput("");
    void handleClaim(trimmed);

  };

  const requestRef = useRef<AbortController | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  const handleClaim = async (passcode: string) => {
    if (!passcode.trim()) return;
    requestRef.current?.abort();
    if (progressRef.current) clearInterval(progressRef.current);
    const controller = new AbortController();
    requestRef.current = controller;
    setIsExecuting(true);
    setLoadingProgress(0);
    setCurrentStepText("Menunggu respons server...");
    setLogs([{ id: "step-init", type: "output", text: "[*] Mengirim permintaan klaim. Kode disembunyikan." }]);
    progressRef.current = setInterval(() => {
      setLoadingProgress((previous) => (previous + 10) % 100);
    }, 500);
    try {
      const response = await fetch("/api/claims", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", code: passcode.trim() }),
      });
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || typeof data.account?.email !== "string" || typeof data.account?.password !== "string" || typeof data.account?.secret2fa !== "string") {
        throw new Error(response.status === 404 ? "[-] Kode klaim tidak valid atau belum terdaftar." : data.error || "Klaim gagal. Hubungi admin WhatsApp.");
      }
      setLogs((previous) => [...previous,
        { id: "validated", type: "success", text: "[+] Server mengonfirmasi klaim. Detail akun diterima." },
        { id: "account", type: "chatgpt-card", data: data.account },
      ]);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLogs((previous) => [...previous, { id: "failed", type: "error", text: error instanceof Error ? error.message : "[-] Gagal mengambil akun." }]);
    } finally {
      if (requestRef.current === controller) {
        if (progressRef.current) clearInterval(progressRef.current);
        requestRef.current = null;
        if (!controller.signal.aborted) setIsExecuting(false);
      }
    }
  };

  const handleExecute = async (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    if (!trimmed || isExecuting) return;

    setHistory((prev) => [...prev, /^(help|clear|status|guide|login|store|exit)$/.test(trimmed) ? trimmed : "[input disembunyikan]"]);
    setHistoryIndex(-1);
    setInputVal("");
    setIsExecuting(true);

    const cmdEntryId = "user-cmd-" + Date.now();

    setLogs((prev) => [
      ...prev,
      {
        id: cmdEntryId,
        type: "command",
        text: "devtech> [perintah diterima]",
      },
    ]);

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    switch (command) {
      case "help":
      case "?":
        setLogs((prev) => [
          ...prev,
          {
            id: "help-" + Date.now(),
            type: "output",
            text: `Daftar Perintah Shell DevTech Terminal:
  • claim <KODE>      : Klaim & terima akun ChatGPT Plus (atau ketik langsung KODE di prompt)
  • 2fa               : Buka website https://2fa.live/ di browser tab baru
  • 2fa <SECRET>      : Generate kode 6-digit TOTP langsung di konsol ini
  • login / chatgpt   : Buka portal login resmi https://chatgpt.com
  • guide / panduan   : Tampilkan panduan cara login menggunakan 2fa.live
  • status            : Cek status gateway server & koneksi database
  • clear             : Bersihkan riwayat tampilan terminal
  • store / exit      : Kembali ke toko utama DevTech AI Store
  • contact           : Informasi kontak WhatsApp admin & customer service`,
          },
        ]);
        setIsExecuting(false);
        break;

      case "clear":
      case "cls":
        setLogs([]);
        setIsExecuting(false);
        break;

      case "guide":
      case "panduan":
        setLogs((prev) => [
          ...prev,
          {
            id: "guide-" + Date.now(),
            type: "box",
            text: `╔══════════════════════════════════════════════════════════════════════════╗
║               TATA CARA LOGIN CHATGPT PLUS DENGAN 2FA.LIVE               ║
╠══════════════════════════════════════════════════════════════════════════╣
║ 1. Buka ChatGPT di https://chatgpt.com lalu klik tombol "Log In".        ║
║ 2. Masukkan Email & Password yang Anda dapatkan saat klaim.              ║
║ 3. Ketika muncul form permintaan kode 2-Step Verification:               ║
║    Buka tautan website: https://2fa.live/                                ║
║ 4. Salin "2FA Secret Key" dari akun Anda, lalu paste ke kolom          ║
║    "2FA Secret" di situs https://2fa.live/                              ║
║ 5. Klik tombol "Submit" di 2fa.live.                                    ║
║ 6. Kode verifikasi 6 digit akan langsung muncul di kotak "2FA Code".     ║
║ 7. Copy kode tersebut, lalu paste ke halaman login ChatGPT. Selesai!     ║
╚══════════════════════════════════════════════════════════════════════════╝`,
          },
        ]);
        setIsExecuting(false);
        break;

      case "2fa":
      case "2falive":
        if (!arg) {
          window.open("https://2fa.live/", "_blank", "noopener,noreferrer");
          setLogs((prev) => [
            ...prev,
            {
              id: "open-2fa-" + Date.now(),
              type: "success",
              text: `[+] Membuka portal verifikasi https://2fa.live/ di tab baru...
[i] Tempelkan 2FA Secret Key Anda pada kotak '2FA Secret' di halaman tersebut lalu klik 'Submit'.`,
            },
          ]);
          setIsExecuting(false);
          return;
        }

        const otp = await generateTotp(arg);
        if (otp === "INVALID_KEY" || otp === "ERROR") {
          setLogs((prev) => [
            ...prev,
            {
              id: "2fa-err-" + Date.now(),
              type: "error",
              text: `[-] Secret key tidak valid. Silakan gunakan portal web resmi di https://2fa.live/`,
            },
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              id: "2fa-res-" + Date.now(),
              type: "success",
              text: `[+] 2FA CODE (6-DIGIT): ${otp}\n[+] Valid untuk 30 detik. Segera masukkan ke form login ChatGPT!`,
            },
          ]);
        }
        setIsExecuting(false);
        break;

      case "login":
      case "chatgpt":
        window.open("https://chatgpt.com/auth/login", "_blank", "noopener,noreferrer");
        setLogs((prev) => [
          ...prev,
          {
            id: "login-" + Date.now(),
            type: "success",
            text: `[+] Membuka portal login OpenAI di https://chatgpt.com/auth/login...`,
          },
        ]);
        setIsExecuting(false);
        break;

      case "status":
        setLogs((prev) => [
          ...prev,
          {
            id: "status-" + Date.now(),
            type: "output",
            text: `DevTech Account Claim\nStatus akun hanya ditampilkan setelah kode berhasil diverifikasi server.`,
          },
        ]);
        setIsExecuting(false);
        break;

      case "store":
      case "exit":
      case "quit":
        setLogs((prev) => [
          ...prev,
          {
            id: "exit-" + Date.now(),
            type: "output",
            text: `[!] Mengalihkan ke halaman utama DevTech AI Store...`,
          },
        ]);
        router.push("/");
        break;

      case "contact":
      case "admin":
        setLogs((prev) => [
          ...prev,
          {
            id: "contact-" + Date.now(),
            type: "output",
            text: `[SUPPORT CHANNELS]
  • WhatsApp Admin : +62 858-7206-6832
  • Jam Layanan    : 24 Jam Online
  • Layanan        : Garansi Akun ChatGPT Plus, Kode Klaim & Bantuan 2FA`,
          },
        ]);
        setIsExecuting(false);
        break;

      case "claim":
      case "redeem":
        if (!arg) {
          setLogs((prev) => [
            ...prev,
            {
              id: "claim-err-" + Date.now(),
              type: "error",
              text: `[-] Gunakan format: claim <KODE_KLAIM>`,
            },
          ]);
          setIsExecuting(false);
          return;
        }
        await handleClaim(arg);
        break;

      default:
        if (trimmed.length >= 3) {
          await handleClaim(trimmed);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              id: "unrec-" + Date.now(),
              type: "error",
              text: `[-] Perintah '${command}' tidak dikenali. Ketik 'help' untuk panduan perintah atau ketik kode klaim Anda.`,
            },
          ]);
          setIsExecuting(false);
        }
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleExecute(inputVal);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(history[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInputVal("");
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(history[nextIndex]);
      }
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setLogs([]);
    }
  };

  if (!activeCode) {
    return (
      <div className="min-h-dvh bg-[#080d10] text-[#edf3ef] flex flex-col font-sans">
        <header className="min-h-16 border-b border-[#23302b] px-4 sm:px-8 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Image src="/devtech-navbar.jpg" alt="Logo DevTech" width={36} height={36} className="rounded-lg object-cover shrink-0" />
            <div><span className="font-bold text-[13px] sm:text-sm block">DevTech Store</span><span className="text-[10px] text-emerald-300 font-mono tracking-widest">ACCOUNT ACCESS</span></div>
          </div>
          <Link href="/" className="min-h-11 flex items-center gap-1.5 text-xs text-slate-300 shrink-0 px-3 border border-[#2b3932] rounded-lg"><ArrowLeft size={14} />Toko</Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
          <section className="w-full max-w-lg min-w-0 bg-[#10181d] border border-[#28362f] rounded-2xl overflow-hidden">
            <div className="h-11 bg-[#0c1216] border-b border-[#28362f] px-5 flex items-center justify-between gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-2 text-slate-300"><TerminalIcon size={14} className="text-emerald-300" />devtech / claim</span>
              <span className="text-emerald-300 whitespace-nowrap">01 / AKSES</span>
            </div>
            <div className="p-5 sm:p-8 space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] sm:text-[11px] tracking-[0.12em] font-mono text-emerald-300">CHATGPT PLUS PRIVATE</p>
                <h1 className="text-[24px] sm:text-[28px] leading-tight font-semibold tracking-tight">Masukkan kode klaim</h1>
                <p className="text-[13px] sm:text-sm leading-6 text-slate-300">Gunakan kode dari admin WhatsApp untuk melanjutkan ke terminal akun.</p>
              </div>
              <form onSubmit={handleGateSubmit} className="space-y-3">
                <label htmlFor="claim-code" className="block text-xs font-medium text-slate-300">Kode klaim rahasia dari admin</label>
                <div className="flex items-center gap-3 bg-[#080d10] border border-[#34473c] focus-within:border-emerald-400 rounded-lg px-3.5 min-h-[52px]">
                  <span aria-hidden="true" className="text-emerald-300 font-mono shrink-0">&gt;_</span>
                  <input id="claim-code" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={gateInput} onChange={(e) => {setGateInput(e.target.value); if (gateError) setGateError(null);}} placeholder="Masukkan kode Anda" aria-invalid={!!gateError} aria-describedby={gateError ? "claim-error" : undefined} className="w-full min-w-0 bg-transparent text-white font-mono text-base outline-none placeholder:text-slate-400" />
                </div>
                {gateError && <p id="claim-error" role="alert" className="text-rose-300 text-xs leading-5">{gateError}</p>}
                <button type="submit" className="w-full min-h-[48px] rounded-lg bg-emerald-400 hover:bg-emerald-300 text-[#062418] font-semibold text-sm flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"><TerminalIcon size={16} />Buka Terminal<span aria-hidden="true">→</span></button>
              </form>
              <div className="border-t border-[#28362f] pt-5 space-y-3 text-[12px] sm:text-[13px] leading-[1.7] text-slate-300">
                <p>Detail akun mencakup <span className="text-white">email, password, dan kunci 2FA.</span></p>
                <p>Gunakan kunci 2FA di <span className="text-emerald-300">2fa.live</span> untuk memperoleh kode OTP 6 digit.</p>
                <p className="text-emerald-200">Akun private dengan password yang bisa Anda ganti.</p>
              </div>
            </div>
            <footer className="border-t border-[#28362f] bg-[#0c1216] px-5 py-3 sm:px-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-400">Belum punya kode?</span>
              <Link href="/" className="min-h-11 inline-flex items-center text-emerald-300 font-medium hover:underline">Pesan via WhatsApp →</Link>
            </footer>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-full flex flex-col bg-[#080d10] font-mono text-slate-200 select-text">
      <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-[#202c26] bg-[#0c1318]/95 backdrop-blur px-3 sm:px-4 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => router.push("/")}
              title="Kembali ke Toko"
              className="flex h-3 w-3 sm:h-3.5 sm:w-3.5 items-center justify-center rounded-full bg-[#ff5f56] transition hover:brightness-110 active:scale-90"
            >
              <X size={8} className="text-[#4a0002] opacity-0 hover:opacity-100" />
            </button>
            <button
              onClick={() => setLogs([])}
              title="Clear Terminal"
              className="flex h-3 w-3 sm:h-3.5 sm:w-3.5 items-center justify-center rounded-full bg-[#ffbd2e] transition hover:brightness-110 active:scale-90"
            >
              <Minus size={8} className="text-[#4a3200] opacity-0 hover:opacity-100" />
            </button>
          </div>

          <span className="ml-1 sm:ml-2 text-xs font-semibold text-slate-300 truncate flex items-center gap-1.5">
            <TerminalIcon size={13} className="text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">root@kali:</span> ~/devtech-claim
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          <button
            onClick={() => {
              requestRef.current?.abort();
              if (progressRef.current) clearInterval(progressRef.current);
              setIsExecuting(false);
              setLogs([]);
              setActiveCode("");
              setGateInput("");
              router.push("/claim");
            }}
            className="flex items-center gap-1 rounded bg-[#101920] border border-emerald-500/40 px-2.5 py-1 text-emerald-300 hover:bg-[#16232c] text-[11px] sm:text-xs transition active:scale-95"
          >
            <KeyRound size={12} />
            <span>Ganti Kode</span>
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 rounded bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:bg-slate-700 text-[11px] sm:text-xs transition active:scale-95"
          >
            <ArrowLeft size={12} />
            <span className="hidden sm:inline">Toko</span>
          </button>
        </div>
      </header>

      <main
        className="flex-1 p-3 sm:p-5 text-[12px] sm:text-[13px] leading-relaxed text-slate-300 space-y-3 font-mono pb-12"
      >
        {/* Dynamic Dark-Hack HUD Progress Bar */}
        {isExecuting && (
          <div className="bg-[#0b1411] border border-emerald-500/40 rounded-xl p-3 sm:p-4 my-2 shadow-lg shadow-emerald-950/40 animate-pulse">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-emerald-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                MENUNGGU RESPONS SERVER
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                Animasi aktivitas
              </span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-[#050a08] border border-emerald-500/30 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 h-full transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
              <span className="truncate text-emerald-300/90">&gt; {currentStepText || "Memproses..."}</span>
              <span className="shrink-0 text-slate-500 font-mono pl-2">PENDING</span>
            </div>
          </div>
        )}

        {logs.map((log) => {
          if (log.type === "banner") {
            return (
              <pre
                key={log.id}
                className="overflow-x-auto text-[10px] sm:text-xs leading-none font-bold text-emerald-400 select-none pb-2"
              >
                {log.text}
              </pre>
            );
          }

          if (log.type === "command") {
            return (
              <div key={log.id} className="flex items-center gap-2 text-emerald-400 font-semibold pt-2">
                <span>{log.text}</span>
              </div>
            );
          }

          if (log.type === "error") {
            return (
              <div key={log.id} className="rounded border border-red-500/30 bg-red-950/20 p-3 text-red-400">
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "box") {
            return (
              <div key={log.id} className="rounded border border-amber-500/40 bg-amber-950/20 p-3 text-amber-300 my-2">
                <pre className="whitespace-pre-wrap font-mono text-[11px] sm:text-xs leading-5">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "success") {
            return (
              <div key={log.id} className="rounded border border-emerald-500/40 bg-emerald-950/20 p-3 text-emerald-300">
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "chatgpt-card" && log.data) {
            const { email, password, secret2fa } = log.data;
            return (
              <div
                key={log.id}
                className="my-3 rounded-xl border border-emerald-500/80 bg-[#07100c] p-3.5 sm:p-5 shadow-2xl shadow-emerald-950/50 space-y-3.5 animate-in fade-in zoom-in duration-300 max-w-full overflow-hidden"
              >
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-500/30 pb-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-emerald-400 text-black font-black text-xs shrink-0">
                      ✓
                    </span>
                    <div>
                      <h4 className="font-bold text-white text-sm sm:text-base leading-snug">
                        Akun ChatGPT Plus Private (Hak Milik)
                      </h4>
                      <p className="text-[11px] text-emerald-400 mt-0.5">Status: <span className="text-white font-semibold">Tervalidasi Database</span></p>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-500/50 rounded px-2.5 py-1">
                    ● PRIVATE 1 BULAN
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-lg bg-[#040806] p-2.5 border border-[#1b3124] space-y-1">
                    <span className="text-slate-400 font-semibold block text-[10px] tracking-wider">EMAIL CHATGPT:</span>
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-emerald-300 font-bold select-all truncate text-xs sm:text-[13px]">{email}</span>
                      <button
                        onClick={() => handleCopy(email, log.id + "-email")}
                        className="rounded bg-[#122319] hover:bg-[#1a3425] text-slate-200 px-2 py-1 transition shrink-0 flex items-center gap-1 text-[11px] active:scale-95"
                      >
                        {copiedId === log.id + "-email" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedId === log.id + "-email" ? "Disalin" : "Salin"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#040806] p-2.5 border border-[#1b3124] space-y-1">
                    <span className="text-slate-400 font-semibold block text-[10px] tracking-wider">PASSWORD AKUN:</span>
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-emerald-300 font-bold select-all truncate text-xs sm:text-[13px]">{password}</span>
                      <button
                        onClick={() => handleCopy(password, log.id + "-pass")}
                        className="rounded bg-[#122319] hover:bg-[#1a3425] text-slate-200 px-2 py-1 transition shrink-0 flex items-center gap-1 text-[11px] active:scale-95"
                      >
                        {copiedId === log.id + "-pass" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{copiedId === log.id + "-pass" ? "Disalin" : "Salin"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-500/50 bg-[#120f06] p-3 sm:p-3.5 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                      <KeyRound size={14} className="shrink-0" />
                      <span>KODE 2FA SECRET (Base32):</span>
                    </div>
                    <span className="text-[10px] text-amber-400/80 font-mono">Input ke https://2fa.live</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-black/90 rounded p-2 border border-amber-500/30 min-w-0">
                    <span className="text-amber-200 font-mono font-black text-xs sm:text-sm tracking-wide select-all truncate">
                      {secret2fa}
                    </span>
                    <button
                      onClick={() => handleCopy(secret2fa, log.id + "-2fa")}
                      className="rounded bg-amber-400 hover:bg-amber-300 text-black font-bold px-2.5 py-1 transition shrink-0 flex items-center gap-1 text-[11px] active:scale-95"
                    >
                      {copiedId === log.id + "-2fa" ? <Check size={11} className="text-black" /> : <Copy size={11} />}
                      <span>{copiedId === log.id + "-2fa" ? "Tersalin!" : "Salin 2FA"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <a
                    href="https://2fa.live/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2.5 font-bold text-black transition text-xs"
                  >
                    <ExternalLink size={14} />
                    <span>BUKA 2FA.LIVE (AMBIL KODE 6-DIGIT) ↗</span>
                  </a>

                  <a
                    href="https://chatgpt.com/auth/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 active:scale-95 px-4 py-2.5 font-bold text-black transition text-xs"
                  >
                    <MessageSquare size={14} />
                    <span>BUKA CHATGPT.COM (LOGIN) ↗</span>
                  </a>
                </div>

                <div className="rounded-lg bg-[#040806] border border-[#1b3124] p-3 text-[11px] leading-relaxed text-slate-300 space-y-1 font-mono">
                  <p className="text-emerald-300 font-semibold">💡 Panduan Login & Hak Milik:</p>
                  <p>1. Salin <b className="text-amber-300">2FA Secret Key</b> di atas.</p>
                  <p>2. Buka <b className="text-amber-300">2fa.live</b> &rarr; tempel ke kolom &apos;2FA Secret&apos; &rarr; klik &apos;Submit&apos;.</p>
                  <p>3. Masukkan 6 angka OTP yang didapat ke verifikasi ChatGPT.</p>
                  <p className="text-emerald-300 font-semibold">4. Akun private dengan password yang bisa Anda ganti setelah login.</p>
                </div>
              </div>
            );
          }

          return (
            <div key={log.id} className="text-slate-300 animate-in fade-in slide-in-from-left-2 duration-200">
              <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">{log.text}</pre>
            </div>
          );
        })}

        {isExecuting ? (
          <div className="flex items-center gap-2 text-emerald-400 text-xs py-2 animate-pulse">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-mono">Permintaan sedang diproses. Belum ada hasil dari server.</span>
            <span className="inline-block animate-ping text-emerald-300">_</span>
          </div>
        ) : (
          <div className="pt-2 border-t border-[#1b2721]">
            <div className="text-emerald-400 text-xs select-none">┌──(root㉿kali)-[~]</div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-xs select-none">└─#</span>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik 'help' atau masukkan kode baru..."
                className="flex-1 bg-transparent font-mono text-base text-white placeholder-slate-600 outline-none border-none focus:ring-0"
                spellCheck={false}
                autoComplete="off"
              />
              {inputVal && (
                <button
                  onClick={() => handleExecute(inputVal)}
                  className="shrink-0 flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black px-2.5 py-1 text-xs font-bold transition active:scale-95"
                >
                  <Send size={11} />
                  <span>KIRIM</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div ref={terminalEndRef} />
      </main>
    </div>
  );
}

export default function Terminal2FAPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#0b0c10] font-mono text-emerald-400 text-sm">
          [+] Memuat Terminal Shell Dispatch ChatGPT Plus...
        </div>
      }
    >
      <TerminalContent />
    </Suspense>
  );
}
