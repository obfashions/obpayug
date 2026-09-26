import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { invokeObpay } from "@/lib/edge-function";

interface Pay { reference: string; amount: number; currency: string; phone_number: string | null; description: string | null; created_at: string; legacy?: boolean; name?: string }
interface Refund { id: string; original_reference: string; refund_reference: string; amount: number; currency: string; status: string; reason: string | null; error: string | null; created_at: string }

export default function RefundsPage() {
  const { user } = useAuth();
  const [pays, setPays] = useState<Pay[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Pay | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [managed, legacy] = await Promise.all([
      platform<{ payments: Pay[]; refunds: Refund[] }>("refunds.list"),
      supabase.from("transactions").select("reference, amount, currency, customer_phone, customer_name, description, created_at")
        .eq("user_id", user.id).eq("type", "collection").eq("status", "success").order("created_at", { ascending: false }).limit(100),
    ]);
    const seen = new Set<string>();
    const list: Pay[] = [];
    for (const p of managed.data?.payments || []) { seen.add(p.reference); list.push(p); }
    for (const t of (legacy.data as any[]) || []) {
      if (seen.has(t.reference)) continue;
      list.push({ reference: t.reference, amount: Number(t.amount), currency: t.currency || "UGX", phone_number: t.customer_phone, description: t.description, created_at: t.created_at, legacy: true, name: t.customer_name });
    }
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setPays(list);
    setRefunds(managed.data?.refunds || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const refundedFor = (ref: string) => refunds.filter((r) => r.original_reference === ref && r.status !== "failed").reduce((s, r) => s + Number(r.amount), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setMsg(null);
    const left = target.amount - refundedFor(target.reference);
    const amt = amount ? Math.round(Number(amount)) : left;
    let res: any;
    if (target.legacy) {
      if (amt <= 0 || amt > left) { setBusy(false); return setMsg({ ok: false, text: `You can refund at most ${left.toLocaleString()} ${target.currency}.` }); }
      const refundRef = `RFD${Date.now().toString(36).toUpperCase()}`;
      res = await invokeObpay({ action: "payout", reference: refundRef, amount: amt, phoneNumber: target.phone_number, destinationType: "mobile", customerName: target.name || "ObPay customer", description: `Refund of ${target.reference}${reason ? ` – ${reason}` : ""}`, payout_type: "send" });
      await platform("refunds.log", { original_reference: target.reference, refund_reference: refundRef, amount: amt, currency: target.currency, phone_number: target.phone_number, reason, status: res?.success ? "pending" : "failed", error: res?.success ? null : res?.error });
    } else {
      res = await platform("refunds.create", { reference: target.reference, amount: amount ? Number(amount) : undefined, reason });
    }
    setBusy(false);
    if (!res?.success) return setMsg({ ok: false, text: res?.error || "The refund could not be sent." });
    setMsg({ ok: true, text: `Refund of ${amt.toLocaleString()} ${target.currency} sent back to ${target.phone_number}. The payout fee comes out of the refund.` });
    setTarget(null); setAmount(""); setReason("");
    void load();
  }

  const input = "w-full px-3 py-2.5 rounded-lg border border-background-200 bg-background-50 text-sm";
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Refunds</h1>
          <p className="text-sm text-foreground-600 mt-1">Send money back to a customer who paid you. It comes out of your balance.</p>
        </div>
        {msg && <div className={`text-sm rounded-lg p-3 ${msg.ok ? "bg-accent-50 text-accent-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}

        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <p className="px-4 py-3 font-semibold text-sm border-b border-background-200/70">Successful payments</p>
          {loading ? <div className="py-10 text-center"><i className="ri-loader-4-line animate-spin text-2xl text-accent-500" /></div> :
            pays.length === 0 ? <p className="p-6 text-sm text-center text-foreground-600">No successful payments yet.</p> :
            <div className="divide-y divide-background-200/70">
              {pays.map((p) => {
                const left = p.amount - refundedFor(p.reference);
                return (
                  <div key={p.reference} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground-900">{p.amount.toLocaleString()} {p.currency} · <span className="font-mono text-xs">{p.reference}</span></p>
                      <p className="text-xs text-foreground-600 truncate">{p.phone_number || "No number"} · {new Date(p.created_at).toLocaleString()}{left < p.amount ? ` · ${(p.amount - left).toLocaleString()} refunded` : ""}</p>
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
                  <div className="min-w-0"><p className="font-medium">{Number(r.amount).toLocaleString()} {r.currency} for <span className="font-mono text-xs">{r.original_reference}</span></p>
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
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className={input} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setTarget(null)} className="flex-1 py-2.5 rounded-lg border border-background-200 text-sm cursor-pointer">Cancel</button>
              <button disabled={busy} className="flex-1 py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm cursor-pointer disabled:opacity-60">{busy ? "Sending…" : "Send refund"}</button>
            </div>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}
