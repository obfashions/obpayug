import { useEffect, useState } from "react";
import { getSiteSetting, saveSiteSetting } from "@/lib/site-settings.functions";
import { getAccessToken } from "@/lib/session-token";

export default function ExchangeFeeCard() {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSiteSetting({ data: { key: "exchange_fee_percent" } }).then((r) => setValue(r?.value || "")).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Please sign in again to continue.");
      const r = await saveSiteSetting({ data: { key: "exchange_fee_percent", value, accessToken } });
      setMsg(r.success ? { ok: true, text: "Saved. New exchanges use this rate immediately." } : { ok: false, text: r.error || "Could not save." });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || "Could not save." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
      <h3 className="font-heading font-semibold text-foreground-900 mb-1">
        <i className="ri-exchange-funds-line mr-1.5" />
        Currency Exchange Fee
      </h3>
      <p className="text-xs text-foreground-500 mb-4">
        The percentage ObPay earns when a merchant converts money between wallets. Leave empty for the default 1.5%.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="number"
          min="0"
          max="20"
          step="0.1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1.5"
          className="flex-1 px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 text-sm font-medium cursor-pointer whitespace-nowrap disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save fee"}
        </button>
      </div>
      {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-primary-600" : "text-accent-600"}`}>{msg.text}</p>}
    </div>
  );
}
