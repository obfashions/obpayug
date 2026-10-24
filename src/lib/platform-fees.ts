/** Currencies whose mobile-money rails only accept whole amounts. */
const WHOLE = new Set(["UGX", "RWF", "KES", "XOF", "XAF", "CDF", "ZMW", "SLL"]);

export function isWholeCurrency(currency: string) {
  return WHOLE.has(String(currency || "").toUpperCase());
}

function roundUp(value: number, currency: string) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return WHOLE.has(currency.toUpperCase()) ? Math.ceil(value - 1e-9) : Math.ceil(value * 100 - 1e-9) / 100;
}

/**
 * ObPay's charge on money a merchant receives. The admin percentage is the
 * merchant's total cost and must at least cover the partner's own fee, so ObPay
 * never pays the partner out of its own pocket.
 */
export function collectionFee(amount: number, currency: string, platformPercent: number, partnerFee = 0) {
  const pct = Math.min(Math.max(Number(platformPercent) || 0, 0), 100);
  const fee = Math.max(roundUp(amount * pct / 100, currency), roundUp(partnerFee, currency));
  return Math.min(fee, amount);
}

/** Read only trusted gateway responses; an explicit zero fee is not missing data. */
export function reportedCollectionFee(data: { fee?: unknown; net_amount?: unknown; amount?: unknown } | null | undefined): number | undefined {
  if (!data) return undefined;
  if (data.fee != null && data.fee !== "") {
    const fee = Number(data.fee);
    if (Number.isFinite(fee) && fee >= 0) return fee;
  }
  if (data.amount != null && data.net_amount != null && data.net_amount !== "") {
    const amount = Number(data.amount);
    const net = Number(data.net_amount);
    if (Number.isFinite(amount) && Number.isFinite(net) && amount >= 0 && net >= 0 && net <= amount) return amount - net;
  }
  return undefined;
}

function clampPercent(value: number) {
  return Math.min(Math.max(Number(value) || 0, 0), 100);
}

/** Admin-set per-currency fee override from platform_settings.currency_fees, e.g. {"RWF":{"withdraw":1}}. */
export function currencyFeeOverride(currencyFees: unknown, currency: string, kind: "collect" | "withdraw"): number | undefined {
  const row = (currencyFees as Record<string, Record<string, unknown>> | null)?.[String(currency || "").toUpperCase()];
  const v = Number(row?.[kind]);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : undefined;
}

/** Resolve the currency's current ObPay payout rate; refunds bypass this rate. */
export function payoutFeePercent(currency: string, configuredPercent: number, currencyFees?: unknown) {
  return currencyFeeOverride(currencyFees, currency, "withdraw") ?? clampPercent(configuredPercent);
}

/** Resolve the currency's current ObPay collection rate. */
export function collectFeePercent(currency: string, configuredPercent: number, currencyFees?: unknown) {
  return currencyFeeOverride(currencyFees, currency, "collect") ?? clampPercent(configuredPercent);
}

/** ObPay's own withdrawal charge; the partner deducts its fee separately from what remains. */
export function payoutPlatformFee(amount: number, currency: string, withdrawPercent: number) {
  const pct = Math.min(Math.max(Number(withdrawPercent) || 0, 0), 100);
  return Math.min(roundUp(amount * pct / 100, currency), amount);
}

/** Entered amount needed to leave the partner's minimum after ObPay's charge. */
export function minimumFeeInclusivePayout(partnerMinimum: number, currency: string, withdrawPercent: number, partnerFee?: { type?: string; floor?: number; amount?: number; value?: number }) {
  const pct = Math.min(Math.max(Number(withdrawPercent) || 0, 0), 100);
  if (pct >= 100) return null;
  const unit = WHOLE.has(currency.toUpperCase()) ? 1 : 0.01;
  const fixedFee = partnerFee?.type === "flat" ? Number(partnerFee.amount ?? partnerFee.value) || 0 : Number(partnerFee?.floor) || 0;
  // The partner fee must leave a positive recipient amount, even when its floor equals its minimum.
  const sendMinimum = Math.max(partnerMinimum, fixedFee > 0 ? fixedFee + unit : 0);
  return roundUp(sendMinimum / (1 - pct / 100), currency);
}

/** The partner's documented collection fee (1.5%), used when it is not reported. */
export const PARTNER_COLLECTION_PERCENT = 1.5;
