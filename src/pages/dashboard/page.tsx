import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useNavigate } from "@/lib/router-compat";
import CollectionBreakdown from "./components/CollectionBreakdown";
import LiveTransactionFeed from "./components/LiveTransactionFeed";
import SavingsCalculator from "./components/SavingsCalculator";
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

const bankBanners = [
  {
    city: "Kampala",
    name: "ObPay Headquarters",
    icon: "ri-building-2-line",
    bgOverlay: "from-emerald-900/40 via-emerald-800/30 to-emerald-900/50",
    textColor: "text-background-50",
    accentColor: "text-emerald-300",
    tagline: "Modern Banking Infrastructure",
    stats: "Serving 5,000+ merchants across Uganda",
    image:
      "https://readdy.ai/api/search-image?query=Modern%20sleek%20African%20bank%20headquarters%20building%20with%20glass%20facade%20reflecting%20golden%20morning%20sunlight%2C%20clean%20architectural%20lines%2C%20professional%20corporate%20aesthetic%2C%20surrounded%20by%20manicured%20greenery%2C%20clear%20blue%20sky%20background%2C%20warm%20earth%20tones%2C%20editorial%20architectural%20photography%20style%2C%20high%20contrast%2C%20crisp%20details%2C%20no%20people%20visible%2C%20no%20text%20or%20logos%2C%20sophisticated%20financial%20institution%20atmosphere&width=800&height=400&seq=obpay-bank-hq-2026&orientation=landscape",
  },
  {
    city: "Nairobi",
    name: "Financial Center",
    icon: "ri-building-4-line",
    bgOverlay: "from-slate-900/40 via-slate-800/30 to-slate-900/50",
    textColor: "text-background-50",
    accentColor: "text-amber-300",
    tagline: "East African Financial Hub",
    stats: "Connected to 14 African markets",
    image:
      "https://readdy.ai/api/search-image?query=Panoramic%20view%20of%20modern%20financial%20district%20skyline%20featuring%20contemporary%20bank%20buildings%20with%20glass%20and%20steel%20architecture%2C%20warm%20sunset%20lighting%20casting%20golden%20reflections%2C%20clean%20urban%20landscape%2C%20professional%20corporate%20atmosphere%2C%20wide%20angle%20perspective%2C%20sharp%20architectural%20details%2C%20dramatic%20sky%20with%20soft%20clouds%2C%20sophisticated%20aesthetic%2C%20no%20text%20or%20logos%2C%20luxurious%20financial%20center%20ambiance%2C%20high%20end%20editorial%20photography%20style&width=800&height=400&seq=obpay-financial-hub-2026&orientation=landscape",
  },
  {
    city: "Regional",
    name: "Banking Services",
    icon: "ri-bank-line",
    bgOverlay: "from-indigo-900/40 via-indigo-800/30 to-indigo-900/50",
    textColor: "text-background-50",
    accentColor: "text-indigo-300",
    tagline: "Full-Service Banking Network",
    stats: "MTN, Airtel & major banks supported",
    image:
      "https://readdy.ai/api/search-image?query=Elegant%20modern%20banking%20hall%20interior%20with%20sleek%20marble%20counters%20and%20warm%20ambient%20lighting%2C%20contemporary%20design%20elements%2C%20professional%20service%20atmosphere%2C%20polished%20surfaces%20reflecting%20soft%20light%2C%20minimalist%20aesthetic%20with%20subtle%20gold%20accents%2C%20clean%20open%20spaces%2C%20sophisticated%20corporate%20environment%2C%20no%20people%20visible%2C%20no%20text%20or%20logos%2C%20high%20end%20architectural%20interior%20photography%2C%20luxurious%20financial%20service%20setting&width=800&height=400&seq=obpay-banking-hall-2026&orientation=landscape",
  },
];

const paymentMethodBanners = [
  {
    name: "MTN Mobile Money",
    icon: "ri-smartphone-line",
    bgLight: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200/70",
    tagline: "Instant mobile payments",
    stats: "76M+ users across Africa",
    image:
      "https://readdy.ai/api/search-image?query=Bright%20warm%20yellow%20and%20amber%20abstract%20geometric%20pattern%20background%20with%20soft%20flowing%20curves%20and%20subtle%20texture%2C%20modern%20fintech%20aesthetic%2C%20clean%20minimal%20design%2C%20warm%20golden%20tones%2C%20no%20text%20or%20logos%2C%20smooth%20gradient%20from%20light%20yellow%20to%20warm%20amber%2C%20professional%20banking%20visual%20style&width=800&height=400&seq=mtn-banner-2026-v2&orientation=landscape",
  },
  {
    name: "Airtel Money",
    icon: "ri-smartphone-line",
    bgLight: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200/70",
    tagline: "Fast and secure transfers",
    stats: "Active in 14 African countries",
    image:
      "https://readdy.ai/api/search-image?query=Warm%20coral%20red%20and%20rose%20abstract%20flowing%20shapes%20background%20with%20smooth%20curves%2C%20modern%20fintech%20design%2C%20clean%20minimal%20aesthetic%2C%20soft%20red%20gradient%20tones%2C%20no%20text%20or%20logos%2C%20professional%20financial%20technology%20visual%20style%2C%20elegant%20subtle%20texture&width=800&height=400&seq=airtel-banner-2026-v2&orientation=landscape",
  },
  {
    name: "Bank Transfer",
    icon: "ri-bank-line",
    bgLight: "bg-emerald-50",
    textColor: "text-emerald-700",
    borderColor: "border-emerald-200/70",
    tagline: "Direct to any bank account",
    stats: "All major Ugandan banks supported",
    image:
      "https://readdy.ai/api/search-image?query=Elegant%20emerald%20green%20and%20teal%20abstract%20geometric%20pattern%20background%20with%20soft%20flowing%20shapes%2C%20modern%20banking%20aesthetic%2C%20clean%20minimal%20design%2C%20smooth%20green%20gradient%20tones%2C%20no%20text%20or%20logos%2C%20professional%20corporate%20financial%20visual%20style%2C%20subtle%20texture%20and%20depth&width=800&height=400&seq=bank-banner-2026-v2&orientation=landscape",
  },
];

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

  // ─── Main balance cards using active currency ──────────────────
  const balanceCards = [
    {
      label: "Available Balance",
      value: formatCurrency(activeBalance, activeCurrency),
      icon: "ri-wallet-3-line",
      color: "bg-primary-100 text-primary-600",
      trend: "Ready to use",
    },
    {
      label: "Pending Balance",
      value: formatCurrency(wallet?.pending_balance || 0, activeCurrency),
      icon: "ri-time-line",
      color: "bg-accent-100 text-accent-600",
      trend: `${pendingTxns.length} pending`,
    },
    {
      label: "Today's Collections",
      value: formatCurrency(todayCollections, activeCurrency),
      icon: "ri-arrow-down-circle-line",
      color: "bg-emerald-100 text-emerald-600",
      trend: todayCollections > 0 ? "Today's activity" : "No activity yet",
    },
    {
      label: "Monthly Total",
      value: formatCurrency(monthlyCollections, activeCurrency),
      icon: "ri-bar-chart-line",
      color: "bg-secondary-100 text-secondary-600",
      trend: `${successTxns.length} successful`,
    },
  ];

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

      if (total > (wallet?.available_balance || 0)) {
        setWithdrawStatus({ ok: false, message: `You need ${formatCurrency(total, activeCurrency)} (includes ${formatCurrency(fee, activeCurrency)} fee at ${withdrawFeePercent}%). Your balance is ${formatCurrency(wallet?.available_balance || 0, activeCurrency)}.` });
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

      <div className="space-y-6">
        {/* ─── HEADER ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-1">
              Welcome back, {profile?.full_name?.split(" ")[0] || "Merchant"}
            </h2>
            <p className="text-sm text-foreground-600">Here's what's happening with your account today.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Currency Selector */}
            <div className="relative">
              <select
                value={activeCurrency}
                onChange={(e) => setActiveCurrency(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm font-medium text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-foreground-500">
                <i className="ri-arrow-down-s-line" />
              </div>
            </div>
            {profile?.role === "admin" && (
              <button
                onClick={() => navigate("/admin")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-foreground-900 hover:bg-foreground-800 text-background-50 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-admin-line" />
                Admin Panel
                <i className="ri-arrow-right-up-line text-xs" />
              </button>
            )}
          </div>
        </div>

        {/* ─── TRUST & COMPLIANCE BAR ──────────────────────── */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: "ri-lock-line", label: "SSL/TLS Encrypted", sub: "256-bit encryption", color: "text-emerald-600" },
              { icon: "ri-shield-check-line", label: "PCI DSS Level 1", sub: "Compliant", color: "text-primary-600" },
              { icon: "ri-timer-flash-line", label: "99.9% Uptime SLA", sub: "Enterprise-grade", color: "text-accent-600" },
              { icon: "ri-government-line", label: "Regulated Entity", sub: "Licensed & Audited", color: "text-secondary-600" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg bg-background-100 flex items-center justify-center shrink-0`}>
                  <i className={`${item.icon} ${item.color} text-base`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground-900 whitespace-nowrap">{item.label}</p>
                  <p className="text-[10px] text-foreground-500">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── BALANCE CARDS (Active Currency) ───────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {balanceCards.map((card) => (
            <div
              key={card.label}
              className="bg-background-50 rounded-xl p-3 md:p-5 border border-background-200/70 hover:border-background-300/60 transition-all group"
            >
              <div className="flex items-start justify-between mb-2 md:mb-3">
                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg ${card.color} flex items-center justify-center shrink-0`}>
                  <i className={`${card.icon} text-sm md:text-lg`} />
                </div>
                <span className="text-[10px] md:text-xs text-foreground-400 group-hover:text-foreground-500 transition-colors whitespace-nowrap">
                  {card.trend}
                </span>
              </div>
              <p className="text-xs md:text-sm text-foreground-600 mb-0.5 md:mb-1">{card.label}</p>
              <p className="font-heading font-bold text-sm md:text-lg lg:text-xl text-foreground-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* ─── PER-CURRENCY BALANCES ───────────────────────── */}
        {perCurrencyCards.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-coins-line text-primary-600 text-lg" />
              <h3 className="font-heading font-semibold text-sm text-foreground-900">All Currency Balances</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {perCurrencyCards.map((card) => (
                <button
                  key={card.currency}
                  onClick={() => setActiveCurrency(card.currency)}
                  className={`bg-background-50 rounded-xl p-4 border text-left transition-all cursor-pointer whitespace-nowrap ${
                    card.currency === activeCurrency
                      ? "border-primary-400 ring-1 ring-primary-300"
                      : "border-background-200/70 hover:border-background-300/60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center shrink-0`}>
                      <i className={`${card.icon} text-sm`} />
                    </div>
                    <span className="text-[10px] font-medium text-foreground-500">{card.trend}</span>
                  </div>
                  <p className="text-[11px] text-foreground-500 mb-0.5">{card.label}</p>
                  <p className="font-heading font-bold text-base text-foreground-900">{card.value}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── QUICK ACTION BUTTONS ────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <a
            href="/dashboard/collections"
            className="flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-4 py-3 rounded-xl transition-all cursor-pointer group whitespace-nowrap"
          >
            <div className="w-8 h-8 rounded-lg bg-background-50/20 flex items-center justify-center shrink-0">
              <i className="ri-arrow-down-circle-line text-base group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-sm md:text-base">Collect Money</span>
          </a>
          <a
            href="/dashboard/payouts"
            className="flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-3 rounded-xl transition-all cursor-pointer group whitespace-nowrap"
          >
            <div className="w-8 h-8 rounded-lg bg-background-50/20 flex items-center justify-center shrink-0">
              <i className="ri-arrow-up-circle-line text-base group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-sm md:text-base">Send Payout</span>
          </a>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="flex items-center justify-center gap-2 bg-secondary-500 hover:bg-secondary-600 text-background-50 font-medium px-4 py-3 rounded-xl transition-all cursor-pointer group whitespace-nowrap"
          >
            <div className="w-8 h-8 rounded-lg bg-background-50/20 flex items-center justify-center shrink-0">
              <i className="ri-smartphone-line text-base group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-sm md:text-base">Withdraw to Mobile</span>
          </button>
        </div>

        {/* ─── BANK BUILDING BANNERS ───────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <i className="ri-building-2-line text-accent-600 text-lg" />
            <h3 className="font-heading font-semibold text-base text-foreground-900">Our Banking Network</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {bankBanners.map((bank) => (
              <div
                key={bank.name}
                className="relative overflow-hidden rounded-xl h-48 group cursor-default transition-all hover:shadow-sm"
              >
                <img
                  src={bank.image}
                  alt={bank.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${bank.bgOverlay}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                  <div>
                    <span className={`text-[10px] font-medium uppercase tracking-wider ${bank.accentColor} bg-black/20 px-2 py-0.5 rounded-full`}>
                      {bank.city}
                    </span>
                    <h4 className={`font-heading font-bold text-base mt-2 ${bank.textColor}`}>{bank.name}</h4>
                    <p className={`text-xs ${bank.accentColor} mt-1`}>{bank.tagline}</p>
                  </div>
                  <p className={`text-[11px] ${bank.textColor} opacity-75 border-t border-white/10 pt-2.5`}>{bank.stats}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── COLLECTION BREAKDOWN ────────────────────────── */}
        <CollectionBreakdown transactions={transactions} activeCurrency={activeCurrency} />

        {/* ─── MAIN CONTENT GRID ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Transaction Feed (2/3 width) */}
          <div className="lg:col-span-2">
            <LiveTransactionFeed transactions={transactions} activeCurrency={activeCurrency} />
          </div>

          {/* Savings Calculator + Quick Actions (1/3 width) */}
          <div className="space-y-4">
            {/* Savings Calculator */}
            <SavingsCalculator />

            {/* Quick Actions */}
            <div className="bg-background-50 rounded-xl p-5 border border-background-200/70">
              <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-3">Quick Actions</h4>
              <div className="space-y-1.5">
                <a
                  href="/dashboard/payment-links"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background-100 hover:bg-primary-50 text-sm text-foreground-700 hover:text-primary-600 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <i className="ri-add-circle-line text-primary-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Create Payment Link</span>
                </a>
                <a
                  href="/dashboard/collections"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background-100 hover:bg-emerald-50 text-sm text-foreground-700 hover:text-emerald-600 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <i className="ri-download-cloud-line text-emerald-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Initiate Collection</span>
                </a>
                <a
                  href="/dashboard/payouts"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background-100 hover:bg-accent-50 text-sm text-foreground-700 hover:text-accent-600 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
                    <i className="ri-upload-cloud-line text-accent-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Send Payout</span>
                </a>
                <a
                  href="/dashboard/payouts#withdraw"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background-100 hover:bg-accent-50 text-sm text-foreground-700 hover:text-accent-600 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
                    <i className="ri-smartphone-line text-accent-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Withdraw to Mobile</span>
                </a>
                <a
                  href="/dashboard/reports"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background-100 hover:bg-secondary-50 text-sm text-foreground-700 hover:text-secondary-600 transition-colors cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                    <i className="ri-file-download-line text-secondary-500 group-hover:scale-110 transition-transform" />
                  </div>
                  <span>Download Report</span>
                </a>
              </div>
            </div>

            {/* Payout Summary */}
            <div className="bg-background-50 rounded-xl p-5 border border-background-200/70">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
                  <i className="ri-upload-cloud-line text-accent-600 text-lg" />
                </div>
                <div>
                  <p className="text-xs text-foreground-500">Total Payouts</p>
                  <p className="font-heading font-bold text-xl text-foreground-900">
                    {formatCurrency(wallet?.total_payouts || 0, activeCurrency)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <i className="ri-subtract-line text-red-600 text-lg" />
                </div>
                <div>
                  <p className="text-xs text-foreground-500">Total Fees</p>
                  <p className="font-heading font-bold text-xl text-red-600">{formatCurrency(totalFees, activeCurrency)}</p>
                </div>
              </div>
            </div>

            {/* API Status */}
            <div className="bg-background-50 rounded-xl p-5 border border-background-200/70">
              <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-3">API Status</h4>
              <div className="space-y-3">
                {[
                  { name: "API", status: "Operational", color: "bg-emerald-500" },
                  { name: "Collections", status: "Operational", color: "bg-emerald-500" },
                  { name: "Payouts", status: "Operational", color: "bg-emerald-500" },
                  { name: "Auto-Sync", status: "Every 5s", color: "bg-emerald-500" },
                ].map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${svc.color} animate-pulse`} />
                      <span className="text-sm text-foreground-700">{svc.name}</span>
                    </div>
                    <span className="text-xs text-emerald-600 font-medium">{svc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── PAYMENT METHODS ─────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <i className="ri-bank-card-line text-accent-600 text-lg" />
            <h3 className="font-heading font-semibold text-base text-foreground-900">Supported Payment Methods</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {paymentMethodBanners.map((bank) => (
              <div
                key={bank.name}
                className={`relative overflow-hidden rounded-xl border ${bank.borderColor} ${bank.bgLight} h-44 group cursor-default transition-all hover:shadow-sm`}
              >
                <img
                  src={bank.image}
                  alt={bank.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                <div className="relative z-10 p-5 h-full flex flex-col justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-background-50/90 flex items-center justify-center shadow-sm backdrop-blur-sm">
                      <i className={`${bank.icon} ${bank.textColor} text-xl`} />
                    </div>
                    <div>
                      <h4 className={`font-heading font-semibold text-sm ${bank.textColor}`}>{bank.name}</h4>
                      <p className="text-[11px] text-foreground-600">{bank.tagline}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-foreground-500 border-t border-background-200/40 pt-2.5">{bank.stats}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── STRATEGIC PARTNERS ──────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <i className="ri-briefcase-line text-accent-600 text-lg" />
            <h3 className="font-heading font-semibold text-base text-foreground-900">Strategic Partners &amp; Integrations</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { name: "MTN Uganda", sub: "Mobile Money", icon: "ri-smartphone-line", logoBg: "bg-amber-50", iconColor: "text-amber-600" },
              { name: "Airtel Uganda", sub: "Mobile Money", icon: "ri-signal-wifi-line", logoBg: "bg-red-50", iconColor: "text-red-600" },
              { name: "Stanbic Bank", sub: "Banking Partner", icon: "ri-bank-line", logoBg: "bg-blue-50", iconColor: "text-blue-600" },
              { name: "Centenary Bank", sub: "Banking Partner", icon: "ri-building-2-line", logoBg: "bg-emerald-50", iconColor: "text-emerald-600" },
              { name: "Payment Processor", sub: "Payment Processor", icon: "ri-exchange-dollar-line", logoBg: "bg-primary-50", iconColor: "text-primary-600" },
              { name: "URSB", sub: "Govt Registry", icon: "ri-government-line", logoBg: "bg-secondary-50", iconColor: "text-secondary-600" },
            ].map((partner) => (
              <div
                key={partner.name}
                className="bg-background-50 rounded-xl border border-background-200/70 p-4 flex flex-col items-center text-center gap-2 hover:border-background-300/60 transition-all cursor-default group"
              >
                <div className={`w-12 h-12 rounded-xl ${partner.logoBg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <i className={`${partner.icon} ${partner.iconColor} text-xl`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground-900">{partner.name}</p>
                  <p className="text-[10px] text-foreground-500">{partner.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── RECENT TRANSACTIONS ─────────────────────────── */}
        <div className="bg-background-50 rounded-xl border border-background-200/70">
          <div className="p-5 border-b border-background-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-exchange-line text-accent-600" />
              <h3 className="font-heading font-semibold text-base text-foreground-900">Recent Transactions</h3>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-background-200/70">
                    <th className="text-left text-xs font-medium text-foreground-500 uppercase px-5 py-3">Reference</th>
                    <th className="text-left text-xs font-medium text-foreground-500 uppercase px-5 py-3">Amount</th>
                    <th className="text-left text-xs font-medium text-foreground-500 uppercase px-5 py-3 hidden sm:table-cell">Fee</th>
                    <th className="text-left text-xs font-medium text-foreground-500 uppercase px-5 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-foreground-500 uppercase px-5 py-3 hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 8).map((txn) => (
                    <tr
                      key={txn.id}
                      className="border-b border-background-200/70 last:border-0 hover:bg-background-100/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                              txn.type === "collection" ? "bg-emerald-100" : "bg-accent-100"
                            }`}
                          >
                            <i
                              className={`${
                                txn.type === "collection"
                                  ? "ri-arrow-down-line text-emerald-600"
                                  : "ri-arrow-up-line text-accent-600"
                              } text-xs`}
                            />
                          </div>
                          <span className="text-sm font-medium text-foreground-900 font-mono">{txn.reference}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-foreground-900">{formatCurrency(txn.amount, txn.currency || activeCurrency)}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-xs text-foreground-500">
                          {txn.fee_amount ? formatCurrency(txn.fee_amount, txn.currency || activeCurrency) : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            txn.status === "success"
                              ? "bg-emerald-100 text-emerald-700"
                              : txn.status === "pending"
                              ? "bg-accent-100 text-accent-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-foreground-500">{formatDate(txn.created_at)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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