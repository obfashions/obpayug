import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { platform } from "@/lib/platform";

/**
 * Live minimum for a payout in the given currency. Fees are charged on top of
 * the entered amount, so the minimum is simply the partner's minimum (with the
 * configured UGX floor). The balance must cover amount + fees, which the
 * server checks atomically when reserving the payout.
 */
export function usePayoutMinimum(currency: string, enabled = true) {
  const [result, setResult] = useState<{ currency: string; minimum: number | null; loading: boolean }>({ currency: "", minimum: null, loading: true });
  useEffect(() => {
    if (!enabled || !currency) return;
    let cancelled = false;
    setResult({ currency, minimum: null, loading: true });
    void Promise.all([
      platform("payout-methods", { currency }),
      supabase.from("platform_settings").select("withdraw_fee_percent,min_payout_amount").limit(1).maybeSingle(),
    ]).then(([rules, settings]) => {
      if (cancelled) return;
      const partnerMinimum = Number(rules.data?.minimum);
      const calculated = rules.success && rules.data?.available && !settings.error && settings.data && partnerMinimum > 0
        ? partnerMinimum
        : null;
      const minimum = calculated == null ? null : Math.max(calculated, currency === "UGX" ? Number(settings.data?.min_payout_amount) || 0 : 0);
      setResult({ currency, minimum, loading: false });
    }).catch(() => { if (!cancelled) setResult({ currency, minimum: null, loading: false }); });
    return () => { cancelled = true; };
  }, [currency, enabled]);
  return result.currency === currency ? result : { currency, minimum: null, loading: true };
}
