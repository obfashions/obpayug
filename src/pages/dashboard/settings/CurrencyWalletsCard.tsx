import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getCurrencyInfo, formatCurrency } from "@/lib/currency";

/** Lets a merchant turn currency wallets on/off and pick the main (default) currency. */
export default function CurrencyWalletsCard() {
  const { user, profile, refreshProfile } = useAuth();
  const { platformCurrencies, walletCurrencies, balances, activeCurrency, setActiveCurrency } = useCurrency();
  const [on, setOn] = useState<string[]>(walletCurrencies);
  const [main, setMain] = useState(activeCurrency);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => setOn(walletCurrencies), [walletCurrencies.join(",")]);
  useEffect(() => setMain(activeCurrency), [activeCurrency]);

  function toggle(c: string) {
    setMsg(null);
    if (on.includes(c)) {
      if (c === main) return setMsg({ ok: false, text: "Choose another main currency before turning this wallet off." });
      if ((balances[c] || 0) > 0) return setMsg({ ok: false, text: `Your ${c} wallet still has money. Withdraw or exchange it first.` });
      setOn(on.filter((x) => x !== c));
    } else setOn([...on, c]);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const list = Array.from(new Set([profile?.default_currency || "UGX", main, ...on]));
    const { error } = await supabase
      .from("profiles")
      .update({ enabled_currencies: list } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) return setMsg({ ok: false, text: "Could not save. Please try again." });
    await refreshProfile();
    setActiveCurrency(main);
    setMsg({ ok: true, text: "Wallets updated. Selected wallet: " + main + "." });
  }

  return (
    <div className="bg-background-50 rounded-xl p-6 border border-background-200/70">
      <h3 className="font-heading font-semibold text-base text-foreground-900 mb-1">Currency wallets</h3>
      <p className="text-sm text-foreground-600 mb-4">Each wallet keeps its own balance. Choose one main wallet for the figures shown when you open ObPay.</p>
      <div className="space-y-2">
        {platformCurrencies.map((c) => {
          const info = getCurrencyInfo(c);
          const active = on.includes(c);
          return (
            <div key={c} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-background-200">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground-900">{info.flag} {info.name} ({c})</p>
                <p className="text-sm font-semibold text-foreground-800 mt-1">{formatCurrency(balances[c] || 0, c)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1 text-xs text-foreground-700 cursor-pointer">
                  <input type="radio" name="main-currency" checked={main === c} disabled={!active} onChange={() => setMain(c)} />
                  Main
                </label>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  aria-pressed={active}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${active ? "bg-primary-500" : "bg-background-300"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-all ${active ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {msg && <p className={`text-sm mt-3 ${msg.ok ? "text-accent-700" : "text-red-700"}`}>{msg.text}</p>}
      <button onClick={save} disabled={saving} className="mt-4 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-background-50 rounded-lg px-5 py-2.5 text-sm font-medium cursor-pointer">
        {saving ? "Saving…" : "Save wallets"}
      </button>
    </div>
  );
}
