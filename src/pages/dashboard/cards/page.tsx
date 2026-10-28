import { useEffect, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invokeObpay } from "@/lib/edge-function";
import { Link } from "@/lib/router-compat";

export default function CardsPage() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [balance, setBalance] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const r = await invokeObpay({ action: "card-list" });
    if (r.success) { setBalance(r.data.card_balance); setRows(r.data.purchases); } else setError(r.error);
  }
  useEffect(() => { void load(); setReference(crypto.randomUUID()); }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await invokeObpay({ action: "card-create", amount: Number(amount), description, reference });
    if (r.success) { await load(); if (r.data.checkout_url) window.location.assign(r.data.checkout_url); }
    else setError(r.error);
    setBusy(false);
  }
  return <DashboardLayout><div className="max-w-4xl mx-auto space-y-7">
    <header><CreditCard className="text-primary mb-3" size={30}/><h1 className="text-2xl font-semibold">Card payments</h1><p className="text-sm text-muted-foreground mt-2">Accept debit and credit card payments in UGX.</p></header>
    <section className="border-y border-border py-5"><p className="text-sm text-muted-foreground">Card proceeds</p><p className="text-3xl font-semibold mt-1">{balance.toLocaleString()} <span className="text-base text-muted-foreground">UGX</span></p><p className="text-sm text-muted-foreground mt-2">Card funds are separate from mobile-money funds. <Link to="/support" className="text-primary underline">Contact customer service for a bank withdrawal.</Link></p></section>
    <form onSubmit={submit} className="space-y-4 max-w-lg"><div><label htmlFor="card-amount" className="text-sm font-medium">Amount (UGX)</label><Input id="card-amount" type="number" min={500} max={10000000} step={1} required value={amount} onChange={e => setAmount(e.target.value)}/></div><div><label htmlFor="card-description" className="text-sm font-medium">Payment description</label><Input id="card-description" required maxLength={500} value={description} onChange={e => setDescription(e.target.value)}/></div><Button disabled={busy || !reference}><CreditCard size={16}/> Continue to secure card payment</Button></form>
    {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
    <div className="flex items-center justify-between"><h2 className="font-semibold">Recent card payments</h2><Button variant="outline" size="icon" onClick={load} aria-label="Refresh card payments" title="Refresh card payments"><RefreshCw size={16}/></Button></div>
    {rows.map(r => <article key={r.reference} className="border-b border-border pb-4 space-y-1"><div className="flex justify-between gap-3"><span>{r.description}</span><span className="text-sm text-muted-foreground">{r.status}</span></div><p className="text-sm">{r.amount.toLocaleString()} UGX · Fee {r.fee.toLocaleString()} UGX</p><p className="text-xs font-mono break-all text-muted-foreground">{r.reference}</p>{r.status === "pending" && r.checkout_url && <a className="text-primary text-sm underline" href={r.checkout_url}>Resume card payment</a>}</article>)}
  </div></DashboardLayout>;
}