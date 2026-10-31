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
  ShieldCheck,
  Sparkles,
  Flame,
  Zap,
} from "lucide-react";

interface LogEntry {
  id: string;
  type: "command" | "output" | "success" | "error" | "warning" | "banner" | "box" | "action" | "chatgpt-card";
  text?: string;
  data?: { email: string; password: string; secret2fa: string };
}

// Base32 decode for optional fallback TOTP
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

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

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
  
  // Real Kali Linux 41-Second Animation States
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<string>("0.0");
  const [currentStepText, setCurrentStepText] = useState<string>("");
  const [spinnerIndex, setSpinnerIndex] = useState<number>(0);

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
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = () => {
    requestRef.current?.abort();
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];
  };

  useEffect(() => () => {
    clearAllTimers();
  }, []);

  // Auto-scroll terminal cleanly when logs update
  useEffect(() => {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 180) {
      terminalEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [logs, isExecuting]);

  // Master Kali Linux 41-Second Decryption Execution
  const handleClaim = async (passcode: string) => {
    const cleanCode = passcode.trim();
    if (!cleanCode) return;

    clearAllTimers();
    const controller = new AbortController();
    requestRef.current = controller;

    setIsExecuting(true);
    setLoadingProgress(0);
    setElapsedSeconds("0.0");
    setCurrentStepText("Memulai sesi klaim terminal...");
    setLogs([{ id: "prompt", type: "command", text: "┌──(user㉿kali)-[~/devtech]\n└─$ claim --code [disembunyikan]" }]);

    const TOTAL_DURATION_MS = 41000; // Exact 41 seconds duration requested
    const startTime = Date.now();

    // 1. Kick off parallel backend fetch immediately
    const apiPromise = fetch("/api/claims", {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim", code: cleanCode }),
    })
      .then(async (res) => {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            res.status === 404
              ? "Kode lisensi tidak valid atau belum terdaftar."
              : "Server dalam pemeliharaan. Silakan hubungi admin WhatsApp."
          );
        }
        const data = await res.json();
        if (!res.ok || !data.account?.email || !data.account?.password || !data.account?.secret2fa) {
          throw new Error(
            res.status === 404
              ? "Kode lisensi tidak valid atau belum terdaftar."
              : data.error || "Validasi gagal. Hubungi admin WhatsApp."
          );
        }
        return data.account as { email: string; password: string; secret2fa: string };
      })
      .catch((err) => {
        if (controller.signal.aborted) return null;
        return { failure: err instanceof Error ? err.message : "Klaim gagal." };
      });

    // 2. Kali Linux 41-Second Real-Time Smooth Counter & Spinner Interval (updates every 50ms)
    progressTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(TOTAL_DURATION_MS, now - startTime);
      const pct = Math.min(100, (elapsed / TOTAL_DURATION_MS) * 100);
      setLoadingProgress(pct);
      setElapsedSeconds((elapsed / 1000).toFixed(1));
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 50);

    // Decorative shell transcript; never represents remote commands or entitlement checks.
    const script = [
      "[boot] DEVTECH / ACCOUNT CLAIM CLIENT v2.0",
      "[info] Kali-style visual session • bukan shell sistem operasi",
      "$ devtech claim --product chatgpt-plus --code [REDACTED]",
      "[send] POST /api/claims  content-type: application/json",
      "[privacy] claim_code     : [hidden from terminal output]",
      "[privacy] credentials    : [display after server confirmation]",
      "[config] product        : ChatGPT Plus",
      "[config] session        : browser / ephemeral view",
      "[config] output         : account card + copy actions",
      "$ render --theme kali-dark --palette blue,cyan,green",
      "[ui] Loading terminal renderer ................ ready",
      "[ui] Preparing account output layout ........... ready",
      "[ui] Attaching clipboard controls .............. ready",
      "[ui] Preparing email field ..................... ready",
      "[ui] Preparing password field .................. ready",
      "[ui] Preparing two-factor instructions ......... ready",
      "$ policy --show-output-rules",
      "  ├─ source        server response only",
      "  ├─ claim code    never printed",
      "  ├─ credentials   no generated fallback",
      "  ├─ invalid code  show server error",
      "  └─ model access  not checked by this terminal",
      "$ view --prepare account-details",
      "[stage] email / password / 2FA panels queued",
      "[stage] ChatGPT login shortcut queued",
      "[stage] Support instructions queued",
      "$ account --describe-output",
      "  ├─ email           string",
      "  ├─ password        protected account field",
      "  └─ secret2fa       Base32 seed",
      "$ login --show-sequence",
      "  [01] Open chatgpt.com",
      "  [02] Enter account email",
      "  [03] Enter account password",
      "  [04] Continue until OTP is requested",
      "  [05] Open 2fa.live in a separate tab",
      "  [06] Paste the 2FA secret and select Submit",
      "  [07] Read the six-digit OTP",
      "  [08] Return to ChatGPT and enter OTP",
      "$ session --privacy",
      "  claim_code         redacted",
      "  terminal_history   sensitive input hidden",
      "  account_output     requires server confirmation",
      "$ result --await",
      "[wait] account response pending presentation...",
      "[wait] Awaiting verified claim result from store server...",
    ];
    let nextAt = 400;
    script.forEach((line, index) => {
      const beginAt = nextAt;
      nextAt += (TOTAL_DURATION_MS - 1400) / script.length + ((index % 4) - 1.5) * 70;
      const id = `shell-${index}`;
      const chunks = Math.ceil(line.length / 4);
      for (let chunk = 1; chunk <= chunks; chunk++) {
        const timer = setTimeout(() => {
          if (controller.signal.aborted) return;
          setCurrentStepText(line);
          const entry: LogEntry = { id, type: "output", text: line.slice(0, chunk * 4) };
          setLogs((previous) => {
            const position = previous.findIndex((item) => item.id === id);
            if (position === -1) return [...previous, entry];
            return previous.map((item) => item.id === id ? entry : item);
          });
        }, beginAt + chunk * (10 + index % 5));
        timeoutsRef.current.push(timer);
      }
    });

    // 4. Final Milestone at Exactly 41 Seconds (41000ms)
    const finalTimeout = setTimeout(async () => {
      if (controller.signal.aborted) return;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setLoadingProgress(100);
      setElapsedSeconds("41.0");

      try {
        const account = await apiPromise;
        if (!account || controller.signal.aborted) return;
        if ("failure" in account) throw new Error(account.failure);

        setLogs((p) => [
          ...p,
          {
            id: "kali-success-header",
            type: "success",
            text: `[OK] claim verified
            [+] account ready`,
          },
          {
            id: "account-card-" + Date.now(),
            type: "chatgpt-card",
            data: account,
          },
        ]);
      } catch (err) {
        if (controller.signal.aborted) return;
        const errMsg = err instanceof Error ? err.message : "Gagal memvalidasi kode lisensi.";
        setLogs((p) => [
          ...p,
          {
            id: "kali-fail-header",
            type: "error",
            text: `[FAIL] CLAIM FAILED (Total elapsed: 41.0s)
[-] Error: ${errMsg}
[-] Silakan periksa kembali kode lisensi Anda atau hubungi admin WhatsApp toko.`,
          },
        ]);
      } finally {
        if (!controller.signal.aborted) {
          setIsExecuting(false);
          requestRef.current = null;
        }
      }
    }, TOTAL_DURATION_MS);

    timeoutsRef.current.push(finalTimeout);
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

  // Screen 2: Real Kali Linux Terminal Screen
  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-full flex flex-col bg-[#070b0e] font-mono text-slate-200 select-text overflow-x-hidden">
      {/* Kali Linux Window Title Bar */}
      <header className="sticky top-0 z-30 flex h-11 shrink-0 items-center justify-between border-b border-[#1c2923] bg-[#091014]/95 backdrop-blur px-3 sm:px-4 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => router.push("/")}
              title="Tutup / Kembali ke Toko"
              className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ff5f56] transition hover:brightness-110 active:scale-90"
            >
              <X size={8} className="text-[#4a0002] opacity-0 hover:opacity-100" />
            </button>
            <button
              onClick={() => setLogs([])}
              title="Bersihkan Layar Terminal"
              className="flex h-3 w-3 items-center justify-center rounded-full bg-[#ffbd2e] transition hover:brightness-110 active:scale-90"
            >
              <Minus size={8} className="text-[#4a3200] opacity-0 hover:opacity-100" />
            </button>
          </div>

          <span className="ml-1 sm:ml-2 text-xs font-semibold text-slate-300 truncate flex items-center gap-1.5">
            <TerminalIcon size={13} className="text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-bold">root@kali:</span>
            <span className="text-slate-400 truncate">~/devtech-vault</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          <button
            onClick={() => {
              clearAllTimers();
              setIsExecuting(false);
              setLogs([]);
              setActiveCode("");
              setGateInput("");
              router.push("/claim");
            }}
            className="flex items-center gap-1 rounded bg-[#0d1712] border border-emerald-500/40 px-2.5 py-1 text-emerald-300 hover:bg-[#14261d] text-[11px] sm:text-xs transition active:scale-95"
          >
            <KeyRound size={12} />
            <span>Ganti Kode</span>
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1 rounded bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:bg-slate-700 text-[11px] sm:text-xs transition active:scale-95"
          >
            
            <span className="hidden sm:inline">Toko</span>
          </button>
        </div>
      </header>

      {/* Terminal Main Canvas */}
      <main className="flex-1 p-3 sm:p-5 text-[11px] sm:text-[13px] leading-relaxed text-slate-300 space-y-3 font-mono pb-16 max-w-full overflow-x-hidden">
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
                <span className="whitespace-pre-wrap text-[#5eafff]">{log.text}</span>
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
                        Akun ChatGPT Plus Private
                      </h4>

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
                    
                    <span>BUKA 2FA.LIVE (AMBIL KODE 6-DIGIT)</span>
                  </a>

                  <a
                    href="https://chatgpt.com/auth/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 active:scale-95 px-4 py-2.5 font-bold text-black transition text-xs"
                  >
                    <MessageSquare size={14} />
                    <span>BUKA CHATGPT.COM (LOGIN)</span>
                  </a>
                </div>

                <div className="rounded-lg bg-[#040806] border border-[#1b3124] p-3 text-[11px] leading-relaxed text-slate-300 space-y-1 font-mono">
                  <p className="text-emerald-300 font-semibold">Panduan Login:</p>
                  <p>1. Buka <b>chatgpt.com</b>, lalu login menggunakan <b>email dan password</b> akun di atas.</p>
                  <p>2. Lanjutkan sampai ChatGPT meminta <b>kode verifikasi OTP</b>.</p>
                  <p>3. Salin <b className="text-amber-300">2FA Secret Key</b> di atas, lalu buka <b className="text-amber-300">2fa.live</b>.</p>
                  <p>4. Tempel kunci tersebut ke kolom <b>2FA Secret</b>, lalu klik <b>Submit</b> untuk mendapatkan OTP 6 digit.</p>
                  <p>5. Kembali ke ChatGPT dan masukkan <b>OTP 6 digit</b> tersebut untuk menyelesaikan login ChatGPT Plus.</p>
                </div>
              </div>
            );
          }

          const shellColor = log.id.startsWith("shell-")
            ? log.text?.startsWith("$") ? "#5eafff"
              : log.text?.startsWith("[privacy]") || log.text?.startsWith("[wait]") ? "#e5c07b"
              : log.text?.startsWith("[ui]") ? "#98c379" : "#56b6c2"
            : undefined;
          return (
            <div key={log.id} style={{ color: shellColor }} className="text-slate-300 animate-in fade-in duration-150">
              <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">{log.text}</pre>
            </div>
          );
        })}

        {isExecuting ? (
          <div className="flex items-center gap-2 text-emerald-400 text-xs py-2 animate-pulse">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-mono"><span className="text-[#5eafff]">[~]</span> <span className="text-[#56b6c2]">claim:</span> <span className="text-slate-400">waiting</span></span>
            <span aria-hidden="true" className="inline-block motion-safe:animate-pulse text-emerald-300">▌</span>
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
                className="min-w-0 flex-1 bg-transparent font-mono text-base text-white placeholder-slate-600 outline-none border-none focus:ring-0"
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
        <div className="flex h-screen w-screen items-center justify-center bg-[#070b0e] font-mono text-emerald-400 text-sm">
          [+] Memuat Terminal Shell Kali Linux ChatGPT Plus...
        </div>
      }
    >
      <TerminalContent />
    </Suspense>
  );
}
