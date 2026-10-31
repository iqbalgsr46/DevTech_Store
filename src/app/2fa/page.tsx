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
  
  // Real Kali Linux 25-Second Animation States
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
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, isExecuting, loadingProgress]);

  // Master Kali Linux 25-Second Decryption Execution
  const handleClaim = async (passcode: string) => {
    const cleanCode = passcode.trim();
    if (!cleanCode) return;

    clearAllTimers();
    const controller = new AbortController();
    requestRef.current = controller;

    setIsExecuting(true);
    setLoadingProgress(0);
    setElapsedSeconds("0.0");
    setCurrentStepText("Inisialisasi modul kriptografi Kali Linux kernel...");
    setLogs([]);

    const TOTAL_DURATION_MS = 25000; // Exact 25 seconds duration requested
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
        throw err;
      });

    // 2. Kali Linux 25-Second Real-Time Smooth Counter & Spinner Interval (updates every 50ms)
    progressTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(TOTAL_DURATION_MS, now - startTime);
      const pct = Math.min(100, (elapsed / TOTAL_DURATION_MS) * 100);
      setLoadingProgress(Math.floor(pct));
      setElapsedSeconds((elapsed / 1000).toFixed(1));
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 50);

    // 3. Staggered Authentic Kali Linux Logs across the 25 Seconds
    const timeline = [
      {
        delay: 0,
        step: "Inisialisasi Kali Cryptographic Engine (Kernel 6.11.2-kali-amd64)...",
        action: () => {
          setLogs([
            {
              id: "kali-prompt-0",
              type: "command",
              text: "┌──(root㉿kali)-[~/devtech-vault]",
            },
            {
              id: "kali-prompt-cmd",
              type: "command",
              text: "└─# ./verify_license.sh --cipher=aes-256-gcm --fips=strict --target=chatgpt-plus",
            },
            {
              id: "log-k1",
              type: "output",
              text: "[  OK  ] Started Kali Linux Cryptographic Engine (Kernel 6.11.2-kali-amd64).",
            },
          ]);
        },
      },
      {
        delay: 1500,
        step: "Memeriksa akselerasi CPU hardware AES-NI & AVX-512...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k2",
              type: "output",
              text: `[  OK  ] Initializing OpenSSL 3.2.0 FIPS crypto provider.
[*] Hardware Acceleration: AVX-512, VAES, AES-NI [ACTIVE].`,
            },
          ]);
        },
      },
      {
        delay: 3500,
        step: "Membuat partisi volatile memory sandbox di /dev/shm...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k3",
              type: "output",
              text: `[*] Mounting ephemeral memory keyring at /dev/shm [mode=0700, nosuid]...
[  OK  ] Sandbox isolation established. CSPRNG entropy pool 4096-bit [ENTROPY_OK].`,
            },
          ]);
        },
      },
      {
        delay: 6000,
        step: "Membangun tunnel aman TLS 1.3 ke gateway klaster OpenAI...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k4",
              type: "output",
              text: `[*] Establishing TLS 1.3 socket to OpenAI Enterprise Shard Gateway (104.18.32.7:443)...
[  OK  ] TLS Handshake complete (Cipher: TLS_AES_256_GCM_SHA384, 0-RTT session resumed).`,
            },
          ]);
        },
      },
      {
        delay: 8500,
        step: "Menghubungi shard node zero-knowledge lintas benua...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k5",
              type: "output",
              text: `[*] Querying zero-knowledge distributed shard nodes...
[+] Shard Node #01 [Singapore / SG-1] : LATENCY 9ms  [SYNC_OK]
[+] Shard Node #02 [Tokyo / JP-2]     : LATENCY 18ms [SYNC_OK]
[+] Shard Node #03 [Frankfurt / DE-1] : LATENCY 74ms [SYNC_OK]`,
            },
          ]);
        },
      },
      {
        delay: 11000,
        step: "Memverifikasi kuorum kriptografi Shamir's Secret Sharing...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k6",
              type: "output",
              text: `[*] Verifying Shamir's threshold quorum (2-of-3 quorum established)...
[  OK  ] Cryptographic quorum verified. Authorization token validated.`,
            },
          ]);
        },
      },
      {
        delay: 13500,
        step: "Membuka katalog model AI ChatGPT Plus & 6.1 Sol Max...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k7",
              type: "output",
              text: `[*] Checking ChatGPT Plus Account Entitlements & Permissions...
[+] Plan Detected : Dedicated ChatGPT Plus (Private 1-User License)
[+] Unlocking All OpenAI Intelligence Models:
    ├── GPT-4o Multimodal (Omni 128k context, Vision + Audio) .. [UNLOCKED]
    ├── GPT-4o mini (Ultra low-latency coding & analysis) ..... [UNLOCKED]
    ├── OpenAI o1 & o1-pro (Deep Chain-of-Thought Reasoning) ... [UNLOCKED]
    ├── OpenAI o3-mini (Next-Gen High Speed Reasoning) ......... [UNLOCKED]
    └── 6.1 Sol Max (Experimental Multi-Agent Super-Reasoning) . [UNLOCKED]`,
            },
          ]);
        },
      },
      {
        delay: 17000,
        step: "Memverifikasi fitur eksklusif Plus (Voice, DALL-E, Canvas, Deep Research)...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k8",
              type: "output",
              text: `[*] Probing OpenAI Feature Flags & Active Capabilities:
    ├── Advanced Voice Mode (Continuous low-latency audio) [ACTIVE]
    ├── DALL-E 3 Ultra HD Image Generation ................ [ACTIVE]
    ├── Canvas Interactive Workspace (Code & Document) .... [ACTIVE]
    └── Deep Research Autonomous Agent (Deep Web Analysis)  [ACTIVE]`,
            },
          ]);
        },
      },
      {
        delay: 19800,
        step: "Menurunkan kunci simetris AES-256-GCM via HKDF-SHA256...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k9",
              type: "output",
              text: `[*] Deriving AES-256-GCM symmetric decryption key from HKDF-SHA256...
[DEBUG] PRK: 4a9f...c812 | OKM: 256-bit AES-GCM Key Vector
[DEBUG] Nonce: 96-bit Galois counter initialized. Digest verified against Firestore.`,
            },
          ]);
        },
      },
      {
        delay: 22000,
        step: "Mendekripsi data kredensial akun dari vault terenkripsi...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k10",
              type: "output",
              text: `[*] Decrypting encrypted credentials block from zero-knowledge vault...
[########################################] 100% AES-256-GCM Decrypted.`,
            },
          ]);
        },
      },
      {
        delay: 23600,
        step: "Sinkronisasi vektor seed TOTP RFC 6238 dengan NTP Stratum-1...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k11",
              type: "output",
              text: `[*] Synchronizing RFC 6238 TOTP seed vector with global NTP stratum 1...
[  OK  ] 2FA seed confirmed. Base32 secret ready for 2fa.live.`,
            },
          ]);
        },
      },
      {
        delay: 24500,
        step: "Sanitasi register memori dan pembersihan artefak forensik...",
        action: () => {
          setLogs((p) => [
            ...p,
            {
              id: "log-k12",
              type: "output",
              text: `[*] Zeroing ephemeral memory buffers in /dev/shm... [DONE]
[  OK  ] Memory registers sanitized. Anti-forensic hygiene complete.`,
            },
          ]);
        },
      },
    ];

    timeline.forEach((item) => {
      const timeout = setTimeout(() => {
        if (controller.signal.aborted) return;
        setCurrentStepText(item.step);
        item.action();
      }, item.delay);
      timeoutsRef.current.push(timeout);
    });

    // 4. Final Milestone at Exactly 25 Seconds (25000ms)
    const finalTimeout = setTimeout(async () => {
      if (controller.signal.aborted) return;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setLoadingProgress(100);
      setElapsedSeconds("25.0");

      try {
        const account = await apiPromise;
        if (!account) return;

        setLogs((p) => [
          ...p,
          {
            id: "kali-success-header",
            type: "success",
            text: `[  OK  ] DECRYPTION COMPLETE (25.0s). ALL OPENAI PLUS CAPABILITIES ACTIVATED!
[+] Membuka vault akun ChatGPT Plus Private:`,
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
            text: `[FAIL] DECRYPTION FAILED (Total elapsed: 25.0s)
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

    const cmdEntryId = "user-cmd-" + Date.now();
    setLogs((prev) => [
      ...prev,
      {
        id: cmdEntryId,
        type: "command",
        text: `┌──(root㉿kali)-[~]
└─# ${trimmed}`,
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
            text: `Daftar Perintah Shell Kali DevTech Terminal:
  • claim <KODE>      : Dekripsi lisensi akun ChatGPT Plus (loading 25 detik)
  • 2fa               : Buka website https://2fa.live/ di browser tab baru
  • 2fa <SECRET>      : Generate kode 6-digit TOTP langsung di konsol ini
  • login / chatgpt   : Buka portal login resmi https://chatgpt.com
  • models            : Tampilkan daftar model AI (GPT-4o, o1, o3-mini, 6.1 Sol Max)
  • guide / panduan   : Panduan cara login menggunakan 2fa.live
  • clear             : Bersihkan riwayat tampilan terminal
  • store / exit      : Kembali ke toko utama DevTech AI Store`,
          },
        ]);
        break;

      case "clear":
      case "cls":
        setLogs([]);
        break;

      case "models":
        setLogs((prev) => [
          ...prev,
          {
            id: "models-" + Date.now(),
            type: "box",
            text: `========================================================================
KATALOG MODEL AI CHATGPT PLUS (UNLOCKED FULL TIER):
  1. 6.1 Sol Max    : Multi-agent reasoning tier tertinggi untuk logika kompleks
  2. OpenAI o1 / pro: Penalaran mendalam chain-of-thought (matematika & coding)
  3. OpenAI o3-mini : Model reasoning kecepatan ultra tinggi untuk programming
  4. GPT-4o / mini  : Flagship omni multimodal (analisis gambar, suara, file)
========================================================================`,
          },
        ]);
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
        break;

      case "claim":
        if (!arg) {
          setLogs((prev) => [
            ...prev,
            {
              id: "claim-err-" + Date.now(),
              type: "error",
              text: "[-] Format salah. Gunakan: claim <KODE_LISENSI>",
            },
          ]);
        } else {
          setActiveCode(arg.trim());
          void handleClaim(arg.trim());
        }
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
          return;
        }

        const otp = await generateTotp(arg);
        if (otp === "INVALID_KEY" || otp === "ERROR") {
          setLogs((prev) => [
            ...prev,
            {
              id: "2fa-err-" + Date.now(),
              type: "error",
              text: "[-] Kunci 2FA tidak valid. Pastikan format Base32 sudah benar.",
            },
          ]);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              id: "2fa-res-" + Date.now(),
              type: "success",
              text: `[+] KODE VERIFIKASI OTP 6 DIGIT: [ ${otp} ] (Berlaku 30 detik)`,
            },
          ]);
        }
        break;

      case "login":
      case "chatgpt":
        window.open("https://chatgpt.com/auth/login", "_blank", "noopener,noreferrer");
        setLogs((prev) => [
          ...prev,
          {
            id: "login-" + Date.now(),
            type: "success",
            text: "[+] Membuka halaman login resmi https://chatgpt.com/auth/login di tab baru...",
          },
        ]);
        break;

      case "store":
      case "exit":
        router.push("/");
        break;

      default:
        // Direct passcode entry fallback
        if (command.length >= 6) {
          setActiveCode(command);
          void handleClaim(command);
        } else {
          setLogs((prev) => [
            ...prev,
            {
              id: "unknown-" + Date.now(),
              type: "error",
              text: `[-] Perintah '${command}' tidak dikenali. Ketik 'help' untuk daftar perintah atau masukkan kode klaim.`,
            },
          ]);
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

  // Screen 1: Gate Screen (Code Entry Form)
  if (!activeCode) {
    return (
      <div className="min-h-dvh bg-[#070b0e] text-[#edf3ef] flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
        <header className="min-h-16 border-b border-[#1c2923] px-4 sm:px-8 flex items-center justify-between gap-3 shrink-0 bg-[#070b0e]/95 backdrop-blur">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image src="/devtech-navbar.jpg" alt="Logo DevTech" width={36} height={36} className="rounded-xl object-cover shrink-0 border border-[#2b4234]" />
            <div>
              <span className="font-bold text-[13px] sm:text-sm block text-white">DevTech Store</span>
              <span className="text-[10px] text-emerald-400 font-mono tracking-widest font-semibold">TERMINAL DEKRIPSI KALI</span>
            </div>
          </Link>
          <Link href="/" className="min-h-10 flex items-center gap-1.5 text-xs text-slate-300 shrink-0 px-3 border border-[#27382f] bg-[#0c1410] hover:bg-[#13221b] rounded-lg transition">
            <ArrowLeft size={14} /> Toko
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
          <section className="w-full max-w-lg min-w-0 bg-[#0f171d] border border-[#23352b] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-black/80">
            {/* Terminal Window Header */}
            <div className="h-11 bg-[#091014] border-b border-[#23352b] px-4 sm:px-5 flex items-center justify-between gap-3 font-mono text-[11px]">
              <span className="flex items-center gap-2 text-slate-300">
                <TerminalIcon size={14} className="text-emerald-400" />
                root@kali:~/devtech-vault
              </span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                READY TO UNSEAL
              </span>
            </div>

            <div className="p-4 sm:p-7 space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-semibold">
                  <Sparkles size={11} className="text-emerald-400" />
                  CHATGPT PLUS PRIVATE DECRYPTION
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  Buka Terminal Lisensi
                </h1>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-300">
                  Masukkan kode lisensi dari admin WhatsApp. Sistem Kali Linux akan mendekripsi dan memverifikasi akun Anda selama 25 detik secara otomatis.
                </p>
              </div>

              {/* Form Input */}
              <form onSubmit={handleGateSubmit} className="space-y-3">
                <label htmlFor="claim-code" className="block text-xs font-semibold text-slate-300">
                  Kode Lisensi Rahasia Klaim
                </label>
                <div className="flex items-center gap-2.5 bg-[#070b0e] border border-[#2b3f33] focus-within:border-emerald-400 rounded-xl px-3.5 min-h-[50px] transition">
                  <span aria-hidden="true" className="text-emerald-400 font-mono text-sm font-bold shrink-0">&gt;_</span>
                  <input
                    id="claim-code"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={gateInput}
                    onChange={(e) => {
                      setGateInput(e.target.value);
                      if (gateError) setGateError(null);
                    }}
                    placeholder="Contoh: devtech-XXXX-XXXX"
                    aria-invalid={!!gateError}
                    aria-describedby={gateError ? "claim-error" : undefined}
                    className="w-full min-w-0 bg-transparent text-white font-mono text-sm sm:text-base outline-none placeholder:text-slate-500"
                  />
                </div>
                {gateError && (
                  <p id="claim-error" role="alert" className="text-rose-400 text-xs leading-5">
                    {gateError}
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 hover:brightness-110 text-[#041a10] font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] shadow-lg shadow-emerald-500/20"
                >
                  <TerminalIcon size={16} />
                  <span>Mulai Dekripsi Lisensi (Kali Engine)</span>
                  <span aria-hidden="true">&rarr;</span>
                </button>
              </form>

              {/* Specs & Features Unlocked Badge */}
              <div className="rounded-xl bg-[#091014] border border-[#21352b] p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px] font-mono">
                  <Flame size={13} />
                  <span>SPESIFIKASI AKUN YANG DI-DEKRIPSI:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">&#10003;</span>
                    <span>Model: <b>GPT-4o, o1, o3-mini, 6.1 Sol Max</b></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">&#10003;</span>
                    <span>Fitur: <b>Advanced Voice & DALL-E 3 HD</b></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">&#10003;</span>
                    <span>Ruang Kerja: <b>Canvas & Deep Research</b></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 font-bold">&#10003;</span>
                    <span>Hak Milik: <b>100% Private (1 Pengguna)</b></span>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#21352b] pt-4 space-y-2 text-[11px] sm:text-xs leading-relaxed text-slate-400">
                <p>Detail akun mencakup <span className="text-white font-semibold">Email ChatGPT, Password, dan 2FA Secret Key.</span></p>
                <p>Gunakan kunci 2FA di <span className="text-emerald-300 font-mono">2fa.live</span> untuk memperoleh kode OTP 6-digit login.</p>
              </div>
            </div>

            <footer className="border-t border-[#23352b] bg-[#091014] px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
              <span className="text-slate-400">Belum memiliki kode lisensi?</span>
              <Link href="/" className="inline-flex items-center text-emerald-400 font-bold hover:underline">
                Pesan via WhatsApp &rarr;
              </Link>
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
            <ArrowLeft size={12} />
            <span className="hidden sm:inline">Toko</span>
          </button>
        </div>
      </header>

      {/* Terminal Main Canvas */}
      <main className="flex-1 p-3 sm:p-5 text-[11px] sm:text-[13px] leading-relaxed text-slate-300 space-y-3 font-mono pb-16 max-w-full overflow-x-hidden">
        {/* Dynamic Kali Linux 25-Second HUD Box */}
        {isExecuting && (
          <div className="bg-[#0b1411] border border-emerald-500/50 rounded-xl p-3 sm:p-4 my-2 shadow-2xl shadow-emerald-950/60 transition duration-300">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between text-[10px] sm:text-xs gap-1 pb-2 border-b border-emerald-500/20 text-emerald-400">
              <span className="font-bold flex items-center gap-1.5">
                <span className="text-emerald-300 font-mono">{SPINNER_FRAMES[spinnerIndex]}</span>
                KALI CRYPTOGRAPHIC DECRYPTOR
              </span>
              <span className="text-slate-400 font-mono text-[10px] sm:text-[11px]">
                AES-256-GCM &bull; FIPS STRICT
              </span>
            </div>

            {/* Dynamic Real-Time Visual Progress Bar */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] sm:text-xs font-mono">
                <span className="text-white font-bold">
                  PROGRESS [{loadingProgress}%]
                </span>
                <span className="text-emerald-400 font-bold font-mono">
                  {elapsedSeconds}s / 25.0s
                </span>
              </div>

              <div className="w-full bg-[#040806] border border-emerald-500/40 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 h-full rounded-full transition-all duration-75 ease-linear shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>

              {/* Real-time Subsystem stage display */}
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-400 pt-1">
                <span className="truncate text-emerald-300">
                  &gt; {currentStepText}
                </span>
                <span className="shrink-0 text-amber-400 font-bold font-mono pl-2 animate-pulse">
                  DECRYPTING...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Logs Stream */}
        {logs.map((log) => {
          if (log.type === "command") {
            return (
              <div key={log.id} className="text-emerald-400 font-semibold pt-1">
                <pre className="whitespace-pre-wrap font-mono text-[11px] sm:text-xs">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "error") {
            return (
              <div key={log.id} className="rounded-xl border border-red-500/40 bg-red-950/25 p-3 text-red-300 my-2">
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "box") {
            return (
              <div key={log.id} className="rounded-xl border border-teal-500/40 bg-[#091518] p-3 text-teal-200 my-2 overflow-x-auto">
                <pre className="whitespace-pre-wrap font-mono text-[11px] sm:text-xs leading-5">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "success") {
            return (
              <div key={log.id} className="rounded-xl border border-emerald-500/50 bg-emerald-950/30 p-3 text-emerald-300 my-2">
                <pre className="whitespace-pre-wrap font-mono text-xs sm:text-sm">{log.text}</pre>
              </div>
            );
          }

          if (log.type === "chatgpt-card" && log.data) {
            const { email, password, secret2fa } = log.data;
            return (
              <div
                key={log.id}
                className="my-3 rounded-2xl border-2 border-emerald-500/90 bg-[#07110c] p-4 sm:p-6 shadow-2xl shadow-emerald-950/80 space-y-4 max-w-full overflow-hidden animate-in fade-in zoom-in duration-300"
              >
                {/* Card Title & Badges */}
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-500/30 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400 text-black font-black text-sm shrink-0">
                      &#10003;
                    </span>
                    <div>
                      <h4 className="font-extrabold text-white text-sm sm:text-base leading-tight">
                        Akun ChatGPT Plus Private (Hak Milik Penuh)
                      </h4>
                      <p className="text-[11px] text-emerald-400 font-mono mt-0.5">
                        Status: <span className="text-white font-bold">Resmi Aktif Bergaransi 30 Hari</span>
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-300 bg-emerald-950/90 border border-emerald-500/60 rounded-md px-2.5 py-1">
                    ● DEDICATED 1 PENGGUNA
                  </span>
                </div>

                {/* Unlocked Model Tier Notification Banner */}
                <div className="rounded-xl bg-gradient-to-r from-[#0c2217] via-[#091a12] to-[#0c2217] border border-emerald-500/50 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <Sparkles size={14} className="text-emerald-400" />
                    <span>UNLOCKED MODEL TIER:</span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-white leading-relaxed">
                    Akses <b>GPT-4o, OpenAI o1, o1-pro, o3-mini, hingga 6.1 Sol Max</b>. Termasuk <b>Advanced Voice Mode</b>, <b>DALL-E 3 HD</b>, <b>Canvas</b>, dan <b>Deep Research</b>.
                  </p>
                </div>

                {/* Credentials Boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Email */}
                  <div className="rounded-xl bg-[#040906] p-3 border border-[#1b3425] space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] tracking-wider uppercase font-mono">
                      EMAIL AKUN CHATGPT:
                    </span>
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-emerald-300 font-bold font-mono select-all truncate text-xs sm:text-[13px]">
                        {email}
                      </span>
                      <button
                        onClick={() => handleCopy(email, log.id + "-email")}
                        className="rounded-lg bg-[#142a1e] hover:bg-[#1e3e2c] text-white px-2.5 py-1 transition shrink-0 flex items-center gap-1 text-[11px] active:scale-95"
                      >
                        {copiedId === log.id + "-email" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedId === log.id + "-email" ? "Disalin!" : "Salin"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Password */}
                  <div className="rounded-xl bg-[#040906] p-3 border border-[#1b3425] space-y-1">
                    <span className="text-slate-400 font-bold block text-[10px] tracking-wider uppercase font-mono">
                      PASSWORD AKUN:
                    </span>
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <span className="text-emerald-300 font-bold font-mono select-all truncate text-xs sm:text-[13px]">
                        {password}
                      </span>
                      <button
                        onClick={() => handleCopy(password, log.id + "-pass")}
                        className="rounded-lg bg-[#142a1e] hover:bg-[#1e3e2c] text-white px-2.5 py-1 transition shrink-0 flex items-center gap-1 text-[11px] active:scale-95"
                      >
                        {copiedId === log.id + "-pass" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                        <span>{copiedId === log.id + "-pass" ? "Disalin!" : "Salin"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2FA Secret Key Box */}
                <div className="rounded-xl border border-amber-500/50 bg-[#141006] p-3 sm:p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                      <KeyRound size={14} className="shrink-0" />
                      <span>KUNCI 2FA SECRET (Base32):</span>
                    </div>
                    <span className="text-[10px] text-amber-400 font-mono">Buka di https://2fa.live</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-black/90 rounded-lg p-2.5 border border-amber-500/30 min-w-0">
                    <span className="text-amber-200 font-mono font-black text-xs sm:text-sm tracking-wider select-all truncate">
                      {secret2fa}
                    </span>
                    <button
                      onClick={() => handleCopy(secret2fa, log.id + "-2fa")}
                      className="rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold px-3 py-1.5 transition shrink-0 flex items-center gap-1 text-xs active:scale-95"
                    >
                      {copiedId === log.id + "-2fa" ? <Check size={12} className="text-black" /> : <Copy size={12} />}
                      <span>{copiedId === log.id + "-2fa" ? "Tersalin!" : "Salin 2FA"}</span>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <a
                    href="https://2fa.live/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-3 font-extrabold text-black transition text-xs shadow-md"
                  >
                    <ExternalLink size={14} />
                    <span>BUKA 2FA.LIVE (KODE OTP 6-DIGIT) &#8599;</span>
                  </a>

                  <a
                    href="https://chatgpt.com/auth/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 px-4 py-3 font-extrabold text-black transition text-xs shadow-md"
                  >
                    <MessageSquare size={14} />
                    <span>BUKA CHATGPT.COM (LOGIN RESMI) &#8599;</span>
                  </a>
                </div>

                {/* Panduan Login Lengkap */}
                <div className="rounded-xl bg-[#040806] border border-[#1b3425] p-3.5 text-[11px] leading-relaxed text-slate-300 space-y-1.5 font-mono">
                  <p className="text-emerald-300 font-bold">Panduan Login & Hak Milik Penuh:</p>
                  <p>1. Salin <b className="text-amber-300">Kunci 2FA Secret</b> di atas.</p>
                  <p>2. Buka <b className="text-amber-300">2fa.live</b> &rarr; tempelkan ke kolom &apos;2FA Secret&apos; &rarr; klik tombol &apos;Submit&apos;.</p>
                  <p>3. Ambil 6 digit angka kode verifikasi dan masukkan ke form login ChatGPT.</p>
                  <p className="text-emerald-400 font-semibold">4. Akun 100% private milik Anda sendiri: Silakan ubah password dan email pemulihan sesuai keinginan Anda setelah login.</p>
                </div>
              </div>
            );
          }

          return (
            <div key={log.id} className="text-slate-300 animate-in fade-in duration-150">
              <pre className="whitespace-pre-wrap font-mono text-[11px] sm:text-xs leading-relaxed">{log.text}</pre>
            </div>
          );
        })}

        {/* Input Prompt when idle */}
        {!isExecuting && (
          <div className="pt-3 border-t border-[#1c2923]">
            <div className="text-emerald-400 text-xs select-none">┌──(root㉿kali)-[~]</div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-xs select-none font-bold">└─#</span>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ketik 'help', 'models', atau masukkan kode baru..."
                className="flex-1 bg-transparent font-mono text-sm sm:text-base text-white placeholder-slate-600 outline-none border-none focus:ring-0"
                spellCheck={false}
                autoComplete="off"
              />
              {inputVal && (
                <button
                  onClick={() => handleExecute(inputVal)}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1 text-xs font-bold transition active:scale-95"
                >
                  <Send size={12} />
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
