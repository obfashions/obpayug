import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";
import { listPaymentRecords } from "@/lib/history.functions";
import { getAccessToken } from "@/lib/session-token";

interface TxnRow {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  payment_method: string;
  description: string;
  created_at: string;
  profiles: { full_name: string } | null;
  fee_amount?: number | null;
  balance_before?: number | null;
  balance_after?: number | null;
  metadata?: { balance_before?: number; balance_after?: number };
}

const PAGE_SIZE = 50;

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<TxnRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      // Build base query
      let query = supabase
        .from("transactions")
        .select("*, profiles!transactions_user_id_fkey(full_name)", { count: "exact" })
        .order("created_at", { ascending: false });

      // Apply filters server-side for load more consistency
      if (typeFilter !== "all") query = query.eq("type", typeFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (search) {
        query = query.or(
          `reference.ilike.%${search}%,customer_name.ilike.%${search}%`
        );
      }

      // Range pagination
      const from = isLoadMore ? transactions.length : 0;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error: fetchErr } = await query;

      if (fetchErr) throw fetchErr;

      let rows = (data as TxnRow[]) || [];
      if (!isLoadMore) {
        try {
          const accessToken = await getAccessToken();
          const res: any = await listPaymentRecords({ data: { accessToken, all: true, type: typeFilter === "all" ? "" : typeFilter, status: statusFilter === "all" ? "" : statusFilter, search } });
          const seen = new Set(rows.map((r) => r.reference));
          const extra = (res?.rows || []).filter((r: any) => !seen.has(r.reference));
          rows = [...rows, ...extra].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
        } catch { /* keep base rows */ }
      }
      if (isLoadMore) {
        setTransactions((prev) => [...prev, ...rows]);
      } else {
        setTransactions(rows);
      }

      if (count !== null) {
        setTotalCount(count);
        setHasMore(from + PAGE_SIZE < count);
      } else {
        setHasMore(rows.length === PAGE_SIZE);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load transactions");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    fetchTransactions(false);
  }, [typeFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTransactions(false);
  };

  const loadMore = () => {
    fetchTransactions(true);
  };

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading transactions...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-24">
          <p className="text-sm text-foreground-800 mb-4">{error}</p>
          <button onClick={() => fetchTransactions(false)} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Transactions</h1>
          <p className="text-sm text-foreground-600 mt-1">
            {totalCount.toLocaleString()} total · {transactions.length.toLocaleString()} loaded · {formatCurrency(totalVolume, "UGX")} visible volume
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center bg-background-50 rounded-lg px-3 py-2 border border-background-200/70 flex-1 max-w-sm">
            <i className="ri-search-line text-foreground-400 text-sm mr-2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reference or merchant..." className="bg-transparent text-sm text-foreground-700 placeholder-foreground-400 focus:outline-none w-full" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
            <option value="all">All Types</option>
            <option value="collection">Collections</option>
            <option value="payout">Payouts</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </form>

        {transactions.length === 0 ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4">
              <i className="ri-exchange-line text-foreground-400 text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">No transactions found</h3>
            <p className="text-sm text-foreground-600">Transactions will appear here as merchants process payments</p>
          </div>
        ) : (
          <>
            <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200/70">
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Reference</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Merchant</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Amount</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Fee</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase whitespace-nowrap">Balance before</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase whitespace-nowrap">Balance after</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Type</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Method</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => {
                      const adminAdjustment = t.payment_method === "admin_adjustment" || t.reference.startsWith("ADMIN_");
                      const adminDeduction = t.reference.startsWith("ADMIN_DEDUCT_");
                      return (
                      <tr key={t.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                        <td className="px-5 py-3"><code className="text-xs text-foreground-600 bg-background-100 px-1.5 py-0.5 rounded">{t.reference}</code>{t.description && <p className="text-[11px] text-foreground-500 mt-1">{t.description}</p>}</td>
                        <td className="px-5 py-3"><span className="text-xs text-foreground-700">{t.profiles?.full_name || "Unknown"}</span></td>
                        <td className="px-5 py-3 text-right"><span className="text-xs font-medium text-foreground-900">{formatCurrency(t.amount, t.currency)}</span></td>
                        <td className="px-5 py-3 text-right whitespace-nowrap text-xs text-foreground-600">{t.fee_amount != null ? formatCurrency(t.fee_amount, t.currency) : "Not recorded"}</td>
                        {[t.balance_before ?? t.metadata?.balance_before, t.balance_after ?? t.metadata?.balance_after].map((balance, index) => (
                          <td key={index} className="px-5 py-3 text-right whitespace-nowrap text-xs text-foreground-600">{balance != null ? formatCurrency(balance, t.currency) : t.type === "payout" ? "Not recorded" : "—"}</td>
                        ))}
                        <td className="px-5 py-3"><span className={`text-xs ${adminDeduction ? "text-accent-600 font-medium" : "text-foreground-600"}`}>{adminAdjustment ? (adminDeduction ? "Admin deducted" : "Admin added") : t.type}</span></td>
                        <td className="px-5 py-3"><span className="text-xs text-foreground-600">{adminAdjustment ? "Admin adjustment" : (t.payment_method || "—")}</span></td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            t.status === "success" ? "bg-primary-100 text-primary-700" : t.status === "failed" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"
                          }`}>{t.status}</span>
                        </td>
                        <td className="px-5 py-3 text-right"><span className="text-xs text-foreground-500">{timeAgo(t.created_at)}</span></td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="bg-background-50 border border-background-200/70 text-foreground-700 hover:bg-background-100 disabled:opacity-50 font-medium px-8 py-3 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <i className="ri-arrow-down-line" />
                      Load More ({Math.min(PAGE_SIZE, totalCount - transactions.length).toLocaleString()} remaining)
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}