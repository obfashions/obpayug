/** Amount received after the exchange fee; whole units for zero-decimal currencies, cents for USD. */
export function exchangeReceive(amount: number, rate: number, feePercent: number, to: string) {
  const raw = amount * rate * (1 - feePercent / 100);
  return to === "USD" ? Math.floor(raw * 100) / 100 : Math.floor(raw);
}
