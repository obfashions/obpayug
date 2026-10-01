import { useEffect, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";
import { formatCurrency } from "@/lib/currency";

interface Refund { id: string; original_reference: string; refund_reference: string; amount: number; currency: string; status: string; reason: string | null; phone_number: string | null; created_at: string }

/** Read-only: refunds are sent by ObPay admins after a fraud follow-up. */
export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    platform<{ refunds: Refund[] }>("refunds.list").then((r) => { setRefunds(r.data?.refunds || []); setLoading(false); });
  }, []);
  const done = refunds.filter((r) => r.status !== "failed");
  const totals = done.reduce<Record<string, number>>((m, r) => ({ ...m, [r.currency]: (m[r.currency] || 0) + Number(r.amount) }), {});
  const tone = (s: string) => s === "success" ? "bg-accent-50 text-accent-700" : s === "failed" ? "bg-red-50 text-red-700" : "bg-secondary-50 text-secondary-700";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Refunds</h1>
          <p className="text-sm text-foreground-600 mt-1">Money returned to the sender by ObPay after a fraud or dispute review. Contact support if you think a payment should be refunded.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-4">
            <p className="text-xs text-foreground-500">Refunds</p>
            <p className="font-heading font-bold text-xl text-foreground-900">{done.length}</p>
          </div>
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-4 sm:col-span-2">
            <p className="text-xs text-foreground-500">Total returned to senders</p>
            <p className="font-heading font-bold text-xl text-foreground-900">{Object.keys(totals).length ? Object.entries(totals).map(([c, v]) => formatCurrency(v, c)).join(" · ") : formatCurrency(0)}</p>
          </div>
        </div>
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <p className="px-4 py-3 font-semibold text-sm border-b border-background-200/70">Refund history</p>
          {loading ? <div className="py-10 text-center"><i className="ri-loader-4-line animate-spin text-2xl text-accent-500" /></div> :
            refunds.length === 0 ? <p className="p-6 text-sm text-center text-foreground-600">No refunds on your account.</p> :
            <div className="divide-y divide-background-200/70">
              {refunds.map((r) => (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground-900">{formatCurrency(Number(r.amount), r.currency)} returned{r.phone_number ? ` to ${r.phone_number}` : ""}</p>
                    <p className="text-xs text-foreground-600 truncate">Payment <span className="font-mono">{r.original_reference}</span> · {new Date(r.created_at).toLocaleString()}{r.reason ? ` · ${r.reason}` : ""}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${tone(r.status)}`}>{r.status === "pending" ? "processing" : r.status}</span>
                </div>
              ))}
            </div>}
        </div>
      </div>
    </DashboardLayout>
  );
}
