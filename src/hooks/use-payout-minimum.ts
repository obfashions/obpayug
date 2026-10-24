import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { platform } from "@/lib/platform";
import { useAuth } from "@/contexts/AuthContext";
import { minimumFeeInclusivePayout, payoutFeePercent } from "@/lib/platform-fees";
import type { PayoutFeeMode } from "@/lib/payout-fee-mode";

/**
 * Live minimum for a payout in the given currency. Fees are charged on top of
 * the entered amount, so the minimum is simply the partner's minimum (with the
 * configured UGX floor). The balance must cover amount + fees, which the
 * server checks atomically when reserving the payout.
 */
export function usePayoutMinimum(currency: string, enabled = true) {
  const { user } = useAuth();
  const [result, setResult] = useState<{ currency: string; minimum: number | null; loading: boolean; feeMode: PayoutFeeMode }>({ currency: "", minimum: null, loading: true, feeMode: "account" });
  useEffect(() => {
    if (!enabled || !currency || !user) return;
    let cancelled = false;
    setResult({ currency, minimum: null, loading: true, feeMode: "account" });
    void Promise.all([
      platform("payout-methods", { currency }),
      supabase.from("platform_settings").select("withdraw_fee_percent,min_payout_amount,currency_fees").limit(1).maybeSingle(),
      supabase.from("merchant_payout_preferences").select("fee_mode").eq("merchant_id", user.id).maybeSingle(),
    ]).then(([rules, settings, preference]) => {
      if (cancelled) return;
      const partnerMinimum = Number(rules.data?.minimum);
      const feeMode: PayoutFeeMode = preference.data?.fee_mode === "amount" ? "amount" : "account";
      const calculated = rules.success && rules.data?.available && !settings.error && !preference.error && settings.data && partnerMinimum > 0
        ? feeMode === "amount" ? minimumFeeInclusivePayout(partnerMinimum, currency, payoutFeePercent(currency, Number(settings.data.withdraw_fee_percent), settings.data.currency_fees), rules.data.fee) : partnerMinimum
        : null;
      const minimum = calculated == null ? null : Math.max(calculated, currency === "UGX" ? Number(settings.data?.min_payout_amount) || 0 : 0);
      setResult({ currency, minimum, loading: false, feeMode });
    }).catch(() => { if (!cancelled) setResult({ currency, minimum: null, loading: false, feeMode: "account" }); });
    return () => { cancelled = true; };
  }, [currency, enabled, user?.id]);
  return result.currency === currency ? result : { currency, minimum: null, loading: true, feeMode: "account" as const };
}
