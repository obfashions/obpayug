import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { submitBankPayout, myBankPayouts } from "@/lib/bank-services.functions";
import { bankPayoutError, bankPayoutQuote, BANK_PAYOUT_CURRENCIES, BANK_PAYOUT_FEE_PERCENT, BANK_PAYOUT_TIMELINE } from "@/lib/bank-payouts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const show = (c: string) => (c === "SLL" ? "SLE" : c);
const fmt = (n: number, c: string) => `${Number(n || 0).toLocaleString()} ${show(c)}`;
const STATUS: Record<string, string> = { pending: "Processing", processing: "Processing", success: "Paid", failed: "Refunded" };

export default function BankWithdraw() {
  const submit = useServerFn(submitBankPayout);
  const list = useServerFn(myBankPayouts);
  const [saved, setSaved] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [f, setF] = useState({ currency: "UGX", amount: "", bank_name: "", account_number: "", account_name: "", branch: "", note: "" });
  const [ref, setRef] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const load = async () => { const r = await list(); if (r.success) setItems(r.items); };
  useEffect(() => {
    void load();
    void supabase.from("merchant_bank_accounts").select("id,bank_name,account_number,account_name").then(({ data }) => setSaved(data || []));
  }, []);

  const amount = Number(f.amount);
  const quote = useMemo(() => { try { return bankPayoutQuote(amount); } catch { return null; } }, [amount]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const input = { ...f, amount, branch: f.branch || undefined, note: f.note || undefined };
    const problem = bankPayoutError(input);
    if (problem) return setMsg({ ok: false, text: problem });
    setBusy(true);
    try {
      const r = await submit({ data: { ...input, reference: ref } });
      if (!r.success) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: `Withdrawal submitted. ${fmt(r.amount, f.currency)} will be sent to ${f.account_name} within ${BANK_PAYOUT_TIMELINE}. Reference ${r.reference.slice(0, 8).toUpperCase()}.` });
      setRef(crypto.randomUUID()); setF({ ...f, amount: "", note: "" }); await load();
    } catch { setMsg({ ok: false, text: "We couldn't confirm your submission. Check the list below before trying again." }); }
    finally { setBusy(false); }
  }

  return <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] py-5">
    <form onSubmit={onSubmit} className="space-y-4">
      <div><h2 className="font-semibold">Withdraw to a bank account</h2><p className="text-sm text-muted-foreground mt-1">Funds arrive within {BANK_PAYOUT_TIMELINE}. A {BANK_PAYOUT_FEE_PERCENT}% fee applies.</p></div>
      {saved.length > 0 && <div className="space-y-1.5"><Label>Saved account</Label>
        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" defaultValue="" onChange={(e) => { const a = saved.find((s) => s.id === e.target.value); if (a) setF({ ...f, bank_name: a.bank_name, account_number: a.account_number, account_name: a.account_name }); }}>
          <option value="">Enter new details</option>{saved.map((a) => <option key={a.id} value={a.id}>{a.bank_name} · {a.account_number}</option>)}
        </select></div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="bw-bank">Bank name</Label><Input id="bw-bank" value={f.bank_name} onChange={set("bank_name")} placeholder="e.g. Stanbic Bank" required /></div>
        <div className="space-y-1.5"><Label htmlFor="bw-branch">Branch (optional)</Label><Input id="bw-branch" value={f.branch} onChange={set("branch")} /></div>
        <div className="space-y-1.5"><Label htmlFor="bw-num">Account number</Label><Input id="bw-num" inputMode="numeric" value={f.account_number} onChange={set("account_number")} required /></div>
        <div className="space-y-1.5"><Label htmlFor="bw-name">Account name</Label><Input id="bw-name" value={f.account_name} onChange={set("account_name")} placeholder="As registered at the bank" required /></div>
        <div className="space-y-1.5"><Label htmlFor="bw-cur">Wallet</Label><select id="bw-cur" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={f.currency} onChange={set("currency")}>{BANK_PAYOUT_CURRENCIES.map((c) => <option key={c} value={c}>{show(c)}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="bw-amt">Amount to send</Label><Input id="bw-amt" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} required /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="bw-note">Note (optional)</Label><Input id="bw-note" value={f.note} onChange={set("note")} maxLength={200} /></div>
      {quote && <dl className="rounded-md border border-border p-4 text-sm space-y-1.5">
        <div className="flex justify-between"><dt className="text-muted-foreground">Recipient receives</dt><dd>{fmt(quote.amount, f.currency)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Fee ({BANK_PAYOUT_FEE_PERCENT}%)</dt><dd>{fmt(quote.fee, f.currency)}</dd></div>
        <div className="flex justify-between font-semibold border-t border-border pt-1.5"><dt>Total deducted</dt><dd>{fmt(quote.total, f.currency)}</dd></div>
      </dl>}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">{busy ? "Submitting…" : "Submit withdrawal"}</Button>
    </form>
    <section><h2 className="font-semibold mb-3">Bank withdrawals</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No bank withdrawals yet.</p> :
        <ul className="divide-y divide-border border-y border-border">{items.map((i) => <li key={i.id} className="py-3 text-sm flex justify-between gap-3">
          <div className="min-w-0"><p className="font-medium truncate">{i.bank?.account_name} · {i.bank?.bank_name}</p><p className="text-muted-foreground text-xs">{new Date(i.created_at).toLocaleString()} · {i.reference.slice(0, 8).toUpperCase()}</p></div>
          <div className="text-right shrink-0"><p>{fmt(i.amount, i.currency)}</p><p className={`text-xs ${i.status === "success" ? "text-primary" : i.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{STATUS[i.status] || i.status}</p></div>
        </li>)}</ul>}
    </section>
  </div>;
}
