import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { platform } from "@/lib/platform";
import { useAuth } from "@/contexts/AuthContext";
import { minimumFeeInclusivePayout, payoutFeePercent } from "@/lib/platform-fees";
import type { PayoutFeeMode } from "@/lib/payout-fee-mode";

/**
 * Live minimum for the currency and merchant's persisted fee deduction mode.
 * Submitted-amount mode must leave enough after both fees; account mode adds
 * fees to the debit. The server reserves the full debit atomically.
 */
export function usePayoutMinimum(currency: string, enabled = true) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener("obpay:payout-fees-changed", reload);
    return () => window.removeEventListener("obpay:payout-fees-changed", reload);
  }, []);
  const [result, setResult] = useState<{ currency: string; minimum: number | null; loading: boolean; feeMode: PayoutFeeMode }>({ currency: "", minimum: null, loading: true, feeMode: "account" });
  useEffect(() => {
    if (!enabled || !currency || !user) return;
    let cancelled = false;
    setResult({ currency, minimum: null, loading: true, feeMode: "account" });
    void Promise.all([
      platform("payout-methods", { currency }),
      supabase.from("platform_settings").select("withdraw_fee_percent,min_payout_amount,currency_fees").limit(1).maybeSingle(),
      supabase.from("merchant_payout_preferences").select("fee_mode").eq("merchant_id", user.id).maybeSingle(),
      supabase.from("merchant_fee_exemptions").select("merchant_id").eq("merchant_id", user.id).maybeSingle(),
    ]).then(([rules, settings, preference, exemption]) => {
      if (cancelled) return;
      const partnerMinimum = Number(rules.data?.minimum);
      const feeMode: PayoutFeeMode = preference.data?.fee_mode === "amount" ? "amount" : "account";
      const pct = exemption.data ? 0 : payoutFeePercent(currency, Number(settings.data?.withdraw_fee_percent), settings.data?.currency_fees);
      const calculated = rules.success && rules.data?.available && !settings.error && !preference.error && !exemption.error && settings.data && partnerMinimum > 0
        ? feeMode === "amount" ? minimumFeeInclusivePayout(partnerMinimum, currency, pct, rules.data.fee) : partnerMinimum
        : null;
      const minimum = calculated == null ? null : Math.max(calculated, currency === "UGX" ? Number(settings.data?.min_payout_amount) || 0 : 0);
      setResult({ currency, minimum, loading: false, feeMode });
    }).catch(() => { if (!cancelled) setResult({ currency, minimum: null, loading: false, feeMode: "account" }); });
    return () => { cancelled = true; };
  }, [currency, enabled, user?.id, revision]);
  return result.currency === currency ? result : { currency, minimum: null, loading: true, feeMode: "account" as const };
}
