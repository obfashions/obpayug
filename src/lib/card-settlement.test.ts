import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ check: vi.fn(), rpc: vi.fn() }));
vi.mock("./gateway.server", () => ({ getGatewayCreds: async () => ({}), gatewayCollectionStatus: mocks.check, gatewayPayoutStatus: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }), limit: () => ({ maybeSingle: async () => ({ data: { platform_fee_percent: 2, currency_fees: { USD: { collect_margin: 2 } } }, error: null }) }) }) }) } }));
import { refreshPaymentRecord } from "./settle.server";
const record = { id: "card", merchant_id: "owner", reference: "card-1", type: "collection", status: "pending", amount: 20, currency: "USD", metadata: { payment_method: "card" } };
beforeEach(() => { vi.clearAllMocks(); mocks.rpc.mockResolvedValue({ data: { claimed: true, record: { ...record, status: "success" } }, error: null }); mocks.check.mockResolvedValue({ ok: true, status: "success", amount: 20, currency: "USD", partnerFee: 1, res: { data: { reference: "card-1" } } }); });
it.each([{ amount: 19 }, { currency: "UGX" }, { res: { data: { reference: "other" } } }])("does not credit mismatched card evidence %j", async mismatch => {
  mocks.check.mockResolvedValue({ ...(await mocks.check()), ...mismatch });
  expect(await refreshPaymentRecord(record)).toEqual(record);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("credits matching USD card evidence using the atomic collection RPC and 2% margin once", async () => {
  await refreshPaymentRecord(record);
  expect(mocks.rpc).toHaveBeenCalledWith("settle_payment_record_and_balance", expect.objectContaining({ p_record_id: "card", p_fee: 1.4, p_status: "success" }));
});