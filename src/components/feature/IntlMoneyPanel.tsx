import { useState } from "react";
import { platform } from "@/lib/platform";
import { MONEY_COUNTRIES } from "@/lib/countries";
import { useCurrency } from "@/contexts/CurrencyContext";
import { usePayoutMinimum } from "@/hooks/use-payout-minimum";
import { Button } from "@/components/ui/button";

/** Kenya / Rwanda collections and payouts (Uganda uses the main form on the page). */
export default function IntlMoneyPanel({ mode }: { mode: "collect" | "payout" }) {
  const { walletCurrencies, activeCurrency, setActiveCurrency } = useCurrency();
  const intl = MONEY_COUNTRIES.filter((c) => c.currency !== "UGX" && walletCurrencies.includes(c.currency));
  const [picked, setCur] = useState<string>("");
  const cur = intl.some((c) => c.currency === activeCurrency) ? activeCurrency : intl.some((c) => c.currency === picked) ? picked : intl[0]?.currency || "";
  const country = intl.find((c) => c.currency === cur);
  const payoutMinimum = usePayoutMinimum(cur, mode === "payout");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ phone: "", network: "", amount: "", name: "", email: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    if (!country) return;
    e.preventDefault();
    if (busy) return;
    if (mode === "payout" && (payoutMinimum.minimum == null || Number(form.amount) < payoutMinimum.minimum)) {
      setMsg({ ok: false, text: payoutMinimum.minimum == null ? "Withdrawal minimum is unavailable. Please try again shortly." : `Minimum payout: ${cur} ${payoutMinimum.minimum.toLocaleString("en")}.` });
      return;
    }
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = {
      currency: cur,
      amount: Number(form.amount),
      phone_number: form.phone,
      network: form.network || country.networks[0]?.value || "",
      customer_name: form.name,
      customer_email: form.email,
      description: form.description,
    };
    const res = await platform(mode === "collect" ? "intl.collect" : "intl.payout", body);
    setBusy(false);
    if (!res.success) return setMsg({ ok: false, text: res.error || "Something went wrong." });
    const d: any = res.data || {};
    if (mode === "collect") {
      setMsg({ ok: true, text: d.prompt_sent ? "PIN prompt sent. Ask the customer to approve it on their phone." : "Payment started. Share the secure payment page with the customer.", link: d.checkout_url || undefined });
    } else {
      setMsg({ ok: true, text: `Payout sent. Recipient gets ${Number(d.recipient_gets || 0).toLocaleString()} ${cur} (fee ${Number(d.fee || 0).toLocaleString()} ${cur}).` });
    }
    setForm({ phone: "", network: "", amount: "", name: "", email: "", description: "" });
  }

  if (!country) return null;
  const input = "w-full px-3 py-2.5 rounded-lg border border-background-200 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:border-primary-400";
  return (
    <div className="bg-background-50 rounded-xl border border-background-200/70 p-4">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 cursor-pointer text-left">
        <div>
          <p className="font-semibold text-sm text-foreground-900">{mode === "collect" ? "Collect in Kenya or Rwanda" : "Send to Kenya or Rwanda"}</p>
          <p className="text-xs text-foreground-600">🇰🇪 KES M-Pesa & Airtel · 🇷🇼 RWF MTN & Airtel</p>
        </div>
        <i className={`ri-arrow-${open ? "up" : "down"}-s-line text-xl text-foreground-600`} />
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 flex gap-2">
            {intl.map((c) => (
              <Button key={c.currency} variant="outline" type="button" onClick={() => { setCur(c.currency); setActiveCurrency(c.currency); setForm({ ...form, network: "" }); setMsg(null); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border cursor-pointer ${cur === c.currency ? "border-primary-500 bg-primary-50 text-primary-700 font-medium" : "border-background-200 text-foreground-700"}`}>
                {c.flag} {c.country} ({c.currency})
              </Button>
            ))}
          </div>
          <select value={form.network || country.networks[0]?.value || ""} onChange={set("network")} className={input}>
            {country.networks.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
          </select>
          <input required value={form.phone} onChange={set("phone")} placeholder={`Mobile number, e.g. ${country.example}`} inputMode="tel" className={input} />
          <div>
            <input aria-label={`Amount (${cur})`} type="number" step={1} min={mode === "payout" ? payoutMinimum.minimum ?? 1 : 1} required value={form.amount} onChange={set("amount")} placeholder={`Amount (${cur}, whole number)`} inputMode="numeric" className={input} />
            {mode === "payout" && <p aria-live="polite" className="mt-1 text-xs text-foreground-600">{payoutMinimum.loading ? "Checking minimum…" : payoutMinimum.minimum == null ? "Minimum unavailable. Try again shortly." : `Minimum payout: ${cur} ${payoutMinimum.minimum.toLocaleString("en")}. Fees are added on top.`}</p>}
...
          {mode === "payout" && <p className="sm:col-span-2 text-xs text-foreground-600">Paid from your {cur} balance. The recipient gets the full amount you enter; the withdrawal fee is charged on top of it.</p>}
          <Button disabled={busy || mode === "payout" && payoutMinimum.minimum == null} className="sm:col-span-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-background-50 rounded-lg py-2.5 text-sm font-medium cursor-pointer">
            {busy ? "Please wait…" : mode === "collect" ? `Request ${cur} payment` : `Send ${cur}`}
          </Button>
          {msg && (
            <div className={`sm:col-span-2 text-sm rounded-lg p-3 ${msg.ok ? "bg-accent-50 text-accent-700" : "bg-red-50 text-red-700"}`}>
              {msg.text}
              {msg.link && <a href={msg.link} target="_blank" rel="noreferrer" className="block mt-1 underline break-all">Open payment page</a>}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
