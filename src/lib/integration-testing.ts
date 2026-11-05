/** Local demonstration only. Never calls a payment network or changes a wallet. */
import { MONEY_COUNTRIES, WALLET_CURRENCIES } from "./countries";
export type DemoRecord = { reference: string; type: "collection" | "payout"; status: "pending" | "success" | "failed"; amount: number; currency: string };
const decimalsFor = (c: string) => MONEY_COUNTRIES.find((m) => m.currency === c)?.decimals ?? 2;
export const DEMO_BALANCE = 100000;

export function isTestApiSecret(secret: string) {
  return /^(sk_test_|sk_sandbox_)/.test(secret.trim());
}

export function simulateIntegration(path: string, method: "GET" | "POST", body: Record<string, unknown>, records: DemoRecord[]) {
  const reference = String(body.reference || `DEMO-${records.length + 1}`);
  const wrap = (data: unknown) => ({ success: true, simulated: true, data });
  if (method === "POST" && (path === "/collect" || path === "/payouts")) {
    const existing = records.find((record) => record.reference === reference);
    if (existing) return { response: wrap({ ...existing, duplicate: true }), records };
    const amount = Number(body.amount);
    const currency = String(body.currency || "UGX").toUpperCase();
    if (!(WALLET_CURRENCIES as readonly string[]).includes(currency)) return { response: { success: false, simulated: true, error: `Unsupported currency ${currency}.` }, records };
    const dec = decimalsFor(currency);
    const scaled = amount * 10 ** dec;
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(scaled - Math.round(scaled)) > 1e-6) return { response: { success: false, simulated: true, error: dec === 0 ? `Use a positive whole ${currency} amount.` : `Use a positive ${currency} amount with at most ${dec} decimals.` }, records };
    const record: DemoRecord = { reference, type: path === "/collect" ? "collection" : "payout", status: "pending", amount, currency };
    return { response: wrap({ ...record, prompt_sent: false, message: "Simulation only; no PIN prompt or money movement." }), records: [...records, record] };
  }
  if (path.startsWith("/transactions/")) {
    const ref = decodeURIComponent(path.slice("/transactions/".length));
    const record = records.find((entry) => entry.reference === ref);
    if (!record) return { response: { success: false, simulated: true, error: "Simulate a collection or payout with this reference first." }, records };
    const settled: DemoRecord = { ...record, status: "success" };
    return { response: wrap(settled), records: records.map((entry) => entry.reference === ref ? settled : entry) };
  }
  const balCur = String(body.currency || "UGX").toUpperCase();
  const data = path === "/balance" ? { simulated_balance: true, currency: balCur, available_balance: DEMO_BALANCE, net: DEMO_BALANCE, balances: WALLET_CURRENCIES.map((c) => ({ currency: c, available_balance: DEMO_BALANCE })) }
    : path === "/transactions" ? records
    : path === "/ping" ? { live: false, merchant_id: "demo-merchant" }
    : path === "/account" ? { merchant_id: "demo-merchant", transactions: records.length }
    : [];
  return { response: wrap(data), records };
}