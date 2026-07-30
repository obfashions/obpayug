import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

function formatCurrency(amount: number) { return "UGX " + amount.toLocaleString("en-UG"); }

export default function ReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "custom">("monthly");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case "daily": startDate = new Date(now); startDate.setHours(0,0,0,0); break;
        case "weekly": startDate = new Date(now); startDate.setDate(now.getDate() - 7); break;
        case "monthly": startDate = new Date(now); startDate.setDate(1); startDate.setHours(0,0,0,0); break;
        default: startDate = new Date(now); startDate.setMonth(now.getMonth() - 1); break;
      }

      const { data: txns, error } = await supabase.from("transactions").select("*").eq("user_id", user.id).gte("created_at", startDate.toISOString()).order("created_at", { ascending: false });

      if (error) throw error;

      const transactions = txns || [];
      const collections = transactions.filter((t: any) => t.type === "collection");
      const payouts = transactions.filter((t: any) => t.type === "payout");
      const successful = transactions.filter((t: any) => t.status === "success");
      const failed = transactions.filter((t: any) => t.status === "failed");

      const totalCollections = collections.reduce((s: number, t: any) => s + t.amount, 0);
      const totalPayouts = payouts.reduce((s: number, t: any) => s + t.amount, 0);
      const totalFees = successful.filter((t: any) => t.type === "collection").reduce((s: number, t: any) => s + (t.fee_amount || 0), 0);
      const totalNet = successful.filter((t: any) => t.type === "collection").reduce((s: number, t: any) => s + (t.net_amount || 0), 0);
      const successRate = transactions.length > 0 ? Math.round((successful.length / transactions.length) * 100) : 0;

      setReport({
        period,
        startDate: startDate.toISOString(),
        summary: {
          totalTransactions: transactions.length,
          totalCollections,
          totalPayouts,
          totalFees,
          totalNet,
          successRate,
          successfulCount: successful.length,
          failedCount: failed.length,
        },
        transactions,
      });
    } catch (err: any) { console.error(err); }
    finally { setLoading(false); }
  }, [user, period]);

  useEffect(() => { generateReport(); }, [generateReport]);

  const exportCSV = () => {
    if (!report?.transactions?.length) return;
    const headers = ["Reference","Type","Amount","Fee","Net","Currency","Status","Date"];
    const rows = report.transactions.map((t: any) => [t.reference, t.type, t.amount, t.fee_amount||0, t.net_amount||0, t.currency, t.status, t.created_at]);
    const csv = [headers, ...rows].map((r: any) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `obpay-report-${period}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h1 className="font-heading font-bold text-2xl text-foreground-900">Reports</h1><p className="text-sm text-foreground-600 mt-1">Generate downloadable reports for your transactions</p></div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} disabled={!report?.transactions?.length} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-background-300/60 text-sm text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"><i className="ri-download-line" />Export CSV</button>
            <button onClick={generateReport} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-medium cursor-pointer whitespace-nowrap"><i className="ri-refresh-line" />Refresh</button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-background-200/70 rounded-full p-1 w-fit">
          {(["daily","weekly","monthly","custom"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap capitalize ${period===p?"bg-background-50 text-foreground-900":"text-foreground-500 hover:text-foreground-700"}`}>{p}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div>
        ) : report ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Transactions", value: report.summary.totalTransactions, icon: "ri-exchange-line" },
                { label: "Collections", value: formatCurrency(report.summary.totalCollections), icon: "ri-arrow-down-circle-line" },
                { label: "Payouts", value: formatCurrency(report.summary.totalPayouts), icon: "ri-upload-cloud-line" },
                { label: "Platform Fees", value: formatCurrency(report.summary.totalFees), icon: "ri-bank-line" },
                { label: "Net Earnings", value: formatCurrency(report.summary.totalNet), icon: "ri-money-dollar-circle-line" },
                { label: "Success Rate", value: `${report.summary.successRate}%`, icon: "ri-pie-chart-line" },
              ].map((card) => (
                <div key={card.label} className="bg-background-50 rounded-xl p-4 border border-background-200/70">
                  <div className="flex items-center gap-2 mb-2"><i className={`${card.icon} text-foreground-500`} /><span className="text-xs text-foreground-500">{card.label}</span></div>
                  <p className="font-heading font-bold text-lg text-foreground-900">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
                <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-4">Status Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-foreground-600">Successful</span><span className="text-sm font-semibold text-primary-600">{report.summary.successfulCount}</span></div>
                  <div className="w-full h-2 bg-background-200/70 rounded-full overflow-hidden"><div className="h-full bg-primary-500 rounded-full" style={{width:`${report.summary.successRate}%`}} /></div>
                  <div className="flex items-center justify-between"><span className="text-sm text-foreground-600">Failed</span><span className="text-sm font-semibold text-accent-600">{report.summary.failedCount}</span></div>
                  <div className="w-full h-2 bg-background-200/70 rounded-full overflow-hidden"><div className="h-full bg-accent-500 rounded-full" style={{width:`${100 - report.summary.successRate}%`}} /></div>
                </div>
              </div>
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
                <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-4">Financial Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-foreground-600">Gross Collections</span><span className="font-semibold text-foreground-900">{formatCurrency(report.summary.totalCollections)}</span></div>
                  <div className="flex justify-between"><span className="text-foreground-600">Platform Fees</span><span className="font-semibold text-accent-600">- {formatCurrency(report.summary.totalFees)}</span></div>
                  <div className="border-t border-background-200/70 pt-2 flex justify-between"><span className="font-medium text-foreground-900">Net Earnings</span><span className="font-bold text-primary-600">{formatCurrency(report.summary.totalNet)}</span></div>
                </div>
              </div>
            </div>

            {/* Transactions table */}
            {report.transactions.length > 0 && (
              <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
                <div className="p-4 border-b border-background-200/70"><h3 className="font-heading font-semibold text-sm text-foreground-900">Transactions in Period ({report.transactions.length})</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-background-200/70">
                      <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Ref</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Type</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Amount</th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Fee</th>
                      <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Status</th>
                    </tr></thead>
                    <tbody>
                      {report.transactions.slice(0, 20).map((t: any) => (
                        <tr key={t.id} className="border-b border-background-100">
                          <td className="px-4 py-2"><span className="text-xs font-mono text-foreground-900">{t.reference}</span></td>
                          <td className="px-4 py-2"><span className="text-xs text-foreground-600 capitalize">{t.type}</span></td>
                          <td className="px-4 py-2"><span className="text-xs font-semibold text-foreground-900">{formatCurrency(t.amount)}</span></td>
                          <td className="px-4 py-2"><span className="text-xs text-foreground-600">{t.fee_amount ? formatCurrency(t.fee_amount) : "—"}</span></td>
                          <td className="px-4 py-2 text-center"><span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${t.status==="success"?"bg-primary-100 text-primary-700":"bg-accent-100 text-accent-700"}`}>{t.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16"><p className="text-sm text-foreground-500">Select a period to generate your report</p></div>
        )}
      </div>
    </DashboardLayout>
  );
}