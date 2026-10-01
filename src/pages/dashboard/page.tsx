import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useNavigate } from "@/lib/router-compat";
import CollectionBreakdown from "./components/CollectionBreakdown";
import { invokeObpay } from "@/lib/edge-function";
import { formatCurrency, formatDate, SUPPORTED_CURRENCIES } from "@/lib/currency";

interface WalletData {
  available_balance: number;
  pending_balance: number;
  total_collections: number;
  total_payouts: number;
  currency: string;
}

interface Transaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  fee_amount: number;
  net_amount: number;
  created_at: string;
  completed_at: string;
}

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { activeCurrency, setActiveCurrency, balances, availableCurrencies, activeBalance, currencyInfo } = useCurrency();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const lastPollTime = useRef<number>(0);

  // ── Withdraw to My Mobile state ──
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNetwork, setWithdrawNetwork] = useState("mtn");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [withdrawFeePercent, setWithdrawFeePercent] = useState(9);
  const [payoutFlatFee, setPayoutFlatFee] = useState(2000);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [walletRes, txnRes, psRes] = await Promise.all([
        supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("platform_settings").select("withdraw_fee_percent, payout_flat_fee").limit(1).maybeSingle(),
      ]);

      if (walletRes.error) console.error("Wallet fetch error:", walletRes.error);
      if (txnRes.error) throw txnRes.error;

      setWallet(walletRes.data as WalletData | null);
      setTransactions((txnRes.data as Transaction[]) || []);
      if (psRes?.data?.withdraw_fee_percent != null) setWithdrawFeePercent(Number(psRes.data.withdraw_fee_percent));
      if (psRes?.data?.payout_flat_fee != null) setPayoutFlatFee(Number(psRes.data.payout_flat_fee));
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Sync all pending transactions on initial load (catches up when browser was closed)
  const initialSyncDone = useRef(false);
  useEffect(() => {
    if (!user || initialSyncDone.current) return;
    initialSyncDone.current = true;

    invokeObpay({ _action: "sync-all-pending" })
      .then((data) => {
        if (data?.success && data?.updated?.length > 0) {
          for (const u of data.updated) {
            if (u.status === "success") {
              addToast("success", `Payment ${u.reference} confirmed! Wallet credited.`);
            } else if (u.status === "failed") {
              addToast("error", `Transaction ${u.reference} was marked as failed.`);
            }
          }
          // Refresh wallet + transactions after sync
          Promise.all([
            supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
          ]).then(([walletRes, txnRes]) => {
            if (!walletRes.error && walletRes.data) setWallet(walletRes.data as WalletData);
            if (!txnRes.error && txnRes.data) setTransactions(txnRes.data as Transaction[]);
          }).then(undefined, () => {});
        }
      })
      .then(undefined, () => {});
  }, [user, addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh wallet + transactions every 5 seconds
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Debounce: don't fire if we just synced within 4 seconds
      if (now - lastPollTime.current < 4000) return;
      lastPollTime.current = now;

      // Sync ALL pending with provider first
      invokeObpay({ _action: "sync-all-pending" })
        .then((data) => {
          if (data?.success && data?.updated?.length > 0) {
            for (const u of data.updated) {
              if (u.status === "success") {
                addToast("success", `Payment confirmed! ${u.reference} — wallet updated.`);
              } else if (u.status === "failed") {
                addToast("error", `Transaction ${u.reference} was marked as failed.`);
              }
            }
          }
          if (data?.logs) {
            console.log("[ObPay Sync]", data.message, data.logs.slice(-5));
          }
        })
        .then(undefined, () => {});

      // Refresh wallet + transactions from DB
      Promise.all([
        supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ])
        .then(([walletRes, txnRes]) => {
          if (!walletRes.error && walletRes.data) setWallet(walletRes.data as WalletData);
          if (!txnRes.error && txnRes.data) setTransactions(txnRes.data as Transaction[]);
        })
        .then(undefined, () => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [user, addToast]);

  // Realtime: instant updates via Supabase channels
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const newStatus = (payload.new as any).status;
            const oldStatus = (payload.old as any).status;
            const ref = (payload.new as any).reference;
            if (oldStatus === "pending" && newStatus === "success") {
              addToast("success", `Payment ${ref} confirmed! Balance updated.`);
            } else if (oldStatus === "pending" && newStatus === "failed") {
              addToast("error", `Payment ${ref} failed.`);
            }
          }
          Promise.all([
            supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
          ])
            .then(([walletRes, txnRes]) => {
              if (!walletRes.error && walletRes.data) setWallet(walletRes.data as WalletData);
              if (!txnRes.error && txnRes.data) setTransactions(txnRes.data as Transaction[]);
            })
            .then(undefined, () => {});
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_wallets", filter: `user_id=eq.${user.id}` },
        () => {
          supabase
            .from("merchant_wallets")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data) setWallet(data as WalletData);
            })
            .then(undefined, () => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, addToast]);

  // ─── Computed stats ──────────────────────────────────────

  const successTxns = transactions.filter((t) => t.status === "success");
  const pendingTxns = transactions.filter((t) => t.status === "pending");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCollections = successTxns
    .filter((t) => t.type === "collection" && new Date(t.created_at) >= todayStart)
    .reduce((s, t) => s + t.amount, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyCollections = successTxns
    .filter((t) => t.type === "collection" && new Date(t.created_at) >= monthStart)
    .reduce((s, t) => s + t.amount, 0);

  const totalFees = successTxns.reduce((s, t) => s + (t.fee_amount || 0), 0);

  // ── Per-currency balance cards (show all currencies with balances) ──
  const perCurrencyCards = Object.entries(balances)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([currency, amount]) => {
      const info = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
      return {
        label: info ? `${info.name} Balance` : `${currency} Balance`,
        value: formatCurrency(amount, currency),
        icon: "ri-coins-line",
        color: "bg-secondary-100 text-secondary-600",
        trend: currency === activeCurrency ? "Active" : "Available",
        currency,
      };
    });

  // ── Withdraw to my mobile handler ──
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || withdrawSubmitting || !profile?.phone_number) return;
    setWithdrawSubmitting(true); setWithdrawStatus(null);
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        setWithdrawStatus({ ok: false, message: "Please enter a valid amount." });
        setWithdrawSubmitting(false); return;
      }
      const fee = Math.round(amount * (withdrawFeePercent / 100) * 100) / 100;
      const total = amount + fee;

      if (total > activeBalance) {
        setWithdrawStatus({ ok: false, message: `You need ${formatCurrency(total, activeCurrency)} (includes ${formatCurrency(fee, activeCurrency)} fee at ${withdrawFeePercent}%). Your balance is ${formatCurrency(activeBalance, activeCurrency)}.` });
        setWithdrawSubmitting(false); return;
      }

      const ref = `W${Date.now().toString(36).toUpperCase()}`.slice(0, 30);

      const apiData = await invokeObpay({
        _action: "payout",
        payout_type: "withdraw",
        phoneNumber: profile.phone_number,
        amount,
        currency: activeCurrency,
        network: withdrawNetwork,
        description: withdrawDesc || "Withdrawal to my mobile",
        reference: ref,
      });

      if (apiData?.success) {
        setWithdrawStatus({
          ok: true,
          message: `Withdrawal of ${formatCurrency(amount, activeCurrency)} sent to ${profile.phone_number}! Fee: ${formatCurrency(fee, activeCurrency)} (${withdrawFeePercent}%). Awaiting confirmation.`,
        });
        setWithdrawAmount("");
        setWithdrawDesc("");
        setTimeout(() => {
          Promise.all([
            supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
            supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
          ]).then(([walletRes, txnRes]) => {
            if (!walletRes.error && walletRes.data) setWallet(walletRes.data as WalletData);
            if (!txnRes.error && txnRes.data) setTransactions(txnRes.data as Transaction[]);
          }).then(undefined, () => {});
        }, 1500);
      } else {
        setWithdrawStatus({ ok: false, message: apiData?.error || "Withdrawal could not be processed." });
      }
    } catch (err: any) {
      setWithdrawStatus({ ok: false, message: err.message });
    } finally { setWithdrawSubmitting(false); }
  };

  // ─── Loading / Error states ──────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-accent-600 text-3xl" />
            </div>
            <p className="text-sm text-foreground-800 mb-4">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" />
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium shadow-sm border transition-all animate-[fadeSlideIn_0.3s_ease-out] ${
              t.type === "success"
                ? "bg-primary-100 text-primary-800 border-primary-200"
                : t.type === "error"
                ? "bg-red-100 text-red-800 border-red-200"
                : "bg-accent-100 text-accent-800 border-accent-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <i
                className={`${
                  t.type === "success"
                    ? "ri-check-line text-primary-600"
                    : t.type === "error"
                    ? "ri-error-warning-line text-red-600"
                    : "ri-information-line text-accent-600"
                }`}
              />
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* ─── GREETING ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-foreground-500">
              {new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening"},
            </p>
            <h1 className="font-heading font-bold text-3xl md:text-4xl tracking-tight text-foreground-900 leading-tight break-words">
              {profile?.full_name?.split(" ")[0] || "Merchant"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={activeCurrency}
              onChange={(e) => setActiveCurrency(e.target.value)}
              aria-label="Wallet currency"
              className="appearance-none pl-4 pr-8 py-2.5 rounded-full bg-background-50 border border-background-200 text-sm font-semibold text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
            >
              {(availableCurrencies.length ? availableCurrencies : [activeCurrency]).map((code) => {
                const c = SUPPORTED_CURRENCIES.find((x) => x.code === code);
                return (
                  <option key={code} value={code}>
                    {c?.flag} {code} wallet
                  </option>
                );
              })}
            </select>
            {profile?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-foreground-900 text-background-50 text-sm font-semibold hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-admin-line" />Admin
              </button>
            )}
          </div>
        </div>

        {/* ─── BENTO: ACCOUNT CARD + STATS ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-foreground-900 via-primary-800 to-primary-600 text-background-50 shadow-xl">
            <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-background-50/10 blur-2xl" />
            <div className="absolute right-10 -bottom-24 w-56 h-56 rounded-full border border-background-50/15" />
            <div className="relative p-6 md:p-8 flex flex-col h-full min-h-[230px]">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background-50/15 text-xs font-semibold tracking-wide">
                  <i className="ri-bank-line" />ObPay Business
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-background-50/80"><i className="ri-shield-check-fill" />Secured</span>
              </div>
              <p className="mt-6 text-xs uppercase tracking-[0.2em] text-background-50/70">Available balance</p>
              <p className="font-heading font-bold text-4xl sm:text-5xl tracking-tight mt-2 break-words leading-none">
                {formatCurrency(activeBalance, activeCurrency)}
              </p>
              <div className="mt-auto pt-6 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-background-50/60">Account</p>
                  <p className="font-mono text-base tracking-[0.25em]">•••• {(user?.id || "").replace(/-/g, "").slice(-4).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-widest text-background-50/60">Pending</p>
                  <p className="font-heading font-semibold text-base">{formatCurrency(wallet?.pending_balance || 0, activeCurrency)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: "Today in", value: formatCurrency(todayCollections, activeCurrency), sub: "Collections today", icon: "ri-sun-line", tone: "bg-primary-100 text-primary-700" },
              { label: "This month", value: formatCurrency(monthlyCollections, activeCurrency), sub: `${successTxns.length} settled`, icon: "ri-calendar-check-line", tone: "bg-emerald-100 text-emerald-700" },
              { label: "In progress", value: String(pendingTxns.length), sub: "Pending payments", icon: "ri-time-line", tone: "bg-accent-100 text-accent-700" },
              { label: "Total fees", value: formatCurrency(totalFees, activeCurrency), sub: "Lifetime charges", icon: "ri-percent-line", tone: "bg-background-200 text-foreground-700" },
            ].map((s) => (
              <div key={s.label} className="bg-background-50 rounded-3xl border border-background-200/70 p-4 md:p-5 flex flex-col gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-2xl ${s.tone} flex items-center justify-center`}>
                  <i className={`${s.icon} text-lg`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground-500">{s.label}</p>
                  <p className="font-heading font-bold text-lg md:text-xl text-foreground-900 break-words leading-tight mt-0.5">{s.value}</p>
                  <p className="text-[11px] text-foreground-400 truncate mt-0.5">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── PRIMARY ACTIONS ─────────────────────────────── */}
        <div>
          <h2 className="font-heading font-bold text-xl md:text-2xl tracking-tight text-foreground-900 mb-4">Move money</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: "Collect", sub: "Request payment", icon: "ri-arrow-down-line", href: "/dashboard/collections", tone: "bg-primary-500 text-background-50" },
              { label: "Send", sub: "Pay anyone", icon: "ri-arrow-up-line", href: "/dashboard/payouts", tone: "bg-accent-500 text-background-50" },
              { label: "Pay link", sub: "Share & get paid", icon: "ri-link", href: "/dashboard/payment-links", tone: "bg-secondary-500 text-background-50" },
            ].map((a) => (
              <a
                key={a.label}
                href={a.href}
                className="bg-background-50 border border-background-200/70 rounded-3xl p-4 md:p-5 flex flex-col gap-4 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-2xl ${a.tone} flex items-center justify-center`}>
                  <i className={`${a.icon} text-xl group-hover:scale-110 transition-transform`} />
                </div>
                <div>
                  <p className="font-heading font-bold text-lg text-foreground-900 leading-tight">{a.label}</p>
                  <p className="text-xs text-foreground-500 mt-0.5">{a.sub}</p>
                </div>
              </a>
            ))}
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="bg-background-50 border border-background-200/70 rounded-3xl p-4 md:p-5 flex flex-col gap-4 text-left hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-2xl bg-foreground-900 text-background-50 flex items-center justify-center">
                <i className="ri-smartphone-line text-xl group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="font-heading font-bold text-lg text-foreground-900 leading-tight">Withdraw</p>
                <p className="text-xs text-foreground-500 mt-0.5">To my mobile money</p>
              </div>
            </button>
          </div>
        </div>

        {/* ─── SERVICE SHORTCUTS ───────────────────────────── */}
        <div>
          <h2 className="font-heading font-bold text-xl md:text-2xl tracking-tight text-foreground-900 mb-4">Your account</h2>
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Transactions", icon: "ri-exchange-line", href: "/dashboard/transactions", color: "text-primary-600 bg-primary-100" },
              { label: "Statements", icon: "ri-file-chart-line", href: "/dashboard/reports", color: "text-secondary-600 bg-secondary-100" },
              { label: "API Keys", icon: "ri-key-2-line", href: "/dashboard/api-keys", color: "text-accent-600 bg-accent-100" },
              { label: "Refunds", icon: "ri-refund-2-line", href: "/dashboard/refunds", color: "text-emerald-600 bg-emerald-100" },
              { label: "Verification", icon: "ri-shield-user-line", href: "/dashboard/kyc", color: "text-indigo-600 bg-indigo-100" },
              { label: "Settings", icon: "ri-settings-3-line", href: "/dashboard/settings", color: "text-foreground-700 bg-background-200" },
            ].map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="bg-background-50 rounded-3xl border border-background-200/70 p-3 md:p-4 flex flex-col items-center text-center gap-2 hover:border-primary-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-2xl ${s.color} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <i className={`${s.icon} text-xl`} />
                </div>
                <p className="text-xs md:text-sm font-semibold text-foreground-800 leading-tight">{s.label}</p>
              </a>
            ))}
          </div>
        </div>

        {/* ─── PER-CURRENCY BALANCES ───────────────────────── */}
        {perCurrencyCards.length > 0 && (
          <div>
            <h3 className="font-heading font-bold text-xl md:text-2xl tracking-tight text-foreground-900 mb-4">Your wallets</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {perCurrencyCards.map((card) => (
                <button
                  key={card.currency}
                  onClick={() => setActiveCurrency(card.currency)}
                  className={`bg-background-50 rounded-3xl p-4 border text-left transition-all cursor-pointer ${
                    card.currency === activeCurrency
                      ? "border-primary-400 ring-1 ring-primary-300"
                      : "border-background-200/70 hover:border-background-300/60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground-700">{card.currency}</span>
                    <span className="text-[10px] font-medium text-foreground-500">{card.trend}</span>
                  </div>
                  <p className="font-heading font-bold text-base text-foreground-900 break-words">{card.value}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── COLLECTION BREAKDOWN ────────────────────────── */}
        <CollectionBreakdown transactions={transactions} activeCurrency={activeCurrency} />

        {/* ─── RECENT ACTIVITY + SIDE PANEL ────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-background-50 rounded-3xl border border-background-200/70">
            <div className="p-5 border-b border-background-200/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="ri-exchange-line text-accent-600" />
                <h3 className="font-heading font-bold text-lg md:text-xl tracking-tight text-foreground-900">Recent activity</h3>
              </div>
              <a href="/dashboard/transactions" className="text-sm font-medium text-primary-500 hover:text-primary-600">
                View All
              </a>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-exchange-line text-foreground-400 text-xl" />
                </div>
                <p className="text-sm text-foreground-500">No transactions yet</p>
                <p className="text-xs text-foreground-400 mt-1">Your collections and payouts will appear here</p>
              </div>
            ) : (
              <div className="divide-y divide-background-200/70">
                {transactions.slice(0, 8).map((txn) => (
                  <div key={txn.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-background-100/50 transition-colors">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        txn.type === "collection" ? "bg-emerald-100" : "bg-accent-100"
                      }`}
                    >
                      <i
                        className={`${
                          txn.type === "collection" ? "ri-arrow-down-line text-emerald-600" : "ri-arrow-up-line text-accent-600"
                        } text-sm`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground-900 truncate">
                        {txn.customer_name || (txn.type === "collection" ? "Collection" : "Payout")}
                      </p>
                      <p className="text-[11px] text-foreground-500 font-mono truncate">
                        {txn.reference} · {formatDate(txn.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${txn.type === "collection" ? "text-emerald-600" : "text-foreground-900"}`}>
                        {txn.type === "collection" ? "+" : "−"}
                        {formatCurrency(txn.amount, txn.currency || activeCurrency)}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${
                          txn.status === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : txn.status === "pending"
                            ? "bg-accent-100 text-accent-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Money movement summary */}
            <div className="bg-background-50 rounded-3xl p-5 border border-background-200/70">
              <h4 className="font-heading font-bold text-lg tracking-tight text-foreground-900 mb-4">Money movement</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <i className="ri-download-cloud-line text-emerald-600 text-lg" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground-500">Total Collections</p>
                    <p className="font-heading font-bold text-lg text-foreground-900 break-words">
                      {formatCurrency(wallet?.total_collections || 0, activeCurrency)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
                    <i className="ri-upload-cloud-line text-accent-600 text-lg" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground-500">Total Payouts</p>
                    <p className="font-heading font-bold text-lg text-foreground-900 break-words">
                      {formatCurrency(wallet?.total_payouts || 0, activeCurrency)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <i className="ri-subtract-line text-red-600 text-lg" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground-500">Total Fees</p>
                    <p className="font-heading font-bold text-lg text-red-600 break-words">{formatCurrency(totalFees, activeCurrency)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* System status */}
            <div className="bg-background-50 rounded-3xl p-5 border border-background-200/70">
              <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-3">System status</h4>
              <div className="space-y-3">
                {[
                  { name: "Payments API", status: "Operational" },
                  { name: "Collections", status: "Operational" },
                  { name: "Payouts", status: "Operational" },
                  { name: "Auto-Sync", status: "Every 5s" },
                ].map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm text-foreground-700">{svc.name}</span>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">{svc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── TRUST & COMPLIANCE ──────────────────────────── */}
        <div className="bg-background-50 rounded-3xl border border-background-200/70 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: "ri-lock-line", label: "SSL/TLS Encrypted", sub: "256-bit encryption", color: "text-emerald-600" },
              { icon: "ri-shield-check-line", label: "PCI DSS Level 1", sub: "Compliant", color: "text-primary-600" },
              { icon: "ri-timer-flash-line", label: "99.9% Uptime SLA", sub: "Enterprise-grade", color: "text-accent-600" },
              { icon: "ri-government-line", label: "Regulated Entity", sub: "Licensed & Audited", color: "text-secondary-600" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center shrink-0">
                  <i className={`${item.icon} ${item.color} text-base`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground-900">{item.label}</p>
                  <p className="text-[10px] text-foreground-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ─── WITHDRAW TO MOBILE MODAL ──────────────────── */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground-900/40" onClick={() => { setShowWithdrawModal(false); setWithdrawStatus(null); }} />
          <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-md shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-heading font-semibold text-lg text-foreground-900">Withdraw to My Mobile</h3>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {profile?.phone_number ? (
                    <>To: <span className="font-mono text-foreground-700">{profile.phone_number}</span></>
                  ) : (
                    "Add your number in Settings first"
                  )}
                </p>
              </div>
              <button onClick={() => { setShowWithdrawModal(false); setWithdrawStatus(null); }} className="w-8 h-8 rounded-lg hover:bg-background-200 flex items-center justify-center text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>
            {withdrawStatus && (
              <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${withdrawStatus.ok ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>
                <div className="flex items-start gap-2">
                  <i className={`${withdrawStatus.ok ? "ri-checkbox-circle-line text-emerald-500" : "ri-error-warning-line text-accent-500"} mt-0.5`} />
                  <p>{withdrawStatus.message}</p>
                </div>
              </div>
            )}
            {!profile?.phone_number ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-smartphone-line text-accent-600 text-xl" />
                </div>
                <p className="text-sm text-foreground-700 mb-3">You need to add a mobile money number first.</p>
                <a href="/dashboard/settings" className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                  <i className="ri-settings-line" />Go to Settings
                </a>
              </div>
            ) : (
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Amount ({activeCurrency}) *</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="50000"
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-400"
                    required
                    min={1000}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Network</label>
                  <select
                    value={withdrawNetwork}
                    onChange={(e) => setWithdrawNetwork(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary-400"
                  >
                    <option value="mtn">MTN Mobile Money</option>
                    <option value="airtel">Airtel Money</option>
                  </select>
                </div>
                {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
                  <div className="bg-background-100 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-foreground-500">Withdrawal Amount</span>
                      <span className="font-semibold text-foreground-900 whitespace-nowrap">{formatCurrency(parseFloat(withdrawAmount), activeCurrency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-500">Withdrawal Fee ({withdrawFeePercent}%)</span>
                      <span className="font-medium text-accent-600 whitespace-nowrap">
                        {formatCurrency(Math.round(parseFloat(withdrawAmount) * (withdrawFeePercent / 100) * 100) / 100, activeCurrency)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-background-200/70 pt-1.5">
                      <span className="text-foreground-500 font-medium">Total Deduction</span>
                      <span className="font-bold text-foreground-900 whitespace-nowrap">
                        {formatCurrency(parseFloat(withdrawAmount) + Math.round(parseFloat(withdrawAmount) * (withdrawFeePercent / 100) * 100) / 100, activeCurrency)}
                      </span>
                    </div>
                    <p className="text-[10px] text-foreground-400 mt-1">You receive {formatCurrency(parseFloat(withdrawAmount), activeCurrency)} on your mobile money. {withdrawFeePercent}% fee covers ObPay's service.</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={withdrawDesc}
                    onChange={(e) => setWithdrawDesc(e.target.value)}
                    placeholder="Withdrawal to my mobile"
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-secondary-400"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowWithdrawModal(false); setWithdrawStatus(null); }} className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm">Cancel</button>
                  <button type="submit" disabled={withdrawSubmitting} className="flex-1 bg-secondary-500 hover:bg-secondary-600 disabled:bg-secondary-300 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm">
                    {withdrawSubmitting ? "Processing..." : "Withdraw"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}