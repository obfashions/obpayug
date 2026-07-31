import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase, safeGetSession } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, formatDate } from "@/lib/currency";

interface Transaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  customer_phone: string;
  customer_name: string;
  fee_amount: number;
  net_amount: number;
  provider_reference: string;
  description: string;
  created_at: string;
  completed_at: string;
}

interface WalletData {
  available_balance: number;
  pending_balance: number;
  total_collections: number;
  total_payouts: number;
  currency: string;
}

function formatCompact(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
}

export default function CollectionsPage() {
  const { user, profile } = useAuth();
  const { activeCurrency } = useCurrency();
  const [collections, setCollections] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ phoneNumber: "", amount: "", currency: "UGX", network: "mtn", description: "", reference: "" });

  // Network options per currency (per MarzPay docs)
  const networkOptions: Record<string, { value: string; label: string }[]> = {
    UGX: [
      { value: "mtn", label: "MTN Mobile Money" },
      { value: "airtel", label: "Airtel Money" },
    ],
    KES: [
      { value: "safaricom", label: "M-Pesa (Safaricom)" },
      { value: "airtel", label: "Airtel Money" },
    ],
    GHS: [
      { value: "mtn", label: "MTN Mobile Money" },
      { value: "airteltigo", label: "AirtelTigo" },
      { value: "vodafone", label: "Vodafone Cash" },
    ],
    XAF: [
      { value: "mtn", label: "MTN Mobile Money" },
      { value: "orange", label: "Orange Money" },
    ],
  };

  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ ok: boolean; message: string; livepayResponse?: string } | null>(null);
  const [feePercent, setFeePercent] = useState(5);
  const [minCollection, setMinCollection] = useState(0);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState("");
  const [lastRef, setLastRef] = useState("");
  const [lastStatus, setLastStatus] = useState<"pending" | "success" | "failed" | "">("");
  const [lastAmount, setLastAmount] = useState(0);
  const lastRefRef = useRef(lastRef);
  const lastAmountRef = useRef(lastAmount);
  const lastStatusRef = useRef(lastStatus);
  const submitStatusRef = useRef(submitStatus);
  useEffect(() => { lastRefRef.current = lastRef; }, [lastRef]);
  useEffect(() => { lastAmountRef.current = lastAmount; }, [lastAmount]);
  useEffect(() => { lastStatusRef.current = lastStatus; }, [lastStatus]);
  useEffect(() => { submitStatusRef.current = submitStatus; }, [submitStatus]);

  const isVerified = profile?.status === "active";

  const callObpay = async (body: Record<string, any>): Promise<{ success: boolean; data?: any; error?: string; [key: string]: any }> => {
    try {
      const { data: sessionData } = await safeGetSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        return { success: false, error: "Session expired. Please log in again." };
      }
      const baseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
      const url = `${baseUrl}/functions/v1/obpay-api-no-jwt`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify(body),
      });
      const text = await resp.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { success: false, error: text || `Server error (HTTP ${resp.status})` };
      }
      return parsed;
    } catch (err: any) {
      return { success: false, error: err.message || "Network error. Check your connection." };
    }
  };

  const checkTrackedTxn = useCallback((txnList: Transaction[]) => {
    const trackedRef = lastRefRef.current;
    if (!trackedRef) return;
    const tracked = txnList.find(t => t.reference === trackedRef);
    if (!tracked) return;
    const currentStatus = lastStatusRef.current;
    if (tracked.status !== currentStatus && tracked.status !== "pending") {
      if (tracked.status === "success") {
        setLastStatus("success");
        setSubmitStatus({
          ok: true,
          message: `Payment received! ${formatCurrency(tracked.amount || lastAmountRef.current || 0, tracked.currency || activeCurrency)} has been credited to your wallet.`,
          livepayResponse: `Ref: ${trackedRef} | Status: success`,
        });
      } else if (tracked.status === "failed") {
        setLastStatus("failed");
        setSubmitStatus({
          ok: false,
          message: "Payment failed. The customer may have declined or had insufficient funds.",
          livepayResponse: `Ref: ${trackedRef} | Status: failed`,
        });
      }
    }
  }, []);

  const hasDataRef = useRef(false);
  useEffect(() => { hasDataRef.current = collections.length > 0; }, [collections]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const hadData = hasDataRef.current;
    setLoading(true); if (!hadData) setError("");
    try {
      const [txnRes, walletRes, psRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id).eq("type", "collection").order("created_at", { ascending: false }).limit(50),
        supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("platform_settings").select("platform_fee_percent, min_collection_amount").limit(1).maybeSingle(),
      ]);
      if (txnRes.error) throw txnRes.error;
      setCollections((txnRes.data as Transaction[]) || []);
      setWallet(walletRes.data as WalletData | null);
      if (psRes.data?.platform_fee_percent) setFeePercent(psRes.data.platform_fee_percent);
      if (psRes.data?.min_collection_amount) setMinCollection(psRes.data.min_collection_amount);
      setError("");
    } catch (err: any) {
      if (!hadData) {
        setError(err.message);
      } else {
        // Refresh failed but we already have data — show a transient banner instead of wiping the page
        setSubmitStatus({ ok: false, message: `Refresh failed: ${err.message}. Data shown may be stale.` });
      }
    }
    finally { setLoading(false); }
  }, [user]);

  const silentRefresh = useCallback(async () => {
    if (!user) return;
    try {
      const [txnRes, walletRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id).eq("type", "collection").order("created_at", { ascending: false }).limit(50),
        supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!txnRes.error && txnRes.data) {
        setCollections(txnRes.data as Transaction[]);
        checkTrackedTxn(txnRes.data as Transaction[]);
      }
      if (!walletRes.error && walletRes.data) setWallet(walletRes.data as WalletData);
    } catch { /* silent */ }
  }, [user, checkTrackedTxn]);

  // Silent background sync every 3s when there are pending transactions
  const hasPendingRef = useRef(false);
  useEffect(() => { hasPendingRef.current = collections.some(c => c.status === "pending"); }, [collections]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (hasPendingRef.current) {
        callObpay({ _action: "sync-all-pending" })
          .then((result) => {
            if (result.success && result.data?.updated && result.data.updated.length > 0) {
              silentRefresh();
            }
          })
          .then(undefined, () => {});
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user, silentRefresh]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync pending transactions on page load (catch up on payments from while user was away)
  useEffect(() => {
    if (!user || loading) return;
    callObpay({ _action: "sync-all-pending" })
      .then((result) => {
        if (result.success && result.data?.updated && result.data.updated.length > 0) {
          silentRefresh();
        }
      })
      .then(undefined, () => {});
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("collections-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_wallets", filter: `user_id=eq.${user.id}` }, () => {
        supabase.from("merchant_wallets").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => { if (data) setWallet(data as WalletData); }).then(undefined, () => {});
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, (payload) => {
        const newStatus = (payload.new as any).status;
        const oldStatus = (payload.old as any).status;
        const ref = (payload.new as any).reference;
        const txnAmount = (payload.new as any).amount;
        const trackedRef = lastRefRef.current;
        const currentTrackedStatus = lastStatusRef.current;
        if (ref === trackedRef && newStatus !== oldStatus && newStatus !== "pending" && newStatus !== currentTrackedStatus) {
          if (newStatus === "success") {
            setLastStatus("success");
            setSubmitStatus({
              ok: true,
              message: `Payment received! ${formatCurrency(txnAmount || lastAmountRef.current || 0, activeCurrency)} has been credited to your wallet.`,
              livepayResponse: `Ref: ${ref} | Status: success`,
            });
          } else if (newStatus === "failed") {
            setLastStatus("failed");
            setSubmitStatus({
              ok: false,
              message: "Payment failed. The customer may have declined or had insufficient funds.",
              livepayResponse: `Ref: ${ref} | Status: failed`,
            });
          }
        }
        if (newStatus !== "pending") silentRefresh();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, silentRefresh]);

  const successTxns = collections.filter(c => c.status === "success");
  const pendingTxns = collections.filter(c => c.status === "pending");
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayCollections = successTxns.filter(c => new Date(c.created_at) >= todayStart).reduce((s, c) => s + c.amount, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthlyNet = successTxns.filter(c => new Date(c.created_at) >= monthStart).reduce((s, c) => s + (c.net_amount || c.amount), 0);
  const totalFees = successTxns.reduce((s, c) => s + (c.fee_amount || 0), 0);

  const amountNum = parseFloat(form.amount) || 0;
  const isBelowMin = minCollection > 0 && amountNum > 0 && amountNum < minCollection;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true); setSubmitStatus(null);
    try {
      const amount = parseFloat(form.amount);
      if (!form.phoneNumber || isNaN(amount) || amount <= 0) {
        setSubmitStatus({ ok: false, message: "Please fill all required fields correctly." });
        setSubmitting(false); return;
      }
      if (minCollection > 0 && amount < minCollection) {
        setSubmitStatus({ ok: false, message: `Minimum collection amount is ${formatCurrency(minCollection, form.currency)}. You entered ${formatCurrency(amount, form.currency)}.` });
        setSubmitting(false); return;
      }
      const ref = form.reference.trim() || `C${Date.now().toString(36).toUpperCase()}`.slice(0, 30);
      const result = await callObpay({ _action: "collect", phoneNumber: form.phoneNumber, amount, currency: form.currency, network: form.network, description: form.description, customerName: verifiedName || "", reference: ref });
      if (!result.success) {
        setSubmitStatus({ ok: false, message: result.error || "Payment provider declined the request" });
        setSubmitting(false); return;
      }
      const apiData = result.data;
      if (apiData?.success) {
        const livepayMsg = apiData.data?.message || "";
        const refNum = apiData.data?.reference || ref;
        const immediateSuccess = apiData.data?.immediate_success === true;
        setLastRef(refNum);
        setLastStatus(immediateSuccess ? "success" : "pending");
        setLastAmount(amount);
        setSubmitStatus({
          ok: true,
          message: immediateSuccess
            ? `Collection successful! ${formatCurrency(amount, form.currency)} credited to your wallet.`
            : (livepayMsg || "Collection request sent. Awaiting customer confirmation."),
          livepayResponse: `Ref: ${refNum} | Status: ${apiData.data?.status || "pending"}${immediateSuccess ? " | Paid immediately" : ""}`,
        });
        setForm({ phoneNumber: "", amount: "", currency: "UGX", network: "mtn", description: "", reference: "" });
        setVerifiedName(null); setVerifyError("");
        silentRefresh();
        // Aggressive post-submit poll: query specific transaction by ref every 2s for 20s
        const pollRef = refNum;
        let pollCount = 0;
        const pollInterval = setInterval(() => {
          pollCount++;
          supabase.from("transactions")
            .select("*")
            .eq("reference", pollRef)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                const txn = data as Transaction;
                if (txn.status !== "pending" && lastStatusRef.current === "pending") {
                  checkTrackedTxn([txn]);
                  clearInterval(pollInterval);
                }
              }
              if (pollCount >= 10) clearInterval(pollInterval);
            })
            .then(undefined, () => {});
        }, 2000);
      } else {
        let errMsg = apiData?.error || apiData?.message || "Collection request was rejected.";
        if (errMsg.toLowerCase().includes("session token") || errMsg.toLowerCase().includes("unauthorized")) {
          errMsg = "Session validation failed. Please refresh session or log out and back in.";
        }
        setSubmitStatus({ ok: false, message: errMsg });
      }
    } catch (err: any) { setSubmitStatus({ ok: false, message: err.message || "Failed to create collection" }); }
    finally { setSubmitting(false); }
  };

  const refreshSession = async () => {
    setSubmitStatus(null); setSubmitting(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      setSubmitStatus(error ? { ok: false, message: `Could not refresh session: ${error.message}` } : { ok: true, message: "Session refreshed. Try again." });
    } catch (err: any) { setSubmitStatus({ ok: false, message: err.message || "Failed" }); }
    finally { setSubmitting(false); }
  };

  const handleVerifyPhone = async () => {
    const phone = form.phoneNumber.trim();
    if (!phone) return;
    setVerifyingPhone(true);
    setVerifyError("");
    setVerifiedName(null);
    try {
      const result = await callObpay({ _action: "verify-phone", phoneNumber: phone });
      if (result.success && result.data?.customer_name) {
        setVerifiedName(result.data.customer_name);
      } else {
        setVerifyError(result.error || result.data?.message || "Could not verify this number. It may not be registered for mobile money.");
        setVerifiedName(null);
      }
    } catch {
      setVerifyError("Unable to verify phone number right now. Please try again.");
      setVerifiedName(null);
    } finally {
      setVerifyingPhone(false);
    }
  };

  if (loading) return (<DashboardLayout><div className="flex items-center justify-center py-24"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div></DashboardLayout>);
  if (error) return (<DashboardLayout><div className="text-center py-24"><p className="text-sm text-foreground-800 mb-4">{error}</p><button onClick={fetchData} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">Retry</button></div></DashboardLayout>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h1 className="font-heading font-bold text-2xl text-foreground-900">Collections</h1><p className="text-sm text-foreground-600 mt-1">Initiate and track payment collections from customers</p></div>
          <button onClick={() => setShowModal(true)} disabled={!isVerified} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap transition-colors ${isVerified ? "bg-primary-500 hover:bg-primary-600 text-background-50" : "bg-background-200 text-foreground-400 cursor-not-allowed"}`}>
            <i className="ri-add-line" />New Collection
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 hover:border-background-300/60 transition-all">
            <div className="flex items-center justify-between mb-2"><div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center"><i className="ri-wallet-3-line text-primary-600 text-lg" /></div><span className="text-[11px] text-foreground-400">Ready to use</span></div>
            <p className="text-xs text-foreground-500 mb-0.5">Available Balance</p>
            <p className="font-heading font-bold text-xl text-foreground-900">{formatCurrency(wallet?.available_balance || 0, activeCurrency)}</p>
          </div>
          <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 hover:border-background-300/60 transition-all">
            <div className="flex items-center justify-between mb-2"><div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center"><i className="ri-time-line text-accent-600 text-lg" /></div><span className="text-[11px] text-foreground-400">{pendingTxns.length} pending</span></div>
            <p className="text-xs text-foreground-500 mb-0.5">Pending Balance</p>
            <p className="font-heading font-bold text-xl text-foreground-900">{formatCurrency(wallet?.pending_balance || 0, activeCurrency)}</p>
          </div>
          <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 hover:border-background-300/60 transition-all">
            <div className="flex items-center justify-between mb-2"><div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><i className="ri-arrow-down-circle-line text-emerald-600 text-lg" /></div><span className="text-[11px] text-foreground-400">Today</span></div>
            <p className="text-xs text-foreground-500 mb-0.5">Today&apos;s Collections</p>
            <p className="font-heading font-bold text-xl text-foreground-900">{formatCurrency(todayCollections, activeCurrency)}</p>
          </div>
          <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 hover:border-background-300/60 transition-all">
            <div className="flex items-center justify-between mb-2"><div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center"><i className="ri-subtract-line text-red-600 text-lg" /></div><span className="text-[11px] text-foreground-400">Month net</span></div>
            <p className="text-xs text-foreground-500 mb-0.5">Monthly Collections</p>
            <p className="font-heading font-bold text-xl text-primary-600">{formatCompact(monthlyNet)}</p>
          </div>
        </div>

        {!isVerified && (
          <div className="bg-accent-100 rounded-xl p-4 text-sm text-accent-700 flex items-center gap-3">
            <i className="ri-lock-line text-lg" /><span>Complete KYC verification to unlock collections. <a href="/dashboard/kyc" className="font-medium underline">Verify now →</a></span>
          </div>
        )}

        {submitStatus && (
          <div className={`rounded-lg px-4 py-3 text-sm ${submitStatus.ok ? "bg-primary-100 text-primary-700 border border-primary-200/70" : "bg-accent-100 text-accent-700 border border-accent-200/70"}`}>
            <div className="flex items-start gap-2">
              <i className={`${submitStatus.ok ? "ri-check-line text-primary-600" : "ri-error-warning-line text-accent-600"} mt-0.5`} />
              <div className="space-y-1 w-full min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium break-words">{submitStatus.message}</p>
                  <button
                    onClick={() => { setSubmitStatus(null); setLastRef(""); setLastStatus(""); }}
                    className="shrink-0 text-foreground-400 hover:text-foreground-600 cursor-pointer p-0.5 -mt-0.5"
                    title="Dismiss"
                  >
                    <i className="ri-close-line text-base" />
                  </button>
                </div>
                {submitStatus.livepayResponse && <p className="text-xs opacity-80">{submitStatus.livepayResponse}</p>}
                {!submitStatus.ok && submitStatus.message.toLowerCase().includes("session") && (
                  <button type="button" onClick={refreshSession} disabled={submitting} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent-800 underline hover:no-underline cursor-pointer"><i className="ri-refresh-line" />{submitting ? "Refreshing..." : "Refresh Session"}</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic Result Panel */}

        {collections.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{successTxns.length} Successful</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse" />{pendingTxns.length} Pending</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />{collections.filter(c => c.status === "failed").length} Failed</span>
            <span className="ml-auto">Total fees: {formatCurrency(totalFees, activeCurrency)}</span>
          </div>
        )}

        {collections.length === 0 ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4"><i className="ri-download-cloud-line text-foreground-400 text-2xl" /></div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">No collections yet</h3>
            <p className="text-sm text-foreground-600 mb-4">Start collecting payments from your customers</p>
            {isVerified && <button onClick={() => setShowModal(true)} className="bg-primary-500 hover:bg-primary-600 text-background-50 px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap">Create First Collection</button>}
          </div>
        ) : (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background-200/70">
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Reference</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Gross</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Credited</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Net</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Date</th>
                  <th className="px-5 py-3" />
                </tr></thead>
                <tbody>
                  {collections.map((c) => (
                    <tr key={c.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                      <td className="px-5 py-3"><span className="text-xs font-mono font-medium text-foreground-900">{c.reference}</span></td>
                      <td className="px-5 py-3"><p className="text-sm text-foreground-900">{c.customer_name || c.customer_phone || "—"}</p><p className="text-xs text-foreground-500">{c.customer_phone && c.customer_name ? c.customer_phone : c.payment_method}</p></td>
                      <td className="px-5 py-3"><span className="text-sm font-semibold text-foreground-900">{formatCurrency(c.amount, c.currency || activeCurrency)}</span></td>
                      <td className="px-5 py-3"><span className="text-xs text-emerald-600 font-medium">{c.fee_amount ? formatCurrency(c.fee_amount, c.currency || activeCurrency) : "Free"}</span></td>
                      <td className="px-5 py-3"><span className="text-sm font-medium text-primary-600">{c.net_amount ? formatCurrency(c.net_amount, c.currency || activeCurrency) : formatCurrency(c.amount, c.currency || activeCurrency)}</span></td>
                      <td className="px-5 py-3 text-center"><span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${c.status === "success" ? "bg-emerald-100 text-emerald-700" : c.status === "pending" ? "bg-accent-100 text-accent-700" : "bg-red-100 text-red-700"}`}>{c.status}</span></td>
                      <td className="px-5 py-3 text-right"><span className="text-xs text-foreground-500">{formatDate(c.created_at)}</span></td>
                      <td className="px-5 py-3"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => setShowModal(false)} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-4">New Collection</h3>

              {submitStatus && (
                <div className={`rounded-lg px-4 py-3 mb-4 text-sm ${submitStatus.ok ? "bg-primary-100 text-primary-700 border border-primary-200/70" : "bg-accent-100 text-accent-700 border border-accent-200/70"}`}>
                  <div className="flex items-start gap-2">
                    <i className={`${submitStatus.ok ? "ri-check-line text-primary-600" : "ri-error-warning-line text-accent-600"} mt-0.5 shrink-0`} />
                    <div className="space-y-1 w-full min-w-0">
                      <p className="font-medium break-words">{submitStatus.message}</p>
                      {submitStatus.livepayResponse && <p className="text-xs opacity-80">{submitStatus.livepayResponse}</p>}
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Customer Phone *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.phoneNumber}
                      onChange={(e) => { setForm({ ...form, phoneNumber: e.target.value }); setVerifiedName(null); setVerifyError(""); }}
                      placeholder="e.g. 2567XXXXXXXX"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleVerifyPhone}
                      disabled={verifyingPhone || !form.phoneNumber.trim()}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-lg bg-background-100 hover:bg-background-200 border border-background-300/60 text-xs font-medium text-foreground-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {verifyingPhone ? (
                        <><i className="ri-loader-4-line animate-spin text-sm" /><span className="hidden sm:inline">Checking...</span></>
                      ) : (
                        <><i className="ri-user-search-line" /><span className="hidden sm:inline">Verify</span></>
                      )}
                    </button>
                  </div>
                  {verifyingPhone && <p className="text-xs text-foreground-500 mt-1">Looking up account name...</p>}
                  {verifiedName && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                      <i className="ri-checkbox-circle-fill" /> Registered to: <strong>{verifiedName}</strong>
                    </p>
                  )}
                  {verifyError && (
                    <p className="text-xs text-accent-600 mt-1 flex items-center gap-1">
                      <i className="ri-error-warning-line" /> {verifyError}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1">Amount *</label>
                    <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={minCollection > 0 ? `Min ${formatCurrency(minCollection, form.currency)}` : "50000"} className={`w-full px-3 py-2 rounded-lg border bg-background-50 text-sm focus:outline-none focus:ring-2 ${isBelowMin ? "border-accent-400 focus:ring-accent-400" : "border-background-300/60 focus:ring-primary-400"}`} required min={minCollection || 1000} />
                    {isBelowMin && <p className="text-[11px] text-accent-600 mt-1">Minimum collection: {formatCurrency(minCollection, form.currency)}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1">Currency</label>
                    <select
                      value={form.currency}
                      onChange={(e) => {
                        const newCurrency = e.target.value;
                        const defaultNet = networkOptions[newCurrency]?.[0]?.value || "mtn";
                        setForm({ ...form, currency: newCurrency, network: defaultNet });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      <option value="UGX">UGX — Uganda</option>
                      <option value="KES">KES — Kenya</option>
                      <option value="GHS">GHS — Ghana</option>
                      <option value="XAF">XAF — Cameroon</option>
                    </select>
                  </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-foreground-600 mb-1">Network</label>
                    <select
                      value={form.network}
                      onChange={(e) => setForm({ ...form, network: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      {(networkOptions[form.currency] || networkOptions.UGX).map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                {minCollection > 0 && (
                  <p className="text-[11px] text-foreground-500 -mt-2">Platform minimum collection: <strong>{formatCurrency(minCollection, form.currency)}</strong></p>
                )}
                {amountNum > 0 && !isBelowMin && (
                  <div className="bg-background-100 rounded-lg p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-foreground-500">Collection Amount</span><span className="font-semibold text-foreground-900 whitespace-nowrap">{formatCurrency(amountNum, form.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-foreground-500">Fee</span><span className="font-medium text-emerald-600 whitespace-nowrap">No fee on collection</span></div>
                    <div className="flex justify-between border-t border-background-200/70 pt-1.5"><span className="text-foreground-500 font-medium">You Receive</span><span className="font-bold text-primary-700 whitespace-nowrap">{formatCurrency(amountNum, form.currency)}</span></div>
                    <p className="text-[10px] text-foreground-400 mt-1">The platform fee ({feePercent}%) will only be deducted when you withdraw to mobile money — not during collection.</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Reference (optional)</label>
                  <input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Auto-generated if empty" className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Description *</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Payment for invoice #123" rows={2} maxLength={200} required className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowModal(false); setVerifiedName(null); setVerifyError(""); setSubmitStatus(null); }} className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm">Cancel</button>
                  <button type="submit" disabled={submitting || isBelowMin} className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm">{submitting ? "Processing..." : "Send Collection"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}