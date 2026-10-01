import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { platform } from "@/lib/platform";

interface Pay { merchant_id: string; reference: string; amount: number; currency: string; phone_number: string | null; description: string | null; created_at: string; name?: string | null }
interface Refund { id: string; merchant_id: string; original_reference: string; refund_reference: string; amount: number; currency: string; status: string; reason: string | null; error: string | null; created_at: string }

/** Admin-only: return money to the sender after a fraud follow-up. */
export default function AdminRefundsPage() {
  const [pays, setPays] = useState<Pay[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [merchants, setMerchants] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Pay | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await platform<{ payments: Pay[]; refunds: Refund[]; merchants: Record<string, string> }>("refunds.list");
    if (!res.success) setMsg({ ok: false, text: res.error || "Could not load payments." });
    setPays(res.data?.payments || []);
    setRefunds(res.data?.refunds || []);
    setMerchants(res.data?.merchants || {});
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const refundedFor = (ref: string) => refunds.filter((r) => r.original_reference === ref && r.status !== "failed").reduce((s, r) => s + Number(r.amount), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setMsg(null);
    const left = target.amount - refundedFor(target.reference);
    const amt = amount ? Math.round(Number(amount)) : left;
    const res: any = await platform("refunds.create", { merchant_id: target.merchant_id, reference: target.reference, amount: amount ? Number(amount) : undefined, reason });
    setBusy(false);
    if (!res?.success) return setMsg({ ok: false, text: res?.error || "The refund could not be sent." });
    setMsg({ ok: true, text: `Refund of ${amt.toLocaleString()} ${target.currency} sent back to ${target.phone_number}. It was taken from the merchant's balance.` });
    setTarget(null); setAmount(""); setReason("");
    void load();
  }

  const shown = pays.filter((p) => !q || `${p.reference} ${p.phone_number} ${merchants[p.merchant_id] || ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 150);
  const input = "w-full px-3 py-2.5 rounded-lg border border-background-200 bg-background-50 text-sm";
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Refunds</h1>
          <p className="text-sm text-foreground-600 mt-1">Return money to the sender after a fraud follow-up. It comes out of that merchant's balance and shows on their Refunds page.</p>
        </div>
        {msg && <div className={`text-sm rounded-lg p-3 ${msg.ok ? "bg-accent-50 text-accent-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-background-200/70 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-sm">Successful payments</p>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search merchant, number or reference" className="px-3 py-1.5 rounded-lg border border-background-200 text-sm w-full sm:w-72" />
          </div>
          {loading ? <div className="py-10 text-center"><i className="ri-loader-4-line animate-spin text-2xl text-accent-500" /></div> :
            shown.length === 0 ? <p className="p-6 text-sm text-center text-foreground-600">No successful payments found.</p> :
            <div className="divide-y divide-background-200/70">
              {shown.map((p) => {
                const left = p.amount - refundedFor(p.reference);
                return (
                  <div key={p.merchant_id + p.reference} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground-900">{Number(p.amount).toLocaleString()} {p.currency} · <span className="font-mono text-xs">{p.reference}</span></p>
                      <p className="text-xs text-foreground-600 truncate">{merchants[p.merchant_id] || "Merchant"} · {p.phone_number || "No number"} · {new Date(p.created_at).toLocaleString()}{left < p.amount ? ` · ${(p.amount - left).toLocaleString()} refunded` : ""}</p>
                    </div>
                    <button disabled={left <= 0 || !p.phone_number || p.currency === "USD"} onClick={() => { setTarget(p); setAmount(""); setMsg(null); }}
                      className="px-3 py-1.5 rounded-lg text-sm border border-primary-300 text-primary-700 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                      {left <= 0 ? "Refunded" : "Refund"}
                    </button>
                  </div>
                );
              })}
            </div>}
        </div>

        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <p className="px-4 py-3 font-semibold text-sm border-b border-background-200/70">Refund history</p>
          {refunds.length === 0 ? <p className="p-6 text-sm text-center text-foreground-600">No refunds yet.</p> :
            <div className="divide-y divide-background-200/70">
              {refunds.map((r) => (
                <div key={r.id} className="px-4 py-3 text-sm flex justify-between gap-2">
                  <div className="min-w-0"><p className="font-medium">{merchants[r.merchant_id] ? `${merchants[r.merchant_id]} · ` : ""}{Number(r.amount).toLocaleString()} {r.currency} for <span className="font-mono text-xs">{r.original_reference}</span></p>
                    <p className="text-xs text-foreground-600 truncate">{r.reason || "No reason"}{r.error ? ` · ${r.error}` : ""}</p></div>
                  <span className="text-xs capitalize">{r.status}</span>
                </div>
              ))}
            </div>}
        </div>
      </div>

      {target && (
        <div className="fixed inset-0 z-50 bg-foreground-900/40 flex items-end sm:items-center justify-center p-4" onClick={() => setTarget(null)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-background-50 rounded-xl w-full max-w-md p-5 space-y-3">
            <p className="font-semibold">Refund {target.reference}</p>
            <p className="text-sm text-foreground-600">To {target.phone_number}. Up to {(target.amount - refundedFor(target.reference)).toLocaleString()} {target.currency}.</p>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (empty = full refund)" inputMode="numeric" className={input} />
            <input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. fraud case number" className={input} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setTarget(null)} className="flex-1 py-2.5 rounded-lg border border-background-200 text-sm cursor-pointer">Cancel</button>
              <button disabled={busy} className="flex-1 py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm cursor-pointer disabled:opacity-60">{busy ? "Sending…" : "Send refund"}</button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}
