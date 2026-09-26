import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";
import { adminCloudPayments } from "@/lib/admin-insights.functions";
import { getAccessToken } from "@/lib/session-token";

type Row = { type: string; amount: number; status: string; created_at: string; fee: number };

const PERIODS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(n || 0);
}
const isIn = (t: string) => /collect|deposit|payment/i.test(t);

export default function AdminReports() {
  const [period, setPeriod] = useState("monthly");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      const days = PERIODS[period];
      const since = new Date(Date.now() - days * 86400000).toISOString();
      try {
        const all: Row[] = [];
        for (let from = 0; from < 20000; from += 1000) {
          const { data, error: e } = await supabase
            .from("transactions")
            .select("type, amount, status, created_at, fee")
            .gte("created_at", since)
            .range(from, from + 999);
          if (e) throw e;
          for (const t of (data as any[]) || []) all.push({ type: t.type, amount: Number(t.amount) || 0, status: t.status, created_at: t.created_at, fee: Number(t.fee) || 0 });
          if (!data || data.length < 1000) break;
        }
        const accessToken = await getAccessToken();
        const r: any = await adminCloudPayments({ data: { accessToken, days } }).catch(() => null);
        for (const t of r?.rows || []) all.push({ type: t.type, amount: Number(t.amount) || 0, status: t.status, created_at: t.created_at, fee: Number(t.fee_amount) || 0 });
        setRows(all);
      } catch (e: any) {
        setError(e?.message || "Could not load report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [period]);

  const s = useMemo(() => {
    const ok = rows.filter((r) => r.status === "success" || r.status === "completed");
    const collections = ok.filter((r) => isIn(r.type)).reduce((a, r) => a + r.amount, 0);
    const payouts = ok.filter((r) => !isIn(r.type)).reduce((a, r) => a + r.amount, 0);
    const fees = ok.reduce((a, r) => a + r.fee, 0);
    const failed = rows.filter((r) => r.status === "failed").length;
    const pending = rows.filter((r) => r.status === "pending" || r.status === "processing").length;
    return { total: rows.length, ok: ok.length, collections, payouts, fees, failed, pending, rate: rows.length ? Math.round((ok.length / rows.length) * 100) : 0 };
  }, [rows]);

  const buckets = useMemo(() => {
    const n = period === "daily" ? 24 : period === "weekly" ? 7 : period === "monthly" ? 30 : 12;
    const out = Array.from({ length: n }, () => 0);
    const now = Date.now();
    for (const r of rows) {
      if (!(r.status === "success" || r.status === "completed")) continue;
      const age = now - new Date(r.created_at).getTime();
      const unit = period === "daily" ? 3600000 : period === "yearly" ? 30.4 * 86400000 : 86400000;
      const idx = n - 1 - Math.floor(age / unit);
      if (idx >= 0 && idx < n) out[idx] += r.amount;
    }
    return out;
  }, [rows, period]);
  const max = Math.max(1, ...buckets);

  const cards = [
    { label: "Money collected", value: fmt(s.collections) },
    { label: "Money paid out", value: fmt(s.payouts) },
    { label: "Fees earned", value: fmt(s.fees) },
    { label: "Transactions", value: s.total.toLocaleString() },
    { label: "Success rate", value: `${s.rate}%` },
    { label: "Pending / failed", value: `${s.pending} / ${s.failed}` },
  ];

  const handleExport = () => {
    const csv = [["Label", "Value"], ...cards.map((c) => [c.label, c.value.replace(/,/g, "")])].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `obpay-report-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Reports</h1>
            <p className="text-sm text-foreground-600 mt-1">Real totals from all ObPay payments</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm">
              <option value="daily">Last 24 hours</option>
              <option value="weekly">Last 7 days</option>
              <option value="monthly">Last 30 days</option>
              <option value="yearly">Last 12 months</option>
            </select>
            <button onClick={handleExport} disabled={loading} className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-medium flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50">
              <i className="ri-download-line" /> Export
            </button>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-accent-50 text-accent-700 text-sm">{error}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-background-50 rounded-xl p-4 sm:p-5 border border-background-200/70">
              <p className="text-xs text-foreground-500 mb-1">{c.label}</p>
              <p className="font-heading font-bold text-lg sm:text-2xl text-foreground-900 break-words">{loading ? "…" : c.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 sm:p-6">
          <h3 className="font-heading font-semibold text-foreground-900 mb-4">Successful volume over time</h3>
          <div className="h-48 flex items-end gap-[2px] sm:gap-1">
            {buckets.map((v, i) => (
              <div key={i} title={fmt(v)} className="flex-1 bg-primary-400/70 rounded-t" style={{ height: `${Math.max(2, (v / max) * 100)}%` }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-foreground-500 mt-2"><span>Oldest</span><span>Now</span></div>
        </div>
      </div>
    </AdminLayout>
  );
}
