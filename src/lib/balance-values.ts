export interface BalanceWallet {
  available_balance?: number | null;
  currency?: string | null;
  balances_by_currency?: unknown;
}

/** Scalar main balance replaces its JSON mirror; managed funds are a separate store. */
export function combinedBalances(wallet: BalanceWallet | null, managed: Array<{ currency: string; available_balance: number }>, mainCurrency = "UGX") {
  const raw = wallet?.balances_by_currency;
  const balances: Record<string, number> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [currency, amount] of Object.entries(raw)) balances[currency.toUpperCase()] = Number(amount) || 0;
  }
  const main = String(mainCurrency || wallet?.currency || "UGX").toUpperCase();
  if (wallet?.available_balance != null) balances[main] = Number(wallet.available_balance) || 0;
  for (const row of managed) {
    const currency = row.currency.toUpperCase();
    balances[currency] = (balances[currency] || 0) + (Number(row.available_balance) || 0);
  }
  return balances;
}