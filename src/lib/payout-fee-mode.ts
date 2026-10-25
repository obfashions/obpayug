import { isWholeCurrency, minimumFeeInclusivePayout, payoutPlatformFee } from "./platform-fees";

export type PayoutFeeMode = "account" | "amount";
export type PayoutRules = { min: number; flat: number; percent: number; floor: number };

export function payoutAmounts(amount: number, currency: string, rules: PayoutRules, mode: PayoutFeeMode, platformPercent: number, suggest = true) {
  const platformFee = payoutPlatformFee(amount, currency, platformPercent);
  const minimum = mode === "amount"
    ? minimumFeeInclusivePayout(rules.min, currency, platformPercent, { type: rules.flat ? "flat" : "percent", amount: rules.flat, floor: rules.floor })
    : rules.min;
  const gross = mode === "amount" ? amount - platformFee
    : rules.flat ? amount + rules.flat : rules.percent ? Math.max(amount / (1 - rules.percent / 100), amount + rules.floor) : amount;
  const partnerFee = mode === "amount"
    ? rules.flat || Math.max(gross * rules.percent / 100, rules.floor)
    : gross - amount;
  const net = mode === "amount" ? gross - partnerFee : amount;
  const totalDebit = mode === "amount" ? amount : gross + platformFee;
  let error: string | null = null;
  if (!Number.isFinite(amount) || amount <= 0) error = "Enter an amount greater than zero. No money was sent.";
  else if (minimum == null || amount < minimum || gross < rules.min || net <= 0) error = minimum == null
    ? "The configured fees leave no money to send. Contact ObPay support."
    : `The minimum payout is ${currency} ${minimum.toLocaleString("en")}. No money was sent.`;
  let compatibleAmount: number | null = null;
  const fractional = isWholeCurrency(currency) && (!Number.isInteger(gross) || !Number.isInteger(net));
  if (!error && (![gross, net, totalDebit].every(Number.isFinite) || fractional)) {
    if (suggest && Number.isSafeInteger(amount)) {
      // Never round a fee locally: the partner computes it independently.
      // Offer the closest lower valid entered amount, or the next valid amount
      // when below that would breach the minimum. Approval is a separate action.
      for (let delta = 1; delta <= 20000; delta++) {
        const lower = amount - delta;
        if (lower >= (minimum ?? Infinity) && !payoutAmounts(lower, currency, rules, mode, platformPercent, false).error) {
          compatibleAmount = lower;
          break;
        }
      }
      if (compatibleAmount == null) {
        for (let delta = 1; delta <= 20000; delta++) {
          const higher = amount + delta;
          if (!payoutAmounts(higher, currency, rules, mode, platformPercent, false).error) {
            compatibleAmount = higher;
            break;
          }
        }
      }
    }
    error = compatibleAmount == null
      ? `The payment network cannot send this ${currency} amount after fees. Choose another amount. No money was sent.`
      : `Use ${currency} ${compatibleAmount.toLocaleString("en")} so the payment network can send a whole amount after both fees. No money was sent.`;
  }
  return { gross, net, partnerFee, platformFee, totalDebit, minimum, error, compatibleAmount };
}

export function payoutFeeSummary(mode: PayoutFeeMode) {
  return mode === "amount"
    ? "ObPay and payment-network fees are deducted from the submitted amount. Your wallet loses only that amount; the recipient gets the remainder."
    : "ObPay and payment-network fees are added to the wallet deduction. The recipient gets the full submitted amount.";
}