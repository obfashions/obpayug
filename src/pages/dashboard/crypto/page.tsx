import { useEffect, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";

export default function CryptoPage() {
  const [usd, setUsd] = useState(0);
  const [payoutsOn, setPayoutsOn] = useState<boolean | null>(null);
  const [form, setForm] = useState({ amount: "", name: "", email: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void platform<Array<{ currency: string; available_balance: number }>>("balances.get").then((b) => {
      setUsd(Number((b.data || []).find((r) => r.currency === "USD")?.available_balance || 0));
    });
    void platform<any>("payout-methods", { currency: "USD" }).then((r) => setPayoutsOn(!!r.data?.available));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(""); setLink("");
    const res = await platform<any>("intl.collect", {
      currency: "USD", crypto: true, amount: Number(form.amount),
      customer_name: form.name, customer_email: form.email, description: form.description,
    });
    setBusy(false);
    if (!res.success) return setErr(res.error || "Could not create the crypto payment.");
    setLink(res.data?.crypto_payment_url || res.data?.checkout_url || "");
  }

  const input = "w-full px-3 py-2.5 rounded-lg border border-background-200 bg-background-50 text-sm";
  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Crypto</h1>
          <p className="text-sm text-foreground-600 mt-1">Accept USDT, BTC and other coins. Payments are credited to your USD balance once confirmed on-chain.</p>
        </div>
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-4">
          <p className="text-xs text-foreground-600">USD balance</p>
          <p className="text-2xl font-semibold text-foreground-900">${usd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-foreground-500 mt-1">Convert it to UGX, KES or RWF on the Currency Exchange page.</p>
        </div>

        <form onSubmit={submit} className="bg-background-50 rounded-xl border border-background-200/70 p-4 space-y-3">
          <p className="font-semibold text-sm">Receive crypto</p>
          <input required value={form.amount} onChange={set("amount")} inputMode="decimal" placeholder="Amount in USD (min 0.50)" className={input} />
          <input required value={form.name} onChange={set("name")} placeholder="Customer full name" className={input} />
          <input required type="email" value={form.email} onChange={set("email")} placeholder="Customer email" className={input} />
          <input value={form.description} onChange={set("description")} placeholder="Description (optional)" className={input} />
          <button disabled={busy} className="w-full py-2.5 rounded-lg bg-primary-500 text-background-50 text-sm font-medium cursor-pointer disabled:opacity-60">{busy ? "Creating…" : "Create crypto payment link"}</button>
          {err && <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">{err}</p>}
          {link && (
            <div className="text-sm bg-accent-50 text-accent-700 rounded-lg p-3 space-y-2">
              <p>Share this link. The customer picks a coin and network and pays.</p>
              <p className="font-mono text-xs break-all">{link}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="px-3 py-1.5 rounded-lg border border-accent-300 cursor-pointer">{copied ? "Copied" : "Copy link"}</button>
                <a href={link} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-accent-300">Open</a>
              </div>
            </div>
          )}
        </form>

        <div className="bg-background-50 rounded-xl border border-background-200/70 p-4">
          <p className="font-semibold text-sm">Send crypto</p>
          <p className="text-sm text-foreground-600 mt-1">
            {payoutsOn === null ? "Checking…" : payoutsOn ? "Crypto withdrawals are available. Contact support to send to a wallet address." : "Crypto withdrawals are not switched on yet. Convert your USD to UGX, KES or RWF and withdraw to mobile money instead."}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
