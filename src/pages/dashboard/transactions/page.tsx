import { useState, useEffect, useCallback, useRef } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { invokeObpay } from "@/lib/edge-function";
import { formatCurrency, formatDate } from "@/lib/currency";
import { listPaymentRecords } from "@/lib/history.functions";
import { getAccessToken } from "@/lib/session-token";

async function withRecords(base: any[], opts: { type: string; status: string; search: string }) {
  try {
    const accessToken = await getAccessToken();
    const res: any = await listPaymentRecords({ data: { accessToken, type: opts.type === "all" ? "" : opts.type, status: opts.status === "all" ? "" : opts.status, search: opts.search } });
    const records = new Map<string, any>((res?.rows || []).map((r: any) => [r.reference, r]));
    base = base.map((t) => {
      const record = records.get(t.reference);
      return record ? { ...t, fee_amount: record.fee_amount, net_amount: record.net_amount, balance_before: record.balance_before ?? t.metadata?.balance_before, balance_after: record.balance_after ?? t.metadata?.balance_after } : t;
    });
    const seen = new Set(base.map((t) => t.reference));
    const extra = (res?.rows || []).filter((r: any) => !seen.has(r.reference));
    return [...base, ...extra].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  } catch { return base; }
}

interface Transaction {
  id: string; reference: string; amount: number; currency: string; status: string; type: string;
  payment_method: string; customer_phone: string; customer_name: string; fee_amount: number; net_amount: number;
  provider_reference: string; description: string; created_at: string; completed_at: string;
  balance_before?: number | null; balance_after?: number | null;
  metadata?: { balance_before?: number; balance_after?: number };
}

interface Toast {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const { activeCurrency } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "collection" | "payout">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "pending" | "failed">("all");
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      let q = supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("type", filter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search) q = q.or(`reference.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%`);
      const { data, error: fErr } = await q;
      if (fErr) throw fErr;
      setTransactions(await withRecords((data as Transaction[]) || [], { type: filter, status: statusFilter, search }) as Transaction[]);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [user, filter, statusFilter, search]);

  // Silent refresh — no loading spinner
  const silentRefresh = useCallback(async () => {
    if (!user) return;
    try {
      let q = supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
      if (filter !== "all") q = q.eq("type", filter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (search) q = q.or(`reference.ilike.%${search}%,customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%`);
      const { data, error } = await q;
      if (!error && data) {
        setTransactions(await withRecords(data as Transaction[], { type: filter, status: statusFilter, search }) as Transaction[]);
      }
    } catch {
      // silent fail
    }
  }, [user, filter, statusFilter, search]);

  /**
   * Check ALL pending transactions at once via the payment provider.
   * Returns true if any transaction was updated.
   */
  const checkAllPending = useCallback(async (): Promise<boolean> => {
    try {
      const data = await invokeObpay({ _action: "sync-all-pending" });

      if (!data?.success) {
        console.warn("[checkAllPending] Edge function error:", data?.error);
        return false;
      }

      const updated = data?.updated || [];
      if (updated.length > 0) {
        await silentRefresh();
        // Show toasts for updated transactions
        for (const u of updated) {
          const t = transactions.find(tx => tx.reference === u.reference);
          if (u.status === "success") {
            addToast("success", `Payment confirmed! ${formatCurrency(t?.amount || 0)} credited to your wallet.`);
          } else if (u.status === "failed") {
            addToast("error", `Payment ${u.reference} failed.`);
          }
        }
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("[checkAllPending] Network error:", err.message || err);
      return false;
    }
  }, [transactions, silentRefresh, addToast]);

  // Auto-sync on page load — immediately check all pending
  useEffect(() => {
    if (!user || loading) return;
    checkAllPending();
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-poll: every 3 seconds, bulk-check all pending (no debounce — fast)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const pendingCount = transactions.filter(t => t.status === "pending").length;
      if (pendingCount === 0) return;
      await checkAllPending();
    }, 3000);
    return () => clearInterval(interval);
  }, [user, transactions, checkAllPending]);

  // DB refresh every 3 seconds — catches webhook/sync updates instantly
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const pendingCount = transactions.filter(t => t.status === "pending").length;
      if (pendingCount > 0) {
        silentRefresh();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [user, transactions, silentRefresh]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const exportCSV = () => {
    const headers = ["Reference","Type","Amount","Fee","Net","Balance before","Balance after","Currency","Status","Payment Method","Customer","Date"];
    const rows = transactions.map((t) => [t.reference, t.type, t.amount, t.fee_amount ?? "", t.net_amount ?? "", t.balance_before ?? t.metadata?.balance_before ?? "", t.balance_after ?? t.metadata?.balance_after ?? "", t.currency, t.status, t.payment_method, t.customer_phone||t.customer_name||"", formatDate(t.created_at)]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `obpay-transactions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const pendingCount = transactions.filter(t => t.status === "pending").length;

  if (loading) return (<DashboardLayout><div className="flex items-center justify-center py-24"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div></DashboardLayout>);
  if (error) return (<DashboardLayout><div className="text-center py-24"><p className="text-sm mb-4">{error}</p><button onClick={fetchTransactions} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button></div></DashboardLayout>);

  return (
    <DashboardLayout>
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-sm font-medium shadow-sm border transition-all animate-[fadeSlideIn_0.3s_ease-out] ${
            t.type === "success" ? "bg-primary-100 text-primary-800 border-primary-200" :
            t.type === "error" ? "bg-red-100 text-red-800 border-red-200" :
            "bg-accent-100 text-accent-800 border-accent-200"
          }`}>
            <div className="flex items-center gap-2">
              <i className={`${t.type === "success" ? "ri-check-line text-primary-600" : t.type === "error" ? "ri-error-warning-line text-red-600" : "ri-information-line text-accent-600"}`} />
              <span>{t.message}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Transactions</h1>
            <div className="text-xs text-foreground-600 mt-1">
              {pendingCount > 0
                ? `You have ${pendingCount} pending transaction${pendingCount > 1 ? "s" : ""}. Status syncs automatically every few seconds — no action needed.`
                : "All transactions are confirmed."}
            </div>
          </div>
          <button onClick={exportCSV} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-background-300/60 text-sm text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"><i className="ri-download-line" />Export CSV</button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-1 bg-background-200/70 rounded-full p-1">
            {(["all","collection","payout"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap capitalize ${filter===f?"bg-background-50 text-foreground-900":"text-foreground-500 hover:text-foreground-700"}`}>{f}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-background-200/70 rounded-full p-1">
            {(["all","success","pending","failed"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap capitalize ${statusFilter===s?"bg-background-50 text-foreground-900":"text-foreground-500 hover:text-foreground-700"}`}>{s}</button>
            ))}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by reference or phone..." className="pl-9 pr-4 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-full sm:w-64" />
          </div>
        </div>

        {/* Pending banner — info only, no manual button */}
        {pendingCount > 0 && (
          <div className="bg-accent-100/80 border border-accent-200/60 rounded-lg px-4 py-3 flex items-center gap-3">
            <i className="ri-time-line text-accent-600 text-lg" />
            <p className="text-sm text-accent-800">
              <strong>{pendingCount}</strong> pending transaction(s). Auto-checking every 3 seconds — status will update automatically.
            </p>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4"><i className="ri-exchange-line text-foreground-400 text-2xl" /></div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">No transactions found</h3>
            <p className="text-sm text-foreground-600">{filter !== "all" || statusFilter !== "all" ? "Try adjusting your filters" : "Your transaction history will appear here"}</p>
          </div>
        ) : (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background-200/70">
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Reference</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Gross</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Fee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Net</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase whitespace-nowrap">Balance before</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-foreground-500 uppercase whitespace-nowrap">Balance after</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-foreground-500 uppercase">Date</th>
                </tr></thead>
                <tbody>
                  {transactions.map((t) => {
                    const adminAdjustment = t.payment_method === "admin_adjustment" || t.reference.startsWith("ADMIN_");
                    const adminDeduction = t.reference.startsWith("ADMIN_DEDUCT_");
                    return (
                    <tr key={t.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                      <td className="px-4 py-3"><span className="text-xs font-mono font-medium text-foreground-900">{t.reference}</span><p className="text-[11px] text-foreground-500">{t.description}</p></td>
                      <td className="px-4 py-3"><span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${t.type==="collection"?"bg-primary-100 text-primary-700":"bg-accent-100 text-accent-700"}`}>{adminAdjustment ? (adminDeduction ? "Withdraw fee" : "Balance credit") : t.type}</span></td>
                      <td className="px-4 py-3"><span className={`text-sm font-semibold ${adminDeduction ? "text-accent-600" : "text-foreground-900"}`}>{adminAdjustment ? (adminDeduction ? "−" : "+") : ""}{formatCurrency(t.amount, t.currency || activeCurrency)}</span></td>
                      <td className="px-4 py-3"><span className="text-xs text-foreground-600">{t.fee_amount != null ? formatCurrency(t.fee_amount, t.currency || activeCurrency) : "Not recorded"}</span></td>
                      <td className="px-4 py-3"><span className="text-sm font-medium text-primary-600">{t.net_amount ? formatCurrency(t.net_amount, t.currency || activeCurrency) : "—"}</span></td>
                      {[t.balance_before ?? t.metadata?.balance_before, t.balance_after ?? t.metadata?.balance_after].map((balance, index) => (
                        <td key={index} className="px-4 py-3 whitespace-nowrap text-xs text-foreground-600">{balance != null ? formatCurrency(balance, t.currency || activeCurrency) : t.type === "payout" ? "Not recorded" : "—"}</td>
                      ))}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${t.status==="success"?"bg-emerald-100 text-emerald-700":t.status==="pending"?"bg-accent-100 text-accent-700":"bg-red-100 text-red-700"}`}>
                          {t.status === "pending" && <i className="ri-loader-4-line animate-spin text-[10px]" />}
                          {t.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right"><span className="text-xs text-foreground-500">{formatDate(t.created_at)}</span></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-background-200/70 text-center"><p className="text-xs text-foreground-500">Showing {transactions.length} transactions</p></div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}