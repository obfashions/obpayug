import { useState, useEffect } from "react";
import { Link } from "@/lib/router-compat";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";

function formatCurrency(amount: number, currency: string = "UGX"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface TxnRow {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  customer_name: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalMerchants: 0,
    activeMerchants: 0,
    pendingKYC: 0,
    totalVolume: 0,
    todayVolume: 0,
    totalTransactions: 0,
    successRate: 0,
  });
  const [recentTxns, setRecentTxns] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        // Fetch all stats in parallel
        const [
          { count: totalMerchants },
          { count: activeMerchants },
          { count: pendingKYC },
          { data: txns },
          { count: txCount },
          { data: okTx },
        ] = await Promise.all([
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "merchant").neq("status", "deactivated"),
          supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "merchant").eq("status", "active"),
          supabase.from("merchant_profiles").select("*", { count: "exact", head: true }).eq("verification_status", "pending"),
          supabase.from("transactions").select("*, profiles!transactions_user_id_fkey(full_name)").order("created_at", { ascending: false }).limit(50),
          supabase.from("transactions").select("*", { count: "exact", head: true }),
          supabase.from("transactions").select("amount, created_at").eq("status", "success").limit(20000),
        ]);

        const txnList = txns as TxnRow[] || [];
        const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        let totalVolume = 0;
        let todayVolume = 0;
        let successCount = 0;

        ((okTx as any[]) || []).forEach((t) => {
          const amt = Number(t.amount) || 0;
          totalVolume += amt;
          successCount++;
          if (new Date(t.created_at) >= today) todayVolume += amt;
        });

        setStats({
          totalMerchants: totalMerchants || 0,
          activeMerchants: activeMerchants || 0,
          pendingKYC: pendingKYC || 0,
          totalVolume,
          todayVolume,
          totalTransactions: txCount || txnList.length,
          successRate: (txCount || 0) > 0 ? Math.round((successCount / (txCount || 1)) * 100) : 0,
        });

        setRecentTxns(txnList);
      } catch (err: any) {
        setError(err.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    { label: "Total Merchants", value: formatNumber(stats.totalMerchants), sub: `${formatNumber(stats.activeMerchants)} active`, icon: "ri-store-3-line", accent: "bg-primary-100 text-primary-600" },
    { label: "Pending KYC", value: formatNumber(stats.pendingKYC), sub: "Awaiting review", icon: "ri-shield-check-line", accent: "bg-accent-100 text-accent-600" },
    { label: "Total Volume", value: formatCurrency(stats.totalVolume), sub: `${formatCurrency(stats.todayVolume)} today`, icon: "ri-funds-line", accent: "bg-secondary-100 text-secondary-600" },
    { label: "Total Transactions", value: formatNumber(stats.totalTransactions), sub: `${stats.successRate}% success rate`, icon: "ri-exchange-line", accent: "bg-primary-100 text-primary-600" },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-accent-600 text-3xl" />
            </div>
            <p className="text-sm text-foreground-800 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" /> Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Admin Dashboard</h1>
          <p className="text-sm text-foreground-600 mt-1">Platform overview and key metrics</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div key={card.label} className="bg-background-50 rounded-xl p-5 border border-background-200/70">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${card.accent} flex items-center justify-center`}>
                  <i className={`${card.icon} text-lg`} />
                </div>
              </div>
              <p className="font-heading font-bold text-2xl text-foreground-900 mb-1">{card.value}</p>
              <p className="text-xs text-foreground-600">{card.label}</p>
              <p className="text-[11px] text-foreground-500 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="p-5 border-b border-background-200/70 flex items-center justify-between">
              <h2 className="font-heading font-semibold text-foreground-900">Recent Transactions</h2>
              <Link to="/admin/transactions" className="text-sm text-primary-500 hover:text-primary-600 font-medium cursor-pointer whitespace-nowrap">
                View All →
              </Link>
            </div>
            {recentTxns.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-foreground-500">No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-background-200/70">
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Merchant</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Reference</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Amount</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxns.slice(0, 8).map((txn) => (
                      <tr key={txn.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-foreground-900 text-xs">
                            {txn.profiles?.full_name || "Unknown"}
                          </p>
                          <p className="text-xs text-foreground-500">{txn.type}</p>
                        </td>
                        <td className="px-5 py-3">
                          <code className="text-xs text-foreground-600 bg-background-100 px-1.5 py-0.5 rounded">{txn.reference}</code>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-foreground-900 text-xs">
                          {formatCurrency(txn.amount, txn.currency)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            txn.status === "success" ? "bg-primary-100 text-primary-700" :
                            txn.status === "failed" ? "bg-accent-100 text-accent-700" :
                            "bg-secondary-100 text-secondary-700"
                          }`}>
                            {txn.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-foreground-500">{timeAgo(txn.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
            <h2 className="font-heading font-semibold text-foreground-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Review KYC", to: "/admin/kyc-review", icon: "ri-shield-check-line", color: "bg-accent-100 text-accent-600" },
                { label: "View Merchants", to: "/admin/merchants", icon: "ri-store-3-line", color: "bg-primary-100 text-primary-600" },
                { label: "All Transactions", to: "/admin/transactions", icon: "ri-exchange-line", color: "bg-secondary-100 text-secondary-600" },
                { label: "System Settings", to: "/admin/settings", icon: "ri-settings-4-line", color: "bg-primary-100 text-primary-600" },
              ].map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-background-200/70 hover:bg-background-100 transition-colors cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center shrink-0`}>
                    <i className={`${action.icon} text-lg`} />
                  </div>
                  <span className="text-sm font-medium text-foreground-700 whitespace-nowrap">{action.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}