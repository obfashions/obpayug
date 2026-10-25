/** Parse only a currency-matched balance rejection, never a merchant allocation. */
export function partnerBalanceFromMessage(message: string, currency: string): number | null {
  const match = message.match(/available\s+([A-Z]{3})\s+balance of\s*(-?\d[\d,]*(?:\.\d+)?)/i);
  if (!match?.[1] || !match[2] || match[1].toUpperCase() !== currency.toUpperCase()) return null;
  const token = match[2];
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(token)) return null;
  const amount = Number(token.replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}