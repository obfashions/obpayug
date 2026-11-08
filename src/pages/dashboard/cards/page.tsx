import { useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invokeObpay } from "@/lib/edge-function";
import { Link } from "@/lib/router-compat";
import { CARD_CURRENCIES, CARD_MINIMUMS } from "@/lib/card-payments";
import { platform } from "@/lib/platform";

export default function CardsPage() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [checkout, setCheckout] = useState("");
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    await invokeObpay({ _action: "sync-all-pending" });
    const r = await invokeObpay({ action: "card-list" });
    if (r.success) setRows(r.data.purchases || []); else setError(r.error);
  }
  useEffect(() => { void load(); setReference(crypto.randomUUID()); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(""); setCheckout("");
    const r = await invokeObpay({ action: "card-create", amount: Number(amount), currency, customer_name: name.trim(), customer_email: email.trim(), phone_number: phone, description, reference, redirect_url: `${window.location.origin}/dashboard/cards` });
    if (r.success) { setCheckout(r.data.checkout_url || ""); await load(); setReference(crypto.randomUUID()); }
    else setError(r.error);
    setBusy(false);
  }
  return <DashboardLayout><div className="max-w-4xl mx-auto space-y-7">
    <header><CreditCard className="text-primary mb-3" size={30}/><h1 className="text-2xl font-semibold">Card payments</h1><p className="text-sm text-muted-foreground mt-2">Debit and credit card collections in USD, KES and NGN.</p></header>
    <p className="text-sm text-muted-foreground border-y border-border py-4">Confirmed proceeds, less verified network charges and your applicable ObPay fee, are credited in the payment currency. Existing restricted UGX card proceeds remain unchanged in <Link to="/dashboard/service-history" className="text-primary underline">service history</Link>.</p>
    <form onSubmit={submit} className="space-y-4 max-w-lg">
      <div><label htmlFor="card-currency" className="text-sm font-medium">Payment currency</label><select id="card-currency" className="w-full border border-border rounded-md bg-background p-2" value={currency} onChange={e => { setCurrency(e.target.value); setAmount(""); }}>{CARD_CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></div>
      <div><label htmlFor="card-amount" className="text-sm font-medium">Amount ({currency})</label><Input id="card-amount" type="number" min={CARD_MINIMUMS[currency]} step={currency === "USD" ? 0.01 : 1} required value={amount} onChange={e => setAmount(e.target.value)}/></div>
      <div><label htmlFor="card-name" className="text-sm font-medium">Customer name</label><Input id="card-name" required maxLength={120} value={name} onChange={e => setName(e.target.value)}/></div>
      <div><label htmlFor="card-email" className="text-sm font-medium">Customer email</label><Input id="card-email" required type="email" value={email} onChange={e => setEmail(e.target.value)}/></div>
      {currency === "KES" && <div><label htmlFor="card-phone" className="text-sm font-medium">Customer phone (Kenya)</label><Input id="card-phone" required type="tel" value={phone} onChange={e => setPhone(e.target.value)}/></div>}
      <div><label htmlFor="card-description" className="text-sm font-medium">Payment description</label><Input id="card-description" required maxLength={500} value={description} onChange={e => setDescription(e.target.value)}/></div><Button disabled={busy || !reference}><CreditCard size={16}/> {busy ? "Creating…" : "Create secure checkout"}</Button>
    </form>
    {checkout && <div className="space-y-3 border-y border-border py-4"><p className="break-all text-sm font-mono">{checkout}</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => navigator.clipboard.writeText(checkout)}>Copy link</Button><Button asChild><a href={checkout} target="_blank" rel="noreferrer">Open checkout</a></Button></div></div>}
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <div className="flex items-center justify-between"><h2 className="font-semibold">Recent card payments</h2><Button variant="outline" size="icon" onClick={load} aria-label="Refresh card payments" title="Refresh card payments"><RefreshCw size={16}/></Button></div>
    {!rows.length && <p className="text-sm text-muted-foreground">No card payments yet.</p>}
    {rows.map(r => <article key={r.reference} className="border-b border-border pb-4 space-y-1"><div className="flex justify-between gap-3"><span>{r.description}</span><span className="text-sm text-muted-foreground">{r.status}</span></div><p className="text-sm">{Number(r.amount).toLocaleString()} {r.currency}{r.status === "success" ? ` · Fee ${Number(r.fee).toLocaleString()} ${r.currency}` : " · Charges awaiting confirmation"}</p><p className="text-xs font-mono break-all text-muted-foreground">{r.reference}</p>{r.status === "pending" && r.checkout_url && <a className="text-primary text-sm underline" href={r.checkout_url} target="_blank" rel="noreferrer">Resume checkout</a>}</article>)}
  </div></DashboardLayout>;
}