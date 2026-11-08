import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import AdminLayout from "@/components/feature/AdminLayout";
import { adminBankPayouts, adminCompleteBankPayout } from "@/lib/bank-services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (n: number, c: string) => `${Number(n || 0).toLocaleString()} ${c === "SLL" ? "SLE" : c}`;

function Row({ i, onDone }: { i: any; onDone: () => void }) {
  const complete = useServerFn(adminCompleteBankPayout);
  const [ref, setRef] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const hours = Math.floor((Date.now() - new Date(i.created_at).getTime()) / 36e5);
  const copy = (t: string) => navigator.clipboard?.writeText(t);
  async function act(status: "success" | "failed") {
    setErr("");
    if (status === "success" && !ref.trim()) return setErr("Enter the transfer reference from the payment dashboard.");
    if (reason.trim().length < 5) return setErr("Enter a note of at least five characters.");
    if (status === "failed" && !confirm(`Refund ${fmt(i.total, i.currency)} to the merchant?`)) return;
    setBusy(true);
    const r = await complete({ data: { recordId: i.id, status, transferReference: ref, reason } }).catch((e) => ({ success: false as const, error: String(e?.message || e) }));
    setBusy(false); if (!r.success) setErr(r.error); else onDone();
  }
  const fields: [string, string][] = [["Bank", i.bank?.bank_name], ["Branch", i.bank?.branch || "—"], ["Account number", i.bank?.account_number], ["Account name", i.bank?.account_name], ["Amount to send", String(i.amount)]];
  return <article className="border border-border rounded-md p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{i.merchant?.business_name || i.merchant?.full_name || "Merchant"}</p><p className="text-xs text-muted-foreground">{i.merchant?.email} · {i.merchant?.phone || ""}</p></div>
      <div className="text-right"><p className="font-semibold">{fmt(i.amount, i.currency)}</p><p className={`text-xs ${i.status === "pending" && hours >= 20 ? "text-destructive" : "text-muted-foreground"}`}>{i.status} · {hours}h ago · fee {fmt(i.fee, i.currency)} · debited {fmt(i.total, i.currency)}</p></div></div>
    <dl className="grid gap-2 sm:grid-cols-2 text-sm">{fields.map(([k, v]) => <div key={k} className="flex justify-between gap-2 bg-muted/50 rounded px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="flex items-center gap-2 font-medium break-all">{v}<button type="button" className="text-xs text-primary underline" onClick={() => copy(v)}>Copy</button></dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">Reference {i.reference}{i.note ? ` · Note: ${i.note}` : ""}</p>
    {i.status === "pending" ? <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
      <Input placeholder="Transfer reference" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Transfer reference" />
      <Input placeholder="Note (e.g. Sent via bank dashboard)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Note" />
      <Button disabled={busy} onClick={() => act("success")}>Mark paid</Button>
      <Button disabled={busy} variant="outline" onClick={() => act("failed")}>Fail & refund</Button>
    </div> : <p className="text-sm">{i.status === "success" ? "Paid" : "Refunded"}{i.settled_at ? ` · ${new Date(i.settled_at).toLocaleString()}` : ""}</p>}
    {err && <p className="text-sm text-destructive">{err}</p>}
  </article>;
}

export default function AdminBankPayouts() {
  const list = useServerFn(adminBankPayouts);
  const [status, setStatus] = useState<"pending" | "success" | "failed" | "all">("pending");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const r = await list({ data: { status } }).catch((e) => ({ success: false as const, error: String(e) })); setLoading(false); if (r.success) { setItems(r.items); setError(""); } else setError(r.error); };
  useEffect(() => { void load(); }, [status]);
  return <AdminLayout><div className="max-w-5xl mx-auto space-y-5">
    <header><h1 className="text-2xl font-semibold">Bank withdrawals</h1><p className="text-sm text-muted-foreground mt-1">Send each pending withdrawal from the Jjuma dashboard within 24 hours, then mark it paid with the transfer reference. Merchant funds (amount + fee) are already reserved; "Fail & refund" returns them in full.</p></header>
    <div className="flex flex-wrap gap-2">{(["pending", "success", "failed", "all"] as const).map((s) => <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>{s === "success" ? "Paid" : s === "failed" ? "Refunded" : s[0].toUpperCase() + s.slice(1)}</Button>)}</div>
    {error && <p className="text-sm text-destructive">{error}</p>}
    {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">No withdrawals here.</p> : items.map((i) => <Row key={i.id} i={i} onDone={load} />)}
  </div></AdminLayout>;
}
