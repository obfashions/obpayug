/** Card currencies explicitly documented by the connected payment network. */
export const CARD_CURRENCIES = ["USD", "KES", "NGN"] as const;
export const CARD_MINIMUMS: Record<string, number> = { USD: 0.5, KES: 1, NGN: 100 };
export function cardPaymentError(currency: string, amount: number): string | null {
  if (!CARD_CURRENCIES.some(c => c === currency)) return "Card payments support USD, KES and NGN. Choose one of these currencies.";
  if (!Number.isFinite(amount) || amount < CARD_MINIMUMS[currency]) return `Minimum card payment is ${CARD_MINIMUMS[currency]} ${currency}.`;
  if (currency !== "USD" && !Number.isInteger(amount)) return "Enter a whole amount without decimals.";
  if (currency === "USD" && Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) return "USD amounts allow at most two decimal places.";
  return null;
}