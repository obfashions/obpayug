// Public ObPay fee summary for the pricing page. Returns only fee percentages,
// never credentials or partner secrets.
import { createServerFn } from "@tanstack/react-start";

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

export const getPublicFees = createServerFn({ method: "GET" }).handler(async (): Promise<PublicFees> => {
  const { WALLET_CURRENCIES, MONEY_COUNTRIES } = await import("./countries");
  const currencies = WALLET_CURRENCIES.map((currency) => {
    const country = MONEY_COUNTRIES.find((c) => c.currency === currency)?.country ?? currency;
    // USD is the card/crypto wallet; other currencies map to their money country.
    return { currency, country: currency === "USD" ? "International (card & crypto)" : country };
  });
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: ps }, { data: exchange }] = await Promise.all([
      supabaseAdmin.from("platform_settings").select("platform_fee_percent,withdraw_fee_percent,currency_fees").limit(1).maybeSingle(),
      supabaseAdmin.from("site_settings").select("value").eq("key", "exchange_fee_percent").maybeSingle(),
    ]);
    if (!ps) return { available: false, exchangeFeePercent: 1.5, currencies: [] };
    const overrides = (ps.currency_fees ?? {}) as Record<string, Record<string, unknown>>;
    const exchangeFeePercent = clampPercent((exchange as { value?: unknown } | null)?.value, 1.5, 20);
    return {
      available: true,
      exchangeFeePercent,
      currencies: currencies.map(({ currency, country }) => {
        const fees = overrides[currency] ?? {};
        const num = (kind: string) => {
          const v = Number(fees[kind]);
          return Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;
        };
        const margin = num("collect_margin");
        const legacy = num("collect");
        return {
          currency,
          country,
          collectionPercent: margin ?? legacy ?? clampPercent(ps.platform_fee_percent, 0),
          payoutPercent: num("withdraw") ?? clampPercent(ps.withdraw_fee_percent, 0),
          legacyCollection: margin == null,
        };
      }),
    };
  } catch {
    return { available: false, exchangeFeePercent: 1.5, currencies: [] };
  }
});
