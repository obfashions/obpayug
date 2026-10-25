import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";
import { useCurrency } from "@/contexts/CurrencyContext";
import { exchangeReceive } from "@/lib/exchange-math";
import { WALLET_CURRENCIES } from "@/lib/countries";
import { Button } from "@/components/ui/button";

const CURS = WALLET_CURRENCIES;

export default function ExchangePage() {
  const { balances, refreshBalances } = useCurrency();
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [fee, setFee] = useState(1.5);
  const [history, setHistory] = useState<any[]>([]);
  const [from, setFrom] = useState("UGX");
  const [to, setTo] = useState("KES");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [r, h] = await Promise.all([
      platform<any>("exchange.rates"),
      platform<any[]>("exchange.list"),
    ]);
    if (r.success) { setRates(r.data.rates); setFee(r.data.fee_percent); } else setMsg({ ok: false, text: r.error || "Rates unavailable." });
    setHistory(h.data || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sourceRate = rates?.[from] ?? 0;
  const destinationRate = rates?.[to] ?? 0;
  const rateReady = Number.isFinite(sourceRate) && sourceRate > 0 && Number.isFinite(destinationRate) && destinationRate > 0;
  const rate = rateReady ? destinationRate / sourceRate : 0;
  const receive = useMemo(() => exchangeReceive(Number(amount) || 0, rate, fee, to), [amount, rate, fee, to]);
  const fromBalance = balances[from] || 0;
  const over = (Number(amount) || 0) > fromBalance;

  async function convert() {
    if (busy) return;
    setBusy(true); setMsg(null);
    const res = await platform<any>("exchange.convert", { from, to, amount: Number(amount) });
    setBusy(false);
    if (!res.success) return setMsg({ ok: false, text: res.error || "Conversion failed." });
    setMsg({ ok: true, text: `Converted ${res.data.from_amount.toLocaleString()} ${from} to ${res.data.to_amount.toLocaleString()} ${to}.` });
    setAmount("");
    void load();
    void refreshBalances();
  }

  const sel = "px-3 py-2.5 rounded-lg border border-background-200 bg-background-50 text-sm";
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Currency Exchange</h1>
          <p className="text-sm text-foreground-600 mt-1">Indicative exchange rates · Estimated fee: {fee}%.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CURS.map((c) => (
            <div key={c} className="bg-background-50 rounded-xl border border-background-200/70 p-3">
              <p className="text-xs text-foreground-600">{c} balance</p>
              <p className="font-semibold text-foreground-900">{(balances[c] || 0).toLocaleString()}</p>
               {rates?.[c] && c !== "USD" && <p className="text-[11px] text-foreground-500">1 USD = {rates[c]?.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>}
            </div>
          ))}
        </div>

        <div className="bg-background-50 rounded-xl border border-background-200/70 p-4 space-y-3 max-w-xl">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <select value={from} onChange={(e) => setFrom(e.target.value)} className={sel}>{CURS.map((c) => <option key={c}>{c}</option>)}</select>
            <Button type="button" variant="ghost" size="icon" onClick={() => { setFrom(to); setTo(from); }} aria-label="Swap currencies"><i className="ri-arrow-left-right-line" /></Button>
            <select value={to} onChange={(e) => setTo(e.target.value)} className={sel}>{CURS.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Amount in ${from}`} className={`${sel} w-full`} />
           {rateReady && from !== to && <p className="text-sm text-foreground-700">1 {from} = {rate.toFixed(to === "USD" ? 6 : 4)} {to} · You get <b>{receive.toLocaleString()} {to}</b> after the {fee}% fee</p>}
          {over && <p className="text-sm text-red-700">Your {from} wallet holds {fromBalance.toLocaleString()} {from}.</p>}
           <Button disabled={busy || over || !rateReady || from === to || !(Number(amount) > 0)} onClick={convert} className="w-full">{busy ? "Checking wallets…" : "Exchange"}</Button>
          {msg && <div className={`text-sm rounded-lg p-3 ${msg.ok ? "bg-accent-50 text-accent-700" : "bg-red-50 text-red-700"}`}>{msg.text}</div>}
          <p className="text-xs text-foreground-500" role="status">We confirm both wallets before every exchange. If the receiving wallet can’t cover the amount, nothing is moved or charged.</p>
        </div>

        {history.length > 0 && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 divide-y divide-background-200/70">
            <p className="px-4 py-3 font-semibold text-sm">Recent conversions</p>
            {history.map((h) => (
              <p key={h.id} className="px-4 py-2 text-sm">{Number(h.from_amount).toLocaleString()} {h.from_currency} → {Number(h.to_amount).toLocaleString()} {h.to_currency} <span className="text-xs text-foreground-500">· {new Date(h.created_at).toLocaleString()}</span></p>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
