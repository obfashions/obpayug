import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ limit: () => ({ maybeSingle: mocks.settings }) }) }),
    rpc: mocks.rpc,
  },
}));
import { collectionFeeFor, settlePaymentRecord } from "./settle.server";

describe("deposit settlement fees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settings.mockResolvedValue({ data: { platform_fee_percent: 4.8 }, error: null });
    mocks.rpc.mockResolvedValue({ data: { claimed: false, record: { status: "success" } }, error: null });
  });
  it("deducts the configured fee on wallet recharges before sending the atomic credit", async () => {
    await settlePaymentRecord({ id: "deposit", amount: 10000, currency: "RWF", type: "collection" }, "success", { fee: 0, partnerFee: 150 });
    expect(mocks.rpc).toHaveBeenCalledWith("settle_payment_record_and_balance", expect.objectContaining({ p_fee: 480 }));
  });
  it("covers verified partner charges exceeding the configured deposit fee", async () => {
    expect(await collectionFeeFor({ amount: 10000, currency: "RWF" }, 600)).toBe(600);
  });
  it("applies deposit charges to USD wallets too", async () => {
    expect(await collectionFeeFor({ amount: 100, currency: "USD" }, 1.5)).toBe(4.8);
  });
  it("defers wallet credit if fee settings cannot be read", async () => {
    mocks.settings.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(settlePaymentRecord({ id: "deposit", amount: 10000, currency: "UGX", type: "collection" }, "success")).rejects.toThrow("Deposit fees are temporarily unavailable");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not apply deposit charges to failed payments or fee-exempt payouts", async () => {
    await settlePaymentRecord({ id: "failed", amount: 10000, currency: "RWF", type: "collection" }, "failed");
    await settlePaymentRecord({ id: "refund", amount: 10000, currency: "RWF", type: "payout" }, "success", { fee: 0 });
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenLastCalledWith("settle_payment_record_and_balance", expect.objectContaining({ p_fee: 0 }));
  });
});