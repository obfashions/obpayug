/** Currencies whose mobile-money rails only accept whole amounts. */
const WHOLE = new Set(["UGX", "RWF", "KES"]);

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

/** ObPay's own withdrawal charge; the partner deducts its fee separately from what remains. */
export function payoutPlatformFee(amount: number, currency: string, withdrawPercent: number) {
  const pct = Math.min(Math.max(Number(withdrawPercent) || 0, 0), 100);
  return Math.min(roundUp(amount * pct / 100, currency), amount);
}

/** The partner's documented collection fee (1.5%), used when it is not reported. */
export const PARTNER_COLLECTION_PERCENT = 1.5;
