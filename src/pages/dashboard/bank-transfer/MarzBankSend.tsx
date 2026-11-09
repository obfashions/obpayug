import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { marzBank } from "@/lib/bank-services.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fmt = (n: number) => `${Number(n || 0).toLocaleString()} UGX`;
const sel = "w-full h-10 rounded-md border border-input bg-background px-3 text-sm";

/** Automatic UGX bank payout: verify recipient, show exact live fee, then send once. */
export default function MarzBankSend() {
  const call = useServerFn(marzBank);
  const [banks, setBanks] = useState<{ code: string; name: string }[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [f, setF] = useState({ bankName: "", accountNumber: "", bankBranch: "", amount: "", description: "" });
  const [name, setName] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const [ref, setRef] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void call({ data: { action: "bank-banks", body: {} } }).then((r: any) => r.success && setBanks(r.data.banks));
    void call({ data: { action: "bank-services", body: {} } }).then((r: any) => r.success && setSettings(r.data));
  }, []);

  const amount = Number(f.amount);
  useEffect(() => {
    const s = settings?.bank_transfer_settings;
    if (!s || !amount) return setFee(null);
    // Mirror the server: flat charge or percentage; server rejects any mismatch.
    const flat = Number(s.charge_amount ?? s.fee ?? NaN);
    const pct = Number(s.charge_percentage ?? NaN);
    setFee(Number.isFinite(flat) ? flat : Number.isFinite(pct) ? Math.ceil((amount * pct) / 100) : null);
  }, [amount, settings]);

  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); if (k === "bankName" || k === "accountNumber") setName(""); };

  async function verify() {
    setMsg(null); setBusy(true);
    try {
      const r: any = await call({ data: { action: "bank-validate", body: { bankName: f.bankName, accountNumber: f.accountNumber } } });
      if (r.success) setName(r.data.account_name); else setMsg({ ok: false, text: r.error });
    } finally { setBusy(false); }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!name) return setMsg({ ok: false, text: "Verify the account first." });
    if (fee == null) return setMsg({ ok: false, text: "The exact transfer fee is not available. No money has been moved." });
    setBusy(true);
    try {
      const r: any = await call({ data: { action: "bank-transfer", body: { ...f, amount, reference: ref, confirmedName: name, expectedFee: fee, description: f.description || "Bank payout" } } });
      if (!r.success) return setMsg({ ok: false, text: r.error });
      setMsg({ ok: true, text: `Sent to ${name}. Status: ${r.data.status}. Reference ${ref.slice(0, 8).toUpperCase()}.` });
      setRef(crypto.randomUUID()); setF({ ...f, amount: "", description: "" });
    } catch { setMsg({ ok: false, text: "We couldn't confirm the result. Check your history before trying again." }); }
    finally { setBusy(false); }
  }

  if (settings && !settings.bank_transfer_available) return <p className="py-6 text-sm text-muted-foreground">Bank payouts are currently unavailable. No money has been moved.</p>;

  return <form onSubmit={send} className="space-y-4 py-5 max-w-xl">
    <div><h2 className="font-semibold">Automatic bank payout (UGX)</h2><p className="text-sm text-muted-foreground mt-1">The account is checked with the bank and the exact fee is shown before sending.</p></div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="mb-bank">Bank</Label><select id="mb-bank" className={sel} value={f.bankName} onChange={upd("bankName")} required><option value="">Choose a bank</option>{banks.map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="mb-branch">Branch (optional)</Label><Input id="mb-branch" value={f.bankBranch} onChange={upd("bankBranch")} /></div>
      <div className="space-y-1.5"><Label htmlFor="mb-num">Account number</Label><Input id="mb-num" inputMode="numeric" value={f.accountNumber} onChange={upd("accountNumber")} required /></div>
      <div className="space-y-1.5"><Label htmlFor="mb-amt">Amount (UGX)</Label><Input id="mb-amt" inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/\D/g, "") })} required /></div>
    </div>
    <div className="space-y-1.5"><Label htmlFor="mb-desc">Description (optional)</Label><Input id="mb-desc" value={f.description} onChange={upd("description")} maxLength={100} /></div>
    <Button type="button" variant="outline" disabled={busy || !f.bankName || !f.accountNumber} onClick={verify}>Verify account</Button>
    {name && <p className="text-sm">Registered name: <span className="font-semibold">{name}</span></p>}
    {name && amount > 0 && fee != null && <dl className="rounded-md border border-border p-4 text-sm space-y-1.5">
      <div className="flex justify-between"><dt className="text-muted-foreground">Recipient receives</dt><dd>{fmt(amount)}</dd></div>
      <div className="flex justify-between"><dt className="text-muted-foreground">Transfer fee</dt><dd>{fmt(fee)}</dd></div>
      <div className="flex justify-between font-semibold border-t border-border pt-1.5"><dt>Total deducted</dt><dd>{fmt(amount + fee)}</dd></div>
    </dl>}
    {msg && <p role="status" className={`text-sm ${msg.ok ? "text-primary" : "text-destructive"}`}>{msg.text}</p>}
    <Button type="submit" disabled={busy || !name}>{busy ? "Sending…" : "Send to bank"}</Button>
  </form>;
}
