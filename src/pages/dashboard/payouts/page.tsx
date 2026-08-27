import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { invokeObpay } from "@/lib/edge-function";
import { formatCurrency, formatDate, SUPPORTED_CURRENCIES } from "@/lib/currency";

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  phone_number: string;
  network: string;
  description: string;
  rejection_reason: string;
  provider_reference: string;
  fee_amount: number;
  requested_at: string;
  processed_at: string;
  completed_at: string;
}

function simplifyError(msg: string): string {
  const m = msg.toLowerCase();
  // Provider-specific balance errors  
  if ((m.includes("marz") || m.includes("livepay") || m.includes("julypay")) && (m.includes("insufficient") || m.includes("balance"))) {
    return "Your payment wallet doesn't have enough funds. Collect more payments first, then try the payout again.";
  }
  // ObPay wallet balance errors
  if (m.includes("obpay") && (m.includes("insufficient") || m.includes("balance"))) {
    return "Not enough balance in your ObPay wallet for this payout. Top up your wallet and try again.";
  }
  // Generic insufficient wallet
  if (m.includes("insufficient") && m.includes("wallet")) return "Not enough balance for this payout. Top up your wallet and try again.";
  if (m.includes("insufficient") || m.includes("liquidity") || m.includes("funds")) return "Provider temporarily unavailable. Please try again in a few minutes.";
  if (m.includes("session") || m.includes("expired") || m.includes("authentication")) return "Session expired. Please log in again.";
  if (m.includes("credentials") || m.includes("api key")) return "Payment setup incomplete. Check your provider settings.";
  if (m.includes("rate") || m.includes("429") || m.includes("busy")) return "Server busy. Please wait a moment and retry.";
  if (m.includes("network") || m.includes("connection")) return "Connection issue. Check your internet and retry.";
  if (msg.length > 150) return msg.slice(0, 145) + "...";
  return msg;
}

async function callObPayAPI(body: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string; [key: string]: any }> {
  try {
    return await invokeObpay(body);
  } catch (err: any) {
    return { success: false, error: err.message || "Network error. Check your connection." };
  }
}

function getNetworkDisplay(network: string) {
  switch (network?.toLowerCase()) {
    case "mtn": return { label: "MTN Mobile Money", color: "bg-amber-100 text-amber-700", icon: "ri-smartphone-line" };
    case "airtel": return { label: "Airtel Money", color: "bg-red-100 text-red-700", icon: "ri-smartphone-line" };
    case "bank": return { label: "Bank Transfer", color: "bg-emerald-100 text-emerald-700", icon: "ri-bank-line" };
    default: return { label: network || "Mobile Money", color: "bg-background-200 text-foreground-600", icon: "ri-smartphone-line" };
  }
}

export default function PayoutsPage() {
  const { user, profile } = useAuth();
  const { activeCurrency, setActiveCurrency, balances, activeBalance, currencyInfo } = useCurrency();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState({ available_balance: 0, pending_balance: 0 });
  const [withdrawalLimit, setWithdrawalLimit] = useState<{ daily_limit: number; used_24h: number; remaining: number; resets_in_hours: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ phoneNumber: "", amount: "", currency: activeCurrency, network: "mtn", description: "", reference: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [merchantSlug, setMerchantSlug] = useState<string | null>(null);
  const [feePercent, setFeePercent] = useState(5);
  const [payoutFlatFee, setPayoutFlatFee] = useState(2000);
  const [withdrawFeePercent, setWithdrawFeePercent] = useState(3);
  const [minPayout, setMinPayout] = useState(0);
  const [maxPayout, setMaxPayout] = useState(0);
  const [showFundingQR, setShowFundingQR] = useState(false);
  const [copiedFunding, setCopiedFunding] = useState(false);

  // ── Name verification state for payout modal ──
  const [payoutVerifying, setPayoutVerifying] = useState(false);
  const [payoutVerifiedName, setPayoutVerifiedName] = useState<string | null>(null);
  const [payoutVerifiedPhone, setPayoutVerifiedPhone] = useState<string | null>(null);
  const [payoutVerifyError, setPayoutVerifyError] = useState<string | null>(null);

  // ── Name verification state for withdraw section ──
  const [withdrawVerifying, setWithdrawVerifying] = useState(false);
  const [withdrawVerifiedName, setWithdrawVerifiedName] = useState<string | null>(null);
  const [withdrawVerifyError, setWithdrawVerifyError] = useState<string | null>(null);

  // ── Withdraw to My Mobile state ──
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNetwork, setWithdrawNetwork] = useState("mtn");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawStatus, setWithdrawStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  // Update form currency when activeCurrency changes
  useEffect(() => {
    setForm((prev) => ({ ...prev, currency: activeCurrency }));
  }, [activeCurrency]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const [{ data: pData, error: pErr }, { data: wData }, { data: mData }, { data: psData }] = await Promise.all([
        supabase.from("payout_requests").select("*").eq("user_id", user.id).order("requested_at", { ascending: false }).limit(50),
        supabase.from("merchant_wallets").select("available_balance,pending_balance,daily_withdrawal_limit,last_24h_withdrawal_total,last_withdrawal_reset_at,balances_by_currency").eq("user_id", user.id).maybeSingle(),
        supabase.from("merchant_profiles").select("merchant_slug,company_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("platform_settings").select("platform_fee_percent, payout_flat_fee, withdraw_fee_percent, min_payout_amount, max_payout_amount").limit(1).maybeSingle(),
      ]);
      if (pErr) throw pErr;
      setPayouts((pData as Payout[]) || []);
      setWallet({ available_balance: wData?.available_balance || 0, pending_balance: wData?.pending_balance || 0 });
      setMerchantSlug(mData?.merchant_slug || null);
      if (psData?.platform_fee_percent) setFeePercent(psData.platform_fee_percent);
      if (psData?.payout_flat_fee != null) setPayoutFlatFee(Number(psData.payout_flat_fee));
      if (psData?.withdraw_fee_percent != null) setWithdrawFeePercent(Number(psData.withdraw_fee_percent));
      if (psData?.min_payout_amount != null) setMinPayout(psData.min_payout_amount);
      if (psData?.max_payout_amount != null) setMaxPayout(psData.max_payout_amount);

      // Compute withdrawal limit info
      if (wData?.daily_withdrawal_limit && Number(wData.daily_withdrawal_limit) > 0) {
        const now = new Date();
        const resetAt = wData.last_withdrawal_reset_at ? new Date(wData.last_withdrawal_reset_at) : new Date(0);
        const hoursSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60);
        const used24h = hoursSinceReset >= 24 ? 0 : Number(wData.last_24h_withdrawal_total || 0);
        const remaining = Math.max(0, Number(wData.daily_withdrawal_limit) - used24h);
        setWithdrawalLimit({
          daily_limit: Number(wData.daily_withdrawal_limit),
          used_24h: used24h,
          remaining,
          resets_in_hours: Math.max(0, 24 - hoursSinceReset)
        });
      } else {
        setWithdrawalLimit(null);
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-poll provider for pending payout transactions every 5 seconds
  useEffect(() => {
    if (!user) return;
    const hasPendingPayouts = payouts.some(p => p.status === "pending");
    if (!hasPendingPayouts) return;

    const interval = setInterval(async () => {
      try {
        const data = await invokeObpay({ _action: "sync-all-pending" });
        if (data?.success && data.updated && data.updated.length > 0) {
          fetchData();
        }
      } catch { /* silent */ }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, payouts, fetchData]);

  useEffect(() => {
    if (!user) return;

    // Realtime: watch transactions and payout_requests for instant updates
    const channel = supabase
      .channel("payouts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payout_requests", filter: `user_id=eq.${user.id}` },
        () => { fetchData(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "merchant_wallets", filter: `user_id=eq.${user.id}` },
        () => { fetchData(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const getFundingUrl = () => {
    const base = window.location.origin;
    return `${base}/pay/${merchantSlug}`;
  };

  const copyFundingUrl = () => {
    navigator.clipboard.writeText(getFundingUrl());
    setCopiedFunding(true);
    setTimeout(() => setCopiedFunding(false), 2000);
  };

  const getQRCodeUrl = (url: string) => {
    const encoded = encodeURIComponent(url);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&bgcolor=ffffff&color=000000`;
  };

  const estimatedPayoutFee = (): number => {
    const amt = parseFloat(form.amount) || 0;
    if (amt <= 0) return 0;
    if (amt <= 70000) return payoutFlatFee; // flat 2,000 UGX
    return Math.round(amt * (withdrawFeePercent / 100) * 100) / 100; // 3%
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true); setSubmitStatus(null);
    try {
      const amount = parseFloat(form.amount);
      if (!form.phoneNumber || isNaN(amount) || amount <= 0) {
        setSubmitStatus({ ok: false, message: "Please check all fields and try again." });
        setSubmitting(false); return;
      }

      const fee = estimatedPayoutFee();
      const totalDeduction = amount + fee;

      if (totalDeduction > activeBalance) {
        const feeLabel = amount <= 70000 ? `${formatCurrency(fee, form.currency)} flat fee` : `${formatCurrency(fee, form.currency)} (3%)`;
        setSubmitStatus({ ok: false, message: `You need ${formatCurrency(totalDeduction, form.currency)} (includes ${feeLabel}). Your balance is ${formatCurrency(activeBalance, form.currency)}.` });
        setSubmitting(false); return;
      }

      if (minPayout > 0 && amount < minPayout) {
        setSubmitStatus({ ok: false, message: `Minimum payout is ${formatCurrency(minPayout, form.currency)}.` });
        setSubmitting(false); return;
      }
      if (maxPayout > 0 && amount > maxPayout) {
        setSubmitStatus({ ok: false, message: `Maximum payout is ${formatCurrency(maxPayout, form.currency)}.` });
        setSubmitting(false); return;
      }

      const ref = form.reference.trim() || `P${Date.now().toString(36).toUpperCase()}`.slice(0, 30);

      const apiData = await callObPayAPI({
        _action: "payout",
        payout_type: "send",
        phoneNumber: form.phoneNumber,
        amount,
        currency: form.currency,
        network: form.network,
        description: form.description,
        reference: ref,
      });

      if (apiData?.success) {
        setSubmitStatus({
          ok: true,
          message: `Payout sent! Ref: ${apiData.data?.reference}. Awaiting confirmation.`,
        });

        // Send payout confirmation email
        if (user?.email) {
          const payoutAmt = parseFloat(form.amount);
          supabase.functions.invoke("send-transactional-email", {
            body: {
              email: user.email,
              type: "payout_request_received",
              data: {
                amount: String(payoutAmt),
                currency: form.currency,
                payment_method: form.network === "mtn" ? "MTN Mobile Money" : form.network === "airtel" ? "Airtel Money" : "Bank Transfer",
                full_name: profile?.full_name || "",
              },
            },
          }).then(() => {}, (e: any) => console.warn("[Payouts] Confirmation email failed silently:", e));
        }

        setForm({ phoneNumber: "", amount: "", currency: activeCurrency, network: "mtn", description: "", reference: "" });
        fetchData();
      } else {
        const errMsg = apiData?.error || apiData?.message || "Payout could not be processed.";
        setSubmitStatus({ ok: false, message: simplifyError(errMsg) });
      }
    } catch (err: any) {
      setSubmitStatus({ ok: false, message: simplifyError(err.message) });
    } finally { setSubmitting(false); }
  };

  const refreshSession = async () => {
    setSubmitStatus(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        setSubmitStatus({ ok: false, message: `Could not refresh session: ${error.message}. Please log out and log back in.` });
      } else {
        setSubmitStatus({ ok: true, message: "Session refreshed successfully. You can now try sending the payout again." });
      }
    } catch (err: any) {
      setSubmitStatus({ ok: false, message: err.message || "Failed to refresh session" });
    } finally { setSubmitting(false); }
  };

  // ── Withdraw to my own mobile number ──
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
      const withdrawFee = amount <= 70000
        ? payoutFlatFee
        : Math.round(amount * (withdrawFeePercent / 100) * 100) / 100;
      const totalWithdrawDeduction = amount + withdrawFee;

      // Daily withdrawal limit check (client-side)
      if (withdrawalLimit && amount > withdrawalLimit.remaining) {
        setWithdrawStatus({ ok: false, message: `Daily withdrawal limit exceeded. You have ${formatCurrency(withdrawalLimit.remaining, activeCurrency)} remaining out of your ${formatCurrency(withdrawalLimit.daily_limit, activeCurrency)} daily limit. Limit resets in ${Math.floor(withdrawalLimit.resets_in_hours)}h ${Math.floor((withdrawalLimit.resets_in_hours % 1) * 60)}m.` });
        setWithdrawSubmitting(false); return;
      }

      if (totalWithdrawDeduction > activeBalance) {
        const wFeeLabel = amount <= 70000 ? `${formatCurrency(withdrawFee, activeCurrency)} flat fee` : `${formatCurrency(withdrawFee, activeCurrency)} (3%)`;
        setWithdrawStatus({ ok: false, message: `You need ${formatCurrency(totalWithdrawDeduction, activeCurrency)} (includes ${wFeeLabel}). Your balance is ${formatCurrency(activeBalance, activeCurrency)}.` });
        setWithdrawSubmitting(false); return;
      }
      if (minPayout > 0 && amount < minPayout) {
        setWithdrawStatus({ ok: false, message: `Minimum withdrawal is ${formatCurrency(minPayout, activeCurrency)}.` });
        setWithdrawSubmitting(false); return;
      }
      if (maxPayout > 0 && amount > maxPayout) {
        setWithdrawStatus({ ok: false, message: `Maximum withdrawal is ${formatCurrency(maxPayout, activeCurrency)}.` });
        setWithdrawSubmitting(false); return;
      }

      const ref = `W${Date.now().toString(36).toUpperCase()}`.slice(0, 30);

      const apiData = await callObPayAPI({
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
        // Send withdrawal confirmation email
        if (user?.email) {
          supabase.functions.invoke("send-transactional-email", {
            body: {
              email: user.email,
              type: "payout_request_received",
              data: {
                amount: String(amount),
                currency: activeCurrency,
                payment_method: withdrawNetwork === "mtn" ? "MTN Mobile Money" : "Airtel Money",
                full_name: profile?.full_name || "",
              },
            },
          }).then(() => {}, (e: any) => console.warn("[Payouts] Withdraw email failed silently:", e));
        }

        setWithdrawStatus({
          ok: true,
          message: `Withdrawal of ${formatCurrency(amount, activeCurrency)} sent to ${profile.phone_number}! Fee: ${formatCurrency(withdrawFee, activeCurrency)}. Awaiting confirmation.`,
        });
        setWithdrawAmount("");
        setWithdrawDesc("");
        fetchData();
      } else {
        const errMsg = apiData?.error || apiData?.message || "Withdrawal could not be processed.";
        setWithdrawStatus({ ok: false, message: simplifyError(errMsg) });
      }
    } catch (err: any) {
      setWithdrawStatus({ ok: false, message: simplifyError(err.message) });
    } finally { setWithdrawSubmitting(false); }
  };

  const handleVerifyPayoutNumber = async () => {
    if (!form.phoneNumber || form.phoneNumber.length < 9) {
      setPayoutVerifyError("Enter a valid phone number first.");
      return;
    }
    setPayoutVerifying(true);
    setPayoutVerifyError(null);
    setPayoutVerifiedName(null);
    try {
      const data = await invokeObpay({ _action: "verify-number", phoneNumber: form.phoneNumber });
      if (data?.success && data.data?.customer_name) {
        setPayoutVerifiedName(data.data.customer_name);
        setPayoutVerifiedPhone(form.phoneNumber);
      } else {
        setPayoutVerifyError(data?.error || "This number is not registered on mobile money.");
      }
    } catch (err: any) {
      setPayoutVerifyError(err.message || "Verification failed. Try again.");
    } finally {
      setPayoutVerifying(false);
    }
  };

  const handlePayoutPhoneChange = (value: string) => {
    setForm({ ...form, phoneNumber: value });
    if (payoutVerifiedPhone && value !== payoutVerifiedPhone) {
      setPayoutVerifiedName(null);
      setPayoutVerifiedPhone(null);
      setPayoutVerifyError(null);
    }
  };

  const handleVerifyWithdrawNumber = async () => {
    if (!profile?.phone_number) return;
    setWithdrawVerifying(true);
    setWithdrawVerifyError(null);
    setWithdrawVerifiedName(null);
    try {
      const data = await invokeObpay({ _action: "verify-number", phoneNumber: profile.phone_number });
      if (data?.success && data.data?.customer_name) {
        setWithdrawVerifiedName(data.data.customer_name);
      } else {
        setWithdrawVerifyError(data?.error || "This number is not registered on mobile money.");
      }
    } catch (err: any) {
      setWithdrawVerifyError(err.message || "Verification failed. Try again.");
    } finally {
      setWithdrawVerifying(false);
    }
  };

  if (loading) return (<DashboardLayout><div className="flex items-center justify-center py-24"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div></DashboardLayout>);
  if (error) return (<DashboardLayout><div className="text-center py-24"><p className="text-sm text-foreground-800 mb-4">{error}</p><button onClick={fetchData} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">Retry</button></div></DashboardLayout>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Payouts</h1>
            <p className="text-sm text-foreground-600 mt-1">Send money to mobile wallets and bank accounts</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select
                value={activeCurrency}
                onChange={(e) => setActiveCurrency(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm font-medium text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer truncate"
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
            <button onClick={() => setShowModal(true)} className="shrink-0 inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap transition-all bg-accent-500 hover:bg-accent-600 text-background-50 shadow-sm hover:shadow-md">
              <i className="ri-send-plane-line" />New Payout
            </button>
          </div>

        </div>


        {/* Wallet summary - enhanced */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative overflow-hidden bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-background-300/60 transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary-500/5 to-transparent rounded-bl-full" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center"><i className="ri-wallet-3-line text-primary-600 text-lg" /></div>
                <span className="text-xs text-foreground-500 font-medium">Ready to Use</span>
              </div>
              <p className="text-xs text-foreground-500 mb-1">Available Balance</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground-900 break-words">{formatCurrency(activeBalance, activeCurrency)}</p>
            </div>
          </div>
          <div className="relative overflow-hidden bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-background-300/60 transition-all">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-accent-500/5 to-transparent rounded-bl-full" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center"><i className="ri-time-line text-accent-600 text-lg" /></div>
                <span className="text-xs text-foreground-500 font-medium">Processing</span>
              </div>
              <p className="text-xs text-foreground-500 mb-1">Pending Balance</p>
              <p className="text-xl sm:text-2xl font-bold text-accent-600 break-words">{formatCurrency(wallet.pending_balance, activeCurrency)}</p>
            </div>
          </div>
          {withdrawalLimit && (
            <div className="relative overflow-hidden bg-background-50 rounded-xl border border-accent-200/70 p-5 hover:border-accent-300/60 transition-all">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-accent-500/8 to-transparent rounded-bl-full" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center"><i className="ri-speed-up-line text-accent-600 text-lg" /></div>
                  <span className="text-xs text-foreground-500 font-medium">Daily Limit</span>
                </div>
                <p className="text-xs text-foreground-500 mb-1">Withdrawal Limit ({formatCurrency(withdrawalLimit.daily_limit, activeCurrency)} / 24h)</p>
                <div className="flex flex-wrap items-end gap-2">
                  <p className="text-xl sm:text-2xl font-bold text-foreground-900 break-words">{formatCurrency(withdrawalLimit.remaining, activeCurrency)}</p>
                  <span className="text-xs text-foreground-500 mb-0.5">remaining</span>
                </div>
                <div className="mt-2 bg-background-200/70 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${Math.min(100, (withdrawalLimit.used_24h / withdrawalLimit.daily_limit) * 100)}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-x-2 mt-1">
                  <span className="text-[10px] text-foreground-500">Used: {formatCurrency(withdrawalLimit.used_24h, activeCurrency)}</span>
                  <span className="text-[10px] text-foreground-500">Resets in {Math.floor(withdrawalLimit.resets_in_hours)}h {Math.floor((withdrawalLimit.resets_in_hours % 1) * 60)}m</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── PER-CURRENCY BALANCES ───────────────────────── */}
        {Object.keys(balances).filter((c) => balances[c] > 0).length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-coins-line text-primary-600 text-lg" />
              <h3 className="font-heading font-semibold text-sm text-foreground-900">All Currency Balances</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(balances)
                .filter(([, amount]) => amount > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([currency, amount]) => {
                  const info = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
                  return (
                    <button
                      key={currency}
                      onClick={() => setActiveCurrency(currency)}
                      className={`bg-background-50 rounded-xl p-4 border text-left transition-all cursor-pointer min-w-0 ${
                        currency === activeCurrency
                          ? "border-primary-400 ring-1 ring-primary-300"
                          : "border-background-200/70 hover:border-background-300/60"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center">
                          <i className="ri-coins-line text-secondary-600 text-sm" />
                        </div>
                        <span className="text-[10px] font-medium text-foreground-500">
                          {currency === activeCurrency ? "Active" : "Available"}
                        </span>
                      </div>
                      <p className="text-[11px] text-foreground-500 mb-0.5 truncate">{info ? `${info.name} Balance` : `${currency} Balance`}</p>
                      <p className="font-heading font-bold text-sm sm:text-base text-foreground-900 break-words">{formatCurrency(amount, currency)}</p>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {/* ─── WITHDRAW TO MY MOBILE ────────────────────────── */}
        {profile?.phone_number ? (
          <div className="bg-background-50 rounded-xl border border-accent-200/70 overflow-hidden">
            <button
              onClick={() => setShowWithdrawForm(!showWithdrawForm)}
              className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 hover:bg-background-100/50 transition-colors cursor-pointer"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-accent-100 flex items-center justify-center">
                  <i className="ri-smartphone-line text-accent-600 text-xl" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-heading font-semibold text-foreground-900 text-sm">Withdraw to My Mobile</h3>
                  <p className="text-xs text-foreground-500 mt-0.5">
                    Send money directly to your registered number{" "}
                    <span className="font-mono font-medium text-foreground-700 break-all">{profile.phone_number}</span>
                  </p>
                </div>
              </div>
              <div className={`shrink-0 transition-transform ${showWithdrawForm ? "rotate-180" : ""}`}>
                <i className="ri-arrow-down-s-line text-foreground-400" />
              </div>
            </button>

            {showWithdrawForm && (
              <div className="border-t border-accent-200/70 p-4 sm:p-5">
                {withdrawStatus && (
                  <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${withdrawStatus.ok ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>
                    <div className="flex items-start gap-2">
                      <i className={`${withdrawStatus.ok ? "ri-checkbox-circle-line text-emerald-500" : "ri-error-warning-line text-accent-500"} mt-0.5`} />
                      <p>{withdrawStatus.message}</p>
                    </div>
                  </div>
                )}
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1">Your Registered Number</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-background-300/60 bg-background-100 text-sm font-mono text-foreground-700">
                      <i className="ri-smartphone-line text-accent-500" />
                      {profile.phone_number}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground-600 mb-1">Amount ({activeCurrency}) *</label>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={minPayout > 0 ? `Min ${formatCurrency(minPayout, activeCurrency)}` : "50000"}
                        className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                        required
                        min={minPayout || 1000}
                        max={maxPayout || undefined}
                      />
                      {(minPayout > 0 || maxPayout > 0) && (
                        <p className="text-[11px] text-foreground-500 mt-1">
                          {minPayout > 0 && `Min: ${formatCurrency(minPayout, activeCurrency)}`}
                          {minPayout > 0 && maxPayout > 0 && " · "}
                          {maxPayout > 0 && `Max: ${formatCurrency(maxPayout, activeCurrency)}`}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground-600 mb-1">Network</label>
                      <select
                        value={withdrawNetwork}
                        onChange={(e) => setWithdrawNetwork(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-400"
                      >
                        <option value="mtn">MTN Mobile Money</option>
                        <option value="airtel">Airtel Money</option>
                      </select>
                    </div>
                  </div>
                  {withdrawAmount && parseFloat(withdrawAmount) > 0 && (() => {
                    const wAmt = parseFloat(withdrawAmount);
                    const wFee = wAmt <= 70000 ? payoutFlatFee : Math.round(wAmt * (withdrawFeePercent / 100) * 100) / 100;
                    const wTotal = wAmt + wFee;
                    const wFeeLabel = wAmt <= 70000 ? `Flat fee` : `Fee (${withdrawFeePercent}%)`;
                    return (
                    <div className="bg-background-100 rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-foreground-500">Withdrawal Amount</span>
                        <span className="font-semibold text-foreground-900 whitespace-nowrap">{formatCurrency(wAmt, activeCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground-500">{wFeeLabel}</span>
                        <span className="font-medium text-accent-600 whitespace-nowrap">
                          {formatCurrency(wFee, activeCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-background-200/70 pt-1.5">
                        <span className="text-foreground-500 font-medium">Total Deduction</span>
                        <span className="font-bold text-foreground-900 whitespace-nowrap">
                          {formatCurrency(wTotal, activeCurrency)}
                        </span>
                      </div>
                      <p className="text-[10px] text-foreground-400 mt-1">You will receive {formatCurrency(wAmt, activeCurrency)} on your mobile money account. Fee: {wAmt <= 70000 ? `flat ${formatCurrency(payoutFlatFee, activeCurrency)} (under 70K)` : `${withdrawFeePercent}% (over 70K)`}.</p>
                    </div>
                    );
                  })()}
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={withdrawDesc}
                      onChange={(e) => setWithdrawDesc(e.target.value)}
                      placeholder="Withdrawal to my mobile"
                      className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={withdrawSubmitting}
                    className="w-full bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 font-medium py-2.5 rounded-lg transition-colors cursor-pointer text-sm flex items-center justify-center gap-2 min-w-0"
                  >
                    {withdrawSubmitting ? (
                      <><i className="ri-loader-4-line animate-spin" />Processing...</>
                    ) : (
                      <><i className="ri-smartphone-line shrink-0" /><span className="truncate">Withdraw to {profile.phone_number}</span></>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : !profile?.phone_number ? (
          <div className="bg-accent-100 rounded-xl p-4 text-sm text-accent-700 flex items-center gap-3">
            <i className="ri-smartphone-line text-lg" />
            <span>Add your mobile money number in{" "}
              <a href="/dashboard/settings" className="font-medium underline">Profile Settings</a> to enable direct withdrawals.
            </span>
          </div>
        ) : null}

        {/* Merchant Funding Link */}
        {merchantSlug && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-lg bg-primary-100 flex items-center justify-center">
                  <i className="ri-link-m text-primary-600 text-lg" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-semibold text-foreground-900 text-sm">Your Funding Link</h3>
                  <p className="text-xs text-foreground-600 mt-0.5">Share this link with customers to receive payments directly into your ObPay account</p>
                </div>
              </div>
              <button
                onClick={() => setShowFundingQR(!showFundingQR)}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-100 hover:bg-primary-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className={showFundingQR ? "ri-qr-scan-line" : "ri-qr-code-line"} />
                {showFundingQR ? "Hide QR" : "Show QR"}
              </button>
            </div>

            {/* Funding Link URL + Copy */}
            <div className="flex items-center gap-2 mb-4 min-w-0">
              <a
                href={getFundingUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 text-xs bg-background-100 px-3 py-2 rounded-lg text-primary-600 font-mono break-all hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer underline underline-offset-2"
              >
                {getFundingUrl()}
              </a>
              <button
                onClick={copyFundingUrl}
                className="shrink-0 w-10 h-10 rounded-lg bg-background-100 hover:bg-background-200 flex items-center justify-center text-foreground-500 hover:text-primary-600 transition-colors cursor-pointer"
              >
                <i className={copiedFunding ? "ri-check-line text-primary-500" : "ri-file-copy-line"} />
              </button>
            </div>

            {/* QR Code */}
            {showFundingQR && (
              <div className="flex flex-col items-center gap-3 p-4 bg-background-100 rounded-lg">
                <div className="w-40 h-40 sm:w-48 sm:h-48 max-w-full bg-background-50 rounded-lg border border-background-200/70 p-3 flex items-center justify-center">
                  <img loading="lazy" decoding="async"
                    src={getQRCodeUrl(getFundingUrl())}
                    alt="QR Code for funding link"
                    className="w-full h-full object-contain"
                    width={192}
                    height={192}
                  />
                </div>
                <p className="text-xs text-foreground-500 text-center">
                  Scan this QR code to open the funding page. Customers can pay via MTN or Airtel Mobile Money.
                </p>
                <div className="bg-foreground-900 rounded-lg p-3 w-full max-w-xs">
                  <p className="text-[11px] text-foreground-400 mb-2 font-medium">Embed code for your website:</p>
                  <div className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 text-[11px] text-primary-300 font-mono bg-foreground-800 px-3 py-2 rounded-lg break-all select-all">
                      {`<a href="${getFundingUrl()}">Pay with ObPay</a>`}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`<a href="${getFundingUrl()}">Pay with ObPay</a>`)}
                      className="shrink-0 w-8 h-8 rounded-lg bg-foreground-700 hover:bg-foreground-600 flex items-center justify-center text-foreground-300 transition-colors cursor-pointer"
                    >
                      <i className="ri-file-copy-line text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {payouts.length === 0 ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4"><i className="ri-send-plane-line text-foreground-400 text-2xl" /></div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">No payouts yet</h3>
            <p className="text-sm text-foreground-600 mb-4">Send money to suppliers, staff, or customers</p>
            <button onClick={() => setShowModal(true)} className="bg-accent-500 hover:bg-accent-600 text-background-50 px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap">Create First Payout</button>
          </div>
        ) : (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background-200/70">
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Reference</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Recipient</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Fee</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Date</th>
                </tr></thead>
                <tbody>
                  {payouts.map((p) => {
                    const net = getNetworkDisplay(p.network);
                    return (
                      <tr key={p.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-md bg-accent-100 flex items-center justify-center shrink-0">
                              <i className="ri-arrow-up-line text-accent-600 text-xs" />
                            </div>
                            <span className="text-xs font-mono font-medium text-foreground-900">{p.provider_reference || p.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-foreground-900">{p.phone_number}</p>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${net.color} px-1.5 py-0.5 rounded-full mt-0.5`}>
                            <i className={`${net.icon} text-[10px]`} />
                            {net.label}
                          </span>
                        </td>
                        <td className="px-5 py-3"><span className="text-sm font-semibold text-foreground-900">{formatCurrency(p.amount, p.currency || activeCurrency)}</span></td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-accent-600 font-medium">
                            {p.fee_amount ? formatCurrency(p.fee_amount, p.currency || activeCurrency) : `~${formatCurrency(Math.round(p.amount * (feePercent / 100) * 100) / 100, p.currency || activeCurrency)}`}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${p.status === "success" ? "bg-emerald-100 text-emerald-700" : p.status === "pending" ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"}`}>{p.status}</span>
                        </td>
                        <td className="px-5 py-3 text-right"><span className="text-xs text-foreground-500">{formatDate(p.requested_at)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* New Payout Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => setShowModal(false)} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-lg animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-semibold text-lg text-foreground-900">New Payout</h3>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg hover:bg-background-200 flex items-center justify-center text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer">
                  <i className="ri-close-line" />
                </button>
              </div>
              {submitStatus && (
                <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${submitStatus.ok ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>
                  <div className="flex items-start gap-2">
                    <i className={`${submitStatus.ok ? "ri-checkbox-circle-line text-emerald-500" : "ri-error-warning-line text-accent-500"} mt-0.5`} />
                    <div className="flex-1">
                      <p>{submitStatus.message}</p>
                      {!submitStatus.ok && submitStatus.message.toLowerCase().includes("session") && (
                        <button
                          type="button"
                          onClick={refreshSession}
                          disabled={submitting}
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent-800 underline hover:no-underline cursor-pointer"
                        >
                          <i className="ri-refresh-line" />
                          {submitting ? "Refreshing..." : "Refresh Session"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Recipient Phone *</label>
                  <div className="flex items-center gap-2 min-w-0">
                    <input type="text" value={form.phoneNumber} onChange={(e) => handlePayoutPhoneChange(e.target.value)} placeholder="e.g. +256771234567" className="min-w-0 flex-1 px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required />
                    <button
                      type="button"
                      onClick={handleVerifyPayoutNumber}
                      disabled={payoutVerifying || !form.phoneNumber || form.phoneNumber.length < 9}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary-100 hover:bg-secondary-200 disabled:opacity-40 text-secondary-700 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {payoutVerifying ? <><i className="ri-loader-4-line animate-spin" />Checking...</> : <><i className="ri-user-search-line" />Verify</>}
                    </button>
                  </div>
                  {payoutVerifiedName && payoutVerifiedPhone === form.phoneNumber && (
                    <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                      <i className="ri-check-line" />
                      <span className="font-medium">{payoutVerifiedName}</span>
                    </p>
                  )}
                  {payoutVerifyError && (
                    <p className="text-xs text-accent-600 mt-1.5 flex items-center gap-1">
                      <i className="ri-error-warning-line" />
                      {payoutVerifyError}
                    </p>
                  )}
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1">Amount ({form.currency}) *</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={minPayout > 0 ? `Min ${formatCurrency(minPayout, form.currency)}` : "50000"} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required min={minPayout || 1000} max={maxPayout || undefined} />
                    {(minPayout > 0 || maxPayout > 0) && (
                      <p className="text-[11px] text-foreground-500 mt-1">
                        {minPayout > 0 && `Min: ${formatCurrency(minPayout, form.currency)}`}
                        {minPayout > 0 && maxPayout > 0 && " · "}
                        {maxPayout > 0 && `Max: ${formatCurrency(maxPayout, form.currency)}`}
                      </p>
                    )}
                  </div>
                  <div><label className="block text-xs font-medium text-foreground-600 mb-1">Currency</label>
                    <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400">
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-foreground-500 mt-1">Select the payout currency</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div><label className="block text-xs font-medium text-foreground-600 mb-1">Network</label>
                    <select value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="airtel">Airtel Money</option>
                    </select>
                    <p className="text-[11px] text-foreground-500 mt-1">Mobile money networks supported by our payment provider</p>
                  </div>
                </div>
                {form.amount && parseFloat(form.amount) > 0 && (() => {
                  const pAmt = parseFloat(form.amount);
                  const pFee = pAmt <= 70000 ? payoutFlatFee : Math.round(pAmt * (withdrawFeePercent / 100) * 100) / 100;
                  const pTotal = pAmt + pFee;
                  const pFeeLabel = pAmt <= 70000 ? 'Flat fee' : `Fee (${withdrawFeePercent}%)`;
                  return (
                  <div className="bg-background-100 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-foreground-500">Payout Amount</span><span className="font-semibold text-foreground-900 whitespace-nowrap">{formatCurrency(pAmt, form.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-foreground-500">{pFeeLabel}</span><span className="font-medium text-accent-600 whitespace-nowrap">{formatCurrency(pFee, form.currency)}</span></div>
                    <div className="flex justify-between border-t border-background-200/70 pt-1.5"><span className="text-foreground-500 font-medium">Total Deduction</span><span className="font-bold text-foreground-900 whitespace-nowrap">{formatCurrency(pTotal, form.currency)}</span></div>
                    <p className="text-[10px] text-foreground-400 mt-1">{pAmt <= 70000 ? `Flat fee of ${formatCurrency(payoutFlatFee, form.currency)} for amounts under 70K.` : `${withdrawFeePercent}% fee for amounts over 70K.`} The recipient receives {formatCurrency(pAmt, form.currency)} on their mobile money account.</p>
                  </div>
                  );
                })()}
                <div><label className="block text-xs font-medium text-foreground-600 mb-1">Reference (optional)</label><input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Auto-generated if empty" className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" /></div>
                <div><label className="block text-xs font-medium text-foreground-600 mb-1">Description *</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Salary payment / Supplier payment" rows={2} maxLength={200} required className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm">{submitting ? "Processing..." : "Send Payout"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}