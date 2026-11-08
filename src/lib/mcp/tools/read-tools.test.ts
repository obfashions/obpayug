import { beforeEach, describe, expect, it, vi } from "vitest";

const { accountClient, calls, rows } = vi.hoisted(() => ({ accountClient: vi.fn(), calls: [] as Array<unknown[]>, rows: {} as Record<string, unknown> }));
vi.mock("../access", () => ({ accountClient }));
import wallets from "./get-wallet-balances";
import transactions from "./list-transactions";

beforeEach(() => {
  calls.length = 0;
  rows.merchant_wallets = { available_balance: 120, currency: "UGX", balances_by_currency: { UGX: 900 } };
  rows.merchant_balances = [{ currency: "UGX", available_balance: 30 }, { currency: "RWF", available_balance: 40 }];
  rows.transactions = [];
  accountClient.mockResolvedValue({ owner: "verified-owner", mainCurrency: "UGX", client: { from: (table: string) => {
    const result = { data: rows[table], error: null };
    const query = {
      select: (fields: string) => { calls.push([table, "select", fields]); return query; },
      eq: (field: string, value: string) => { calls.push([table, "eq", field, value]); return query; },
      limit: (value: number) => { calls.push([table, "limit", value]); return query; },
      order: () => query,
      maybeSingle: () => Promise.resolve(result),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  } } });
});
describe("Read-only MCP ledger tools", () => {
  it("keeps currency balances separate and ignores the stale main mirror", async () => {
    const result = await wallets.handler({}, {} as never);
    expect(result.content).toEqual([{ type: "text", text: "UGX: 150\nRWF: 40" }]);
    expect(calls).toContainEqual(["merchant_wallets", "eq", "user_id", "verified-owner"]);
    expect(calls).toContainEqual(["merchant_balances", "eq", "merchant_id", "verified-owner"]);
  });
  it("binds history to the verified owner with a bounded currency filter", async () => {
    await transactions.handler({ limit: 10, currency: "RWF" }, {} as never);
    expect(calls).toContainEqual(["transactions", "eq", "user_id", "verified-owner"]);
    expect(calls).toContainEqual(["transactions", "eq", "currency", "RWF"]);
    expect(calls).toContainEqual(["transactions", "limit", 10]);
    expect(calls).toContainEqual(["transactions", "select", "id,reference,type,amount,currency,status,fee_amount,net_amount,created_at"]);
  });
});