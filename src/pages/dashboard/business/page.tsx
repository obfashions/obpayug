import { useEffect, useState } from "react";
import { Building2, Download, RefreshCcw } from "lucide-react";
import { Link } from "@/lib/router-compat";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { Button } from "@/components/ui/button";
import { businessWorkspace } from "@/lib/business.functions";
import { businessCsv, businessTotals } from "@/lib/business-report";
import { getAccessToken } from "@/lib/session-token";

export default function BusinessPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => { setBusy(true); setError(""); try { setData(await businessWorkspace({ data: { accessToken: await getAccessToken(), month } })); } catch (e: any) { setError(e?.message || "Business account could not be loaded."); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, [month]);
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([businessCsv(data.rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `obpay-business-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <DashboardLayout><div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3 items-center"><Building2 className="text-primary-600"/><h1 className="font-heading text-2xl font-semibold text-foreground-900">Business account</h1></div><Button variant="outline" disabled={busy} onClick={load}><RefreshCcw className="size-4"/>Refresh</Button></header>
    {error && <p role="alert" className="text-sm text-accent-600">{error}</p>}
    {busy ? <p className="text-sm text-foreground-500">Checking business records…</p> : data?.business ? <>
      <section className="border-y border-background-200 py-5"><h2 className="font-heading text-xl font-semibold text-foreground-900">{data.details.business_name || data.details.company_name}</h2><dl className="mt-4 grid sm:grid-cols-3 gap-4 text-sm">{[["Verification", data.details.status], ["Registration number", data.details.id_number || "—"], ["Merchant ID", data.details.merchant_id || "—"], ["Business address", data.details.address || "—"]].map(([key, value]) => <div key={key}><dt className="text-xs text-foreground-500">{key}</dt><dd className="mt-1 break-words text-foreground-900">{value}</dd></div>)}</dl></section>
      <section className="space-y-4"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-heading font-semibold text-foreground-900">Monthly business statement</h2><div className="flex flex-wrap gap-2"><input aria-label="Statement month" type="month" value={month} onChange={(e) => { if (e.target.value) setMonth(e.target.value); }} className="border border-background-300 rounded-md bg-background-50 p-2 text-sm"/><Button variant="outline" disabled={!data.rows.length || data.truncated} onClick={exportCsv}><Download className="size-4"/>Export CSV</Button></div></div>
      {data.truncated && <p role="alert" className="text-sm text-accent-600">This month exceeds the statement limit. Export is disabled to avoid an incomplete report; contact customer service.</p>}
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-foreground-500"><tr><th className="py-3">Currency</th><th>Settled receipts</th><th>Settled payments</th><th>Recorded fees</th></tr></thead><tbody>{Object.entries(businessTotals(data.rows)).map(([currency, t]) => <tr key={currency} className="border-t border-background-200"><td className="py-3 font-medium">{currency === "SLL" ? "SLE" : currency}</td><td>{t.received.toLocaleString()}</td><td>{t.sent.toLocaleString()}</td><td>{t.fees.toLocaleString()}</td></tr>)}</tbody></table></div><p className="text-xs text-foreground-500">{data.rows.length} transactions · {data.rows.filter((r: any) => ["pending", "processing"].includes(r.status)).length} pending · {data.rows.filter((r: any) => r.status === "failed").length} failed</p>
      {!data.rows.length && <p className="text-sm text-foreground-500">No transactions for this month.</p>}</section>
      <nav className="grid sm:grid-cols-3 gap-4 border-t border-background-200 pt-5">{[["Payment links", "/dashboard/payment-links"], ["Payment integrations", "/dashboard/api-keys"], ["Transaction tracking", "/dashboard/transactions"]].map(([label, path]) => <Link key={path} to={path} className="text-sm font-medium text-primary-600 underline underline-offset-4">{label} →</Link>)}</nav>
    </> : data ? <section className="border-y border-background-200 py-6 space-y-3"><h2 className="font-heading text-lg font-semibold">Business verification</h2><p className="text-sm text-foreground-600">This account currently has personal verification. Business details and registration documents must be reviewed before business records become available.</p><Button asChild><Link to="/dashboard/kyc">Submit business verification</Link></Button></section> : null}
  </div></DashboardLayout>;
}