export interface BalanceWallet {
  available_balance?: number | null;
  currency?: string | null;
  balances_by_currency?: Record<string, number> | null;
}

/** Scalar main balance replaces its JSON mirror; managed funds are a separate store. */
export function combinedBalances(wallet: BalanceWallet | null, managed: Array<{ currency: string; available_balance: number }>, mainCurrency = "UGX") {
  const balances: Record<string, number> = { ...(wallet?.balances_by_currency || {}) };
  const main = String(mainCurrency || wallet?.currency || "UGX").toUpperCase();
  if (wallet?.available_balance != null) balances[main] = Number(wallet.available_balance) || 0;
  for (const row of managed) {
    const currency = row.currency.toUpperCase();
    balances[currency] = (balances[currency] || 0) + (Number(row.available_balance) || 0);
  }
  return balances;
}