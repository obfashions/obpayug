/** Local demonstration only. Never calls a payment network or changes a wallet. */
export type DemoRecord = { reference: string; type: "collection" | "payout"; status: "pending" | "success" | "failed"; amount: number; currency: "UGX" };
export const DEMO_BALANCE = 100000;

export function isTestApiSecret(secret: string) {
  return secret.trim().startsWith("sk_test_");
}

export function simulateIntegration(path: string, method: "GET" | "POST", body: Record<string, unknown>, records: DemoRecord[]) {
  const reference = String(body.reference || `DEMO-${records.length + 1}`);
  const wrap = (data: unknown) => ({ success: true, simulated: true, data });
  if (method === "POST" && (path === "/collect" || path === "/payouts")) {
    const existing = records.find((record) => record.reference === reference);
    if (existing) return { response: wrap({ ...existing, duplicate: true }), records };
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) return { response: { success: false, simulated: true, error: "Use a positive whole UGX amount." }, records };
    const record: DemoRecord = { reference, type: path === "/collect" ? "collection" : "payout", status: "pending", amount, currency: "UGX" };
    return { response: wrap({ ...record, prompt_sent: false, message: "Simulation only; no PIN prompt or money movement." }), records: [...records, record] };
  }
  if (path.startsWith("/transactions/")) {
    const ref = decodeURIComponent(path.slice("/transactions/".length));
    const record = records.find((entry) => entry.reference === ref);
    if (!record) return { response: { success: false, simulated: true, error: "Simulate a collection or payout with this reference first." }, records };
    const settled: DemoRecord = { ...record, status: "success" };
    return { response: wrap(settled), records: records.map((entry) => entry.reference === ref ? settled : entry) };
  }
  const data = path === "/balance" ? { currency: "UGX", available_balance: DEMO_BALANCE, net: DEMO_BALANCE, balances: [{ currency: "UGX", available_balance: DEMO_BALANCE }] }
    : path === "/transactions" ? records
    : path === "/ping" ? { live: false, merchant_id: "demo-merchant" }
    : path === "/account" ? { merchant_id: "demo-merchant", transactions: records.length }
    : [];
  return { response: wrap(data), records };
}