import { isWholeCurrency, minimumFeeInclusivePayout, payoutPlatformFee } from "./platform-fees";

export type PayoutFeeMode = "account" | "amount";
export type PayoutRules = { min: number; flat: number; percent: number; floor: number };

export function payoutAmounts(amount: number, currency: string, rules: PayoutRules, mode: PayoutFeeMode, platformPercent: number) {
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
  else if (![gross, net, totalDebit].every(Number.isFinite) || isWholeCurrency(currency) && (!Number.isInteger(gross) || !Number.isInteger(net)))
    error = `This mobile-money withdrawal would result in a fractional ${currency} amount after the fee. Enter a compatible whole amount. No money was sent.`;
  return { gross, net, partnerFee, platformFee, totalDebit, minimum, error };
}

export function payoutFeeSummary(mode: PayoutFeeMode) {
  return mode === "amount"
    ? "ObPay and payment-network fees are deducted from the submitted amount. Your wallet loses only that amount; the recipient gets the remainder."
    : "ObPay and payment-network fees are added to the wallet deduction. The recipient gets the full submitted amount.";
}