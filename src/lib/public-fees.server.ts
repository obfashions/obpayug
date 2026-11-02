// Public ObPay fee summary for the pricing page. Returns only fee percentages,
// never credentials or partner secrets.
import { createServerFn } from "@tanstack/react-start";
import { WALLET_CURRENCIES, MONEY_COUNTRIES } from "./countries";

export interface PublicCurrencyFee {
  currency: string;
  country: string;
  collectionPercent: number;
  payoutPercent: number;
  /** True when the currency uses the legacy all-inclusive collection rate. */
  legacyCollection: boolean;
}

export interface PublicFees {
  available: boolean;
  exchangeFeePercent: number;
  currencies: PublicCurrencyFee[];
}

function clampPercent(value: unknown, fallback: number, max = 100) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
}

/** Resolves ObPay's displayed fee per currency from the admin's stored settings. */
export function resolvePublicFees(
  currencyFees: Record<string, Record<string, unknown>>,
  platformFeePercent: number,
  withdrawFeePercent: number,
  exchangeValue: unknown,
): PublicFees {
  const exchangeFeePercent = clampPercent(exchangeValue, 1.5, 20);
  const { WALLET_CURRENCIES, MONEY_COUNTRIES } = require("./countries") as typeof import("./countries");
  return {
    available: true,
    exchangeFeePercent,
    currencies: WALLET_CURRENCIES.map((currency) => {
      const country = currency === "USD"
        ? "International (card & crypto)"
        : MONEY_COUNTRIES.find((c) => c.currency === currency)?.country ?? currency;
      const fees = currencyFees[currency] ?? {};
      const num = (kind: string) => {
        const v = Number(fees[kind]);
        return Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;
      };
      const margin = num("collect_margin");
      const legacy = num("collect");
      return {
        currency,
        country,
        collectionPercent: margin ?? legacy ?? clampPercent(platformFeePercent, 0),
        payoutPercent: num("withdraw") ?? clampPercent(withdrawFeePercent, 0),
        legacyCollection: margin == null,
      };
    }),
  };
}

export const getPublicFees = createServerFn({ method: "GET" }).handler(async (): Promise<PublicFees> => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: ps }, { data: exchange }] = await Promise.all([
      supabaseAdmin.from("platform_settings").select("platform_fee_percent,withdraw_fee_percent,currency_fees").limit(1).maybeSingle(),
      supabaseAdmin.from("site_settings").select("value").eq("key", "exchange_fee_percent").maybeSingle(),
    ]);
    if (!ps) return { available: false, exchangeFeePercent: 1.5, currencies: [] };
    return resolvePublicFees(
      (ps.currency_fees ?? {}) as Record<string, Record<string, unknown>>,
      Number(ps.platform_fee_percent) || 0,
      Number(ps.withdraw_fee_percent) || 0,
      (exchange as { value?: unknown } | null)?.value,
    );
  } catch {
    return { available: false, exchangeFeePercent: 1.5, currencies: [] };
  }
});

