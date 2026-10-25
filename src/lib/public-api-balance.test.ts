import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  rows: vi.fn(),
  wallet: vi.fn(),
  profile: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => table === "merchant_balances"
          ? { order: mocks.rows }
          : { maybeSingle: table === "merchant_wallets" ? mocks.wallet : mocks.profile },
      }),
    }),
  },
}));
vi.mock("./platform.server", () => ({}));
vi.mock("./settle.server", () => ({ refreshMerchantPendingPayments: mocks.refresh }));
import { apiBalance } from "./public-api.server";

const merchant = "2e213e51-8069-4795-9873-c95192306c8b";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.refresh.mockResolvedValue(undefined);
  mocks.rows.mockResolvedValue({ data: [{ currency: "RWF", available_balance: 0, pending_balance: 0, total_collections: 0, total_payouts: 0 }], error: null });
  mocks.wallet.mockResolvedValue({ data: { available_balance: 446, balances_by_currency: { UGX: 446, RWF: 0 } }, error: null });
  mocks.profile.mockResolvedValue({ data: { default_currency: "UGX" }, error: null });
});
it("returns Mukoya's zero RWF balance without relabeling his 446 UGX", async () => {
  expect(await apiBalance(merchant, "RWF")).toMatchObject({ success: true, data: { currency: "RWF", available_balance: 0, net: 0 } });
  expect(mocks.refresh).toHaveBeenCalledWith(merchant);
});
it("reads the Rwanda credit only after pending partner transactions are reconciled", async () => {
  mocks.refresh.mockImplementation(async () => {
    mocks.rows.mockResolvedValue({ data: [{ currency: "RWF", available_balance: 3391, pending_balance: 0, total_collections: 3600, total_payouts: 0 }], error: null });
  });
  expect(await apiBalance(merchant, "rwf")).toMatchObject({ success: true, data: { currency: "RWF", available_balance: 3391 } });
});
it("keeps the existing default balance response in UGX", async () => {
  expect(await apiBalance(merchant)).toMatchObject({ success: true, data: { currency: "UGX", available_balance: 446 } });
});
it("returns zero for an empty requested wallet instead of another currency's money", async () => {
  mocks.rows.mockResolvedValue({ data: [], error: null });
  expect(await apiBalance(merchant, "RWF")).toMatchObject({ success: true, data: { currency: "RWF", available_balance: 0 } });
});
it("does not return a partial balance when the main wallet read fails", async () => {
  mocks.wallet.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  expect(await apiBalance(merchant, "RWF")).toEqual({ success: false, error: "Balance is temporarily unavailable." });
});
it("rejects unsupported currency codes before reconciliation", async () => {
  expect(await apiBalance(merchant, "RWD")).toMatchObject({ success: false });
  expect(mocks.refresh).not.toHaveBeenCalled();
});