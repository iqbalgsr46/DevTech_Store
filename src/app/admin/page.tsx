"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";
import {
  Shield,
  Key,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogOut,
  Home,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Search,
  PlusCircle,
  Database,
  Edit2,
  Trash2,
  X,
  DollarSign,
  Tag,
  AlertCircle,
  Clock,
} from "lucide-react";

interface AccountItem {
  hash: string;
  code: string;
  email: string;
  password: string;
  secret2fa: string;
  createdAt: number;
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active Tab: "inventory" | "create" | "pricing"
  const [activeTab, setActiveTab] = useState<"inventory" | "create" | "pricing">("inventory");

  // Pricing settings state
  const [currentPricing, setCurrentPricing] = useState<{ price: number; originalPrice: number; updatedAt: number }>(() => ({
    price: 75000,
    originalPrice: 150000,
    updatedAt: 0,
  }));
  const [inputPrice, setInputPrice] = useState<string>("75000");
  const [inputOriginalPrice, setInputOriginalPrice] = useState<string>("150000");
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSuccess, setPricingSuccess] = useState(false);
  const [pricingError, setPricingError] = useState("");

  // Form input states (CREATE)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret2fa, setSecret2fa] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [show2fa, setShow2fa] = useState(false);

  // Submission states
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Accounts list state (READ)
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedAccountField, setCopiedAccountField] = useState<string | null>(null);

  // Edit Modal State (UPDATE)
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editSecret2fa, setEditSecret2fa] = useState("");
  const [editShowPassword, setEditShowPassword] = useState(false);
  const [editUpdating, setEditUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Dialog State (DELETE)
  const [deletingAccount, setDeletingAccount] = useState<AccountItem | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");



  const getAuthToken = async () => {
    if (!auth.currentUser) throw new Error("Silakan masuk melalui Firebase.");
    return auth.currentUser.getIdToken();
  };

  const parseJsonResponse = async (res: Response, fallbackError: string) => {
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      if (res.status === 404) throw new Error("Endpoint API tidak ditemukan (404). Pastikan server berjalan dengan benar.");
      if (res.status === 503) throw new Error("Layanan klaim belum tersedia (503). Periksa konfigurasi environment server.");
      if (res.status === 401) throw new Error("Sesi login admin tidak valid atau telah kedaluwarsa. Silakan login ulang.");
      if (res.status === 403) throw new Error("Akses ditolak (403). Akun Anda belum terdaftar di daftar admin (CLAIM_ADMIN_UIDS).");
      throw new Error(`Server merespons status ${res.status}: ${text.slice(0, 80) || fallbackError}`);
    }
    try {
      return await res.json();
    } catch {
      throw new Error(fallbackError);
    }
  };

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const token = await getAuthToken();
      const res = await fetch("/api/claims", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await parseJsonResponse(res, "Gagal memuat akun dari server.");
      if (!res.ok || !Array.isArray(data.accounts)) throw new Error(data?.error || "Gagal memuat akun.");
      if (auth.currentUser) setAccounts(data.accounts);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal memuat akun.");
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const fetchPricing = useCallback(async () => {
    setPricingLoading(true);
    setPricingError("");
    try {
      const res = await fetch("/api/pricing", { cache: "no-store" });
      const data = await res.json();
      if (data?.pricing?.price) {
        setCurrentPricing(data.pricing);
        setInputPrice(String(data.pricing.price));
        setInputOriginalPrice(String(data.pricing.originalPrice || data.pricing.price * 2));
      }
    } catch {
      setPricingError("Gagal mengambil data harga dari server.");
    } finally {
      setPricingLoading(false);
    }
  }, []);

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingSaving(true);
    setPricingSuccess(false);
    setPricingError("");

    try {
      const token = await getAuthToken();
      const p = parseInt(inputPrice, 10);
      const op = parseInt(inputOriginalPrice, 10);

      if (isNaN(p) || p <= 0) {
        throw new Error("Nominal harga jual harus berupa angka valid.");
      }

      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ price: p, originalPrice: isNaN(op) ? undefined : op }),
      });

      const data = await parseJsonResponse(res, "Gagal memperbarui harga toko.");
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui harga toko.");
      }

      setCurrentPricing(data.pricing);
      setPricingSuccess(true);
      setTimeout(() => setPricingSuccess(false), 4000);
    } catch (err: unknown) {
      setPricingError(err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan harga.");
    } finally {
      setPricingSaving(false);
    }
  };

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setAuthLoading(false);
    setAccounts([]);
    setGeneratedCode("");
    setEditingAccount(null);
    setDeletingAccount(null);
    if (u) {
      void fetchAccounts();
      void fetchPricing();
    }
  }), [fetchAccounts, fetchPricing]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch {
      setLoginError("Login Firebase gagal. Periksa email, password, dan koneksi Anda.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setGeneratedCode("");

    try {
      const token = await getAuthToken();
      const clean2fa = secret2fa.replace(/\s/g, "").toUpperCase();

      const response = await fetch("/api/claims", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "create",
          account: {
            email: email.trim(),
            password: password,
            secret2fa: clean2fa,
          },
        }),
      });

      const result = await parseJsonResponse(response, "Gagal menyimpan akun.");
      if (!response.ok) {
        throw new Error(result.error || "Gagal menyimpan akun.");
      }

      setGeneratedCode(result.code);
      setEmail("");
      setPassword("");
      setSecret2fa("");
      void fetchAccounts();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan akun."
      );
    } finally {
      setSaving(false);
    }
  };

  // U - UPDATE Account
  const openEditModal = (acc: AccountItem) => {
    setEditingAccount(acc);
    setEditEmail(acc.email);
    setEditPassword(acc.password);
    setEditSecret2fa(acc.secret2fa);
    setEditError("");
    setEditShowPassword(false);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditUpdating(true);
    setEditError("");

    try {
      const token = await getAuthToken();
      const clean2fa = editSecret2fa.replace(/\s/g, "").toUpperCase();

      const res = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "update",
          hash: editingAccount.hash,
          account: {
            email: editEmail.trim(),
            password: editPassword,
            secret2fa: clean2fa,
          },
        }),
      });

      const data = await parseJsonResponse(res, "Gagal memperbarui akun.");
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui akun.");
      }

      setEditingAccount(null);
      void fetchAccounts();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Gagal memperbarui akun.");
    } finally {
      setEditUpdating(false);
    }
  };

  // D - DELETE Account
  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    setDeletingLoading(true);
    setDeleteError("");

    try {
      const token = await getAuthToken();
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "delete",
          hash: deletingAccount.hash,
        }),
      });

      const data = await parseJsonResponse(res, "Gagal menghapus akun.");
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus akun.");
      }

      setDeletingAccount(null);
      void fetchAccounts();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus akun.");
    } finally {
      setDeletingLoading(false);
    }
  };

  // Filter accounts by search query
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const q = searchQuery.toLowerCase().trim();
    return accounts.filter(
      (acc) =>
        acc.email.toLowerCase().includes(q) ||
        (acc.code && acc.code.toLowerCase().includes(q)) ||
        (acc.secret2fa && acc.secret2fa.toLowerCase().includes(q))
    );
  }, [accounts, searchQuery]);



  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070b0e] text-slate-300 flex flex-col items-center justify-center gap-3">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
        <p className="text-slate-400 text-sm font-mono">Memuat Sistem Admin...</p>
      </div>
    );
  }

  // Not logged in -> Show Login form
  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b0e] text-slate-200 flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-[#0c1218] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-emerald-400">
              <Shield size={28} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Admin Portal</h1>
            <p className="text-slate-400 text-xs mt-1">DevTech AI Store • ChatGPT Plus</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Email Admin
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 bg-[#080d12] border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
                placeholder="admin@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#080d12] border border-slate-700 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
                placeholder="••••••••"
                required
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              {loginLoading ? <Loader2 size={16} className="animate-spin" /> : null}
              Masuk Dashboard
            </button>
          </form>

          <Link
                      href="/"
            className="flex items-center justify-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs mt-6 transition-colors"
          >
            <Home size={12} /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const claimMessageTemplate = generatedCode
    ? `*PESANAN CHATGPT PLUS PRIVATE ANDA TELAH SIAP!*\n──────────────────────────\nTerima kasih telah berbelanja di DevTech AI Store.\n\nBerikut kode klaim lisensi akun ChatGPT Plus Private Anda:\n\n🔑 *KODE KLAIM:* \`${generatedCode}\`\n\n──────────────────────────\n*Cara Klaim Akun & Kode OTP:*\n1. Buka halaman klaim kami di: ${window.location.origin}/claim\n2. Masukkan kode lisensi di atas pada terminal.\n3. Salin Email, Password, dan Kunci 2FA akun Anda.\n4. Buka https://2fa.live/ untuk mendapatkan 6-digit kode verifikasi login ke https://chatgpt.com.\n\n_Akun private dengan password yang bisa Anda ganti._`
    : "";

  return (
    <div className="min-h-screen bg-[#070b0e] text-slate-200">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0a0f14]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
              DT
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                DevTech Admin <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">ChatGPT Plus</span>
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/claim"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <span>Buka /claim</span>
              <ExternalLink size={12} />
            </a>
            <button
              onClick={() => {
                void signOut(auth).catch(() => setErrorMessage("Gagal keluar. Silakan coba lagi."));
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/50 border border-red-900/40 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut size={13} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
        {/* Navigation Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              {activeTab === "inventory" ? (
                <>
                  <Database size={24} className="text-emerald-400" />
                  Daftar Akun Tersimpan
                </>
              ) : activeTab === "create" ? (
                <>
                  <PlusCircle size={24} className="text-emerald-400" />
                  Tambah Akun Baru
                </>
              ) : (
                <>
                  <Tag size={24} className="text-emerald-400" />
                  Pengaturan Harga Produk
                </>
              )}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {activeTab === "inventory"
                ? "Kelola semua akun ChatGPT Plus Private (Lihat, Edit, Hapus, dan Salin Kode Klaim)."
                : activeTab === "create"
                ? "Masukkan kredensial akun baru untuk dienkripsi permanen dan di-generate kode klaim."
                : "Ubah harga jual produk ChatGPT Plus yang langsung tampil realtime di halaman checkout pembeli."}
            </p>
          </div>

          {/* Tab Switcher Buttons */}
          <div className="flex items-center p-1 bg-[#0b1016] border border-slate-800 rounded-xl self-start sm:self-auto flex-wrap gap-1">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "inventory"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Database size={14} />
              <span>Daftar Akun</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === "inventory"
                    ? "bg-white/20 text-white"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {accounts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("create")}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "create"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <PlusCircle size={14} />
              <span>Tambah Akun</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("pricing");
                void fetchPricing();
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "pricing"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <DollarSign size={14} />
              <span>Atur Harga</span>
              <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                Rp {currentPricing.price.toLocaleString("id-ID")}
              </span>
            </button>
          </div>
        </div>

        {/* TAB 1: DAFTAR AKUN TERSIMPAN (READ + CRUD Actions) */}
        {activeTab === "inventory" && (
          <div className="space-y-6">
            {/* Search and Action Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0b1016] border border-slate-800 p-3 sm:p-4 rounded-xl">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari berdasarkan email, kode klaim, atau 2FA key..."
                  className="w-full pl-9 pr-4 py-2 bg-[#070b0e] border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchAccounts}
                  disabled={loadingAccounts}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0e161c] hover:bg-[#152028] border border-slate-800 hover:border-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw
                    size={13}
                    className={loadingAccounts ? "animate-spin text-emerald-400" : ""}
                  />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => setActiveTab("create")}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-950/40"
                >
                  <PlusCircle size={14} />
                  <span>Tambah Baru</span>
                </button>
              </div>
            </div>

            {errorMessage && <p role="alert" className="text-sm text-red-400">{errorMessage}</p>}
            {/* List / Table of Accounts */}
            {loadingAccounts && accounts.length === 0 ? (
              <div className="bg-[#0b1016] border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs font-mono">
                <Loader2 size={24} className="animate-spin text-emerald-400 mx-auto mb-3" />
                Memuat data akun dari database terenkripsi...
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="bg-[#0b1016] border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <Database size={22} />
                </div>
                <h3 className="text-white font-semibold text-sm">
                  {searchQuery ? "Tidak ada akun yang cocok" : "Belum ada akun tersimpan"}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery
                    ? "Coba gunakan kata kunci pencarian yang lain."
                    : "Klik tombol 'Tambah Baru' di atas untuk menyimpan akun ChatGPT Plus Private pertama."}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab("create")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <PlusCircle size={14} />
                    <span>Tambah Akun Baru</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredAccounts.map((acc, idx) => {
                  const dateStr = new Date(acc.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={acc.hash || idx}
                      className="bg-[#0b1016] border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 sm:p-5 transition-all shadow-lg space-y-3.5"
                    >
                      {/* Card Header: Index, Email, Date, Action Buttons (Edit, Delete) */}
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-bold flex items-center justify-center font-mono border border-emerald-500/20">
                            {idx + 1}
                          </span>
                          <span className="text-white font-mono text-sm sm:text-base font-semibold select-all">
                            {acc.email}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mr-2">
                            <Clock size={11} /> {dateStr}
                          </span>
                          {/* Edit Button */}
                          <button
                            onClick={() => openEditModal(acc)}
                            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-[#0e161c] hover:bg-[#152028] border border-slate-800 hover:border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Edit data akun ini"
                          >
                            <Edit2 size={12} className="text-blue-400" />
                            <span>Edit</span>
                          </button>
                          {/* Delete Button */}
                          <button
                            onClick={() => {
                              setDeletingAccount(acc);
                              setDeleteError("");
                            }}
                            className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/30 hover:border-red-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            title="Hapus akun dari database"
                          >
                            <Trash2 size={12} />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>

                      {/* Card Content: Password & 2FA Key */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-[#070b0e] border border-slate-800/80 rounded-lg p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block mb-0.5">
                              Password
                            </span>
                            <span className="text-slate-200 font-mono font-semibold truncate block select-all">
                              {acc.password}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(acc.password);
                              setCopiedAccountField(`${idx}-pass`);
                              setTimeout(() => setCopiedAccountField(null), 1500);
                            }}
                            className="text-[11px] text-slate-400 hover:text-emerald-400 p-1.5 rounded bg-slate-900 border border-slate-800 shrink-0 cursor-pointer"
                            title="Salin password"
                          >
                            {copiedAccountField === `${idx}-pass` ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>

                        <div className="bg-[#070b0e] border border-slate-800/80 rounded-lg p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block mb-0.5">
                              2FA Secret (Base32)
                            </span>
                            <span className="text-amber-300 font-mono font-semibold truncate block select-all text-xs">
                              {acc.secret2fa}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(acc.secret2fa);
                              setCopiedAccountField(`${idx}-2fa`);
                              setTimeout(() => setCopiedAccountField(null), 1500);
                            }}
                            className="text-[11px] text-slate-400 hover:text-amber-400 p-1.5 rounded bg-slate-900 border border-slate-800 shrink-0 cursor-pointer"
                            title="Salin 2FA Secret"
                          >
                            {copiedAccountField === `${idx}-2fa` ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Card Footer: Green Buyer Claim Code */}
                      {acc.code && (
                        <div className="bg-[#070b0e] border border-emerald-500/30 rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <span className="text-[10px] text-emerald-400 uppercase font-mono block mb-0.5">
                              Kode Klaim Pembeli (Lisensi 43-Karakter)
                            </span>
                            <span className="text-emerald-300 font-mono text-xs sm:text-sm font-semibold truncate block select-all">
                              {acc.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(acc.code);
                                setCopiedAccountField(`${idx}-code`);
                                setTimeout(() => setCopiedAccountField(null), 1500);
                              }}
                              className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-950/80 rounded-lg border border-emerald-500/40 shrink-0 flex items-center gap-1.5 font-semibold cursor-pointer transition-colors"
                            >
                              {copiedAccountField === `${idx}-code` ? (
                                <Check size={13} />
                              ) : (
                                <Copy size={13} />
                              )}
                              <span>
                                {copiedAccountField === `${idx}-code`
                                  ? "Tersalin"
                                  : "Salin Kode"}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TAMBAH AKUN BARU (CREATE) */}
        {activeTab === "create" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[#0b1016] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-400" />
                  Form Input Akun ChatGPT Plus
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Kredensial akan langsung dienkripsi permanen dengan AES-256-GCM dan sistem otomatis membuat kode klaim acak.
                </p>
              </div>

              <form onSubmit={handleCreateClaim} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Email Akun ChatGPT
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh: user.chatgpt@icloud.com"
                    className="w-full px-4 py-3 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 font-mono"
                    required
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Password Akun
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password akun ChatGPT..."
                      className="w-full px-4 py-3 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 font-mono pr-11"
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    2FA Secret Key (Base32)
                  </label>
                  <div className="relative">
                    <input
                      type={show2fa ? "text" : "password"}
                      value={secret2fa}
                      onChange={(e) => setSecret2fa(e.target.value)}
                      placeholder="Contoh: QCPIL2Y4MW6YSU3D3RCSWMGLKCXKDNEF"
                      className="w-full px-4 py-3 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-600 font-mono pr-11 uppercase"
                      required
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShow2fa(!show2fa)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                    >
                      {show2fa ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5 font-mono">
                    <Key size={12} className="text-emerald-500 shrink-0" />
                    Kunci ini dipakai pembeli untuk generate kode OTP di 2fa.live
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Mengenkripsi & Menyimpan ke Database...</span>
                    </>
                  ) : (
                    <>
                      <Shield size={16} />
                      <span>Simpan Akun & Buat Kode Klaim Acak</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Success Box after Generation */}
            {generatedCode && (
              <div className="bg-[#0b1016] border border-emerald-500/40 rounded-2xl p-6 sm:p-8 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 size={18} />
                  <span>Akun Berhasil Tersimpan Permanen!</span>
                </div>

                <div className="bg-[#070b0e] border border-emerald-500/30 rounded-xl p-4">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block mb-1">
                    Kode Klaim Lisensi Pembeli:
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <code className="text-emerald-400 font-mono text-sm sm:text-base font-bold break-all select-all">
                      {generatedCode}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }}
                      className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                    >
                      {copiedCode ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedCode ? "Tersalin" : "Salin Kode"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-300">
                      Template Pesan WhatsApp untuk Pembeli:
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(claimMessageTemplate);
                        setCopiedTemplate(true);
                        setTimeout(() => setCopiedTemplate(false), 2000);
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedTemplate ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedTemplate ? "Pesan Tersalin!" : "Salin Format WA"}</span>
                    </button>
                  </div>
                  <pre className="p-4 bg-[#070b0e] border border-slate-800 rounded-xl text-slate-300 text-xs font-mono whitespace-pre-wrap leading-relaxed select-all">
                    {claimMessageTemplate}
                  </pre>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setActiveTab("inventory")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Database size={13} />
                    <span>Lihat di Daftar Akun</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PENGATURAN HARGA REALTIME */}
        {activeTab === "pricing" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-[#0b1016] border border-slate-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between pb-5 border-b border-slate-800 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Tag size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Atur Harga ChatGPT Plus Private</h3>
                    <p className="text-xs text-slate-400">
                      Perubahan harga tersimpan langsung dan otomatis tampil di halaman checkout pembeli.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void fetchPricing()}
                  disabled={pricingLoading}
                  className="p-2 bg-[#070b0e] hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Refresh harga terkini"
                >
                  <RefreshCw size={14} className={pricingLoading ? "animate-spin" : ""} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>

              {/* Status Box */}
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#070b0e] border border-slate-800/80 rounded-xl p-4">
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Harga Aktif Sekarang
                  </span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono">
                    Rp {currentPricing.price.toLocaleString("id-ID")}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Diperbarui: {currentPricing.updatedAt ? new Date(currentPricing.updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB" : "Default"}
                  </span>
                </div>
                <div className="bg-[#070b0e] border border-slate-800/80 rounded-xl p-4">
                  <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                    Harga Coret (Referensi)
                  </span>
                  <div className="text-2xl font-bold text-slate-400 line-through font-mono">
                    Rp {currentPricing.originalPrice.toLocaleString("id-ID")}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Diskon: {Math.round((1 - currentPricing.price / currentPricing.originalPrice) * 100)}%
                  </span>
                </div>
              </div>

              <form onSubmit={handleSavePricing} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nominal Harga Jual (Rupiah) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="1000"
                      max="10000000"
                      step="1000"
                      value={inputPrice}
                      onChange={(e) => setInputPrice(e.target.value)}
                      placeholder="75000"
                      className="w-full pl-12 pr-4 py-2.5 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Contoh: 75000 untuk Rp 75.000 atau 69000 untuk diskon promo.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Nominal Harga Coret / Normal (Opsional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="1000"
                      max="20000000"
                      step="1000"
                      value={inputOriginalPrice}
                      onChange={(e) => setInputOriginalPrice(e.target.value)}
                      placeholder="150000"
                      className="w-full pl-12 pr-4 py-2.5 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ditampilkan sebagai harga coret di samping harga jual untuk menarik minat pembeli.
                  </p>
                </div>

                {pricingError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{pricingError}</span>
                  </div>
                )}

                {pricingSuccess && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>Harga produk berhasil disimpan! Halaman checkout dan format pesan WhatsApp kini otomatis menggunakan harga baru ini secara realtime.</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pricingSaving}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3.5 rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer"
                  >
                    {pricingSaving ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Menyimpan Perubahan Harga...</span>
                      </>
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Terapkan &amp; Update Harga Toko Realtime</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* MODAL: EDIT AKUN (UPDATE) */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b1016] border border-slate-800 rounded-2xl w-full max-w-lg p-6 sm:p-7 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 size={18} className="text-blue-400" />
                <h3 className="text-base font-bold text-white">Edit Data Akun ChatGPT</h3>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateAccount} className="space-y-4 mt-5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Akun
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password Akun
                </label>
                <div className="relative">
                  <input
                    type={editShowPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setEditShowPassword(!editShowPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                  >
                    {editShowPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  2FA Secret Key (Base32)
                </label>
                <input
                  type="text"
                  value={editSecret2fa}
                  onChange={(e) => setEditSecret2fa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#070b0e] border border-slate-800 rounded-xl text-white text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono uppercase"
                  required
                />
              </div>

              {editError && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-red-400" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editUpdating}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-950/50"
                >
                  {editUpdating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG: HAPUS AKUN (DELETE) */}
      {deletingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b1016] border border-red-900/50 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto mb-4">
              <Trash2 size={24} />
            </div>

            <h3 className="text-center text-base font-bold text-white mb-2">
              Hapus Akun Ini?
            </h3>
            <p className="text-center text-xs text-slate-400 mb-4">
              Akun <strong className="text-slate-200 font-mono">{deletingAccount.email}</strong> akan dihapus permanen dari database. Kode klaim pembeli tidak akan dapat dipakai lagi.
            </p>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle size={15} className="shrink-0 text-red-400" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAccount(null)}
                disabled={deletingLoading}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingLoading}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-lg shadow-red-950/50"
              >
                {deletingLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>Ya, Hapus Akun</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

