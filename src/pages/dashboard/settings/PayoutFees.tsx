import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { payoutFeeSummary, type PayoutFeeMode } from "@/lib/payout-fee-mode";

export default function PayoutFees() {
  const { user } = useAuth();
  const [mode, setMode] = useState<PayoutFeeMode>("account");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase.from("merchant_payout_preferences").select("fee_mode").eq("merchant_id", user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      setLoadError(Boolean(error));
      setMode(data?.fee_mode === "amount" ? "amount" : "account");
      setLoading(false);
      if (error) setMessage("Could not load your payout fee setting. Refresh and try again.");
    });
    return () => { cancelled = true; };
  }, [user?.id]);
  async function save() {
    if (!user || loading || loadError || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.from("merchant_payout_preferences").upsert({ merchant_id: user.id, fee_mode: mode, updated_at: new Date().toISOString() }).select("fee_mode").single();
      setMessage(error || data?.fee_mode !== mode ? "Could not save your setting. Please try again." : "Payout fee setting saved.");
      if (!error && data?.fee_mode === mode) window.dispatchEvent(new Event("obpay:payout-fees-changed"));
    } catch {
      setMessage("Could not save your setting. Please try again.");
    } finally { setSaving(false); }
  }
  return <section className="border-b border-background-200 py-5 space-y-4" aria-labelledby="payout-fee-heading">
    <h3 id="payout-fee-heading" className="font-heading font-semibold text-base text-foreground-900">Who pays payout fees?</h3>
    <fieldset disabled={loading || saving || loadError} className="space-y-3">
      <legend className="text-sm text-foreground-600 mb-3">ObPay and payment-network fees</legend>
      {(["account", "amount"] as const).map((value) => <label key={value} className="flex items-start gap-3 cursor-pointer">
        <input type="radio" name="payout-fee-mode" value={value} checked={mode === value} onChange={() => { setMode(value); setMessage(""); }} className="mt-1 accent-primary-500 shrink-0" />
        <span><span className="block text-sm font-medium text-foreground-900">{value === "account" ? "I pay — charge fees to my wallet" : "Recipient pays — deduct fees from the amount"}</span><span className="block text-xs text-foreground-600 mt-1">{payoutFeeSummary(value)}</span></span>
      </label>)}
    </fieldset>
    <p className="text-xs text-foreground-500">Applies to new dashboard and API payouts in every wallet. Deposits, previous transactions and customer refunds are unchanged.</p>
    <Button onClick={save} disabled={loading || saving || loadError}><i className={saving ? "ri-loader-4-line animate-spin" : "ri-save-line"} aria-hidden="true" />{saving ? "Saving…" : "Save payout fee setting"}</Button>
    {message && <p role="status" className="text-sm text-foreground-700">{message}</p>}
  </section>;
}