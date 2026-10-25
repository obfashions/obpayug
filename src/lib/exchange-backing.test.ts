import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), live: vi.fn(), tables: {} as Record<string, any> }));
function q(table: string) {
  const res = mocks.tables[table];
  const chain: any = { select: () => chain, eq: () => chain, order: () => chain, limit: () => chain,
    maybeSingle: async () => ({ data: Array.isArray(res) ? res[0] : res }),
    then: (f: any) => Promise.resolve({ data: Array.isArray(res) ? res : [res] }).then(f) };
  return chain;
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc, from: q } }));
vi.mock("./gateway.server", () => ({ getGatewayCreds: async () => ({}), gatewayLiveBalances: mocks.live }));
import { convertBalance } from "./money.server";
import type { Identity } from "./identity.server";

const id = { userId: "m1", isAdmin: false } as Identity;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.tables = {
    merchant_wallets: [{ available_balance: 28000, currency: "UGX", balances_by_currency: {} }],
    merchant_balances: [{ currency: "RWF", available_balance: 0 }],
    profiles: { default_currency: "UGX" },
    site_settings: { value: "1.5" },
  };
  globalThis.fetch = vi.fn(async () => ({ json: async () => ({ result: "success", rates: { UGX: 3700, RWF: 1300 } }) })) as any;
});

describe("exchanges check both wallets", () => {
  it("blocks when the from-wallet is below the amount", async () => {
    const r = await convertBalance(id, { from: "UGX", to: "RWF", amount: 30000 });
    expect(r.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("blocks when the to-wallet holds less than the exchanged amount", async () => {
    mocks.live.mockResolvedValue([{ currency: "RWF", available: 276 }]);
    const r = await convertBalance(id, { from: "UGX", to: "RWF", amount: 28000 });
    expect(r.success).toBe(false);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("allows the exchange when the to-wallet has enough funds", async () => {
    mocks.live.mockResolvedValue([{ currency: "RWF", available: 50000 }]);
    const r = await convertBalance(id, { from: "UGX", to: "RWF", amount: 28000 });
    expect(r.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
});
