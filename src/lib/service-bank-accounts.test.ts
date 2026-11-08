import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ eq: vi.fn(), insert: vi.fn(), single: vi.fn(), order: vi.fn(), select: vi.fn(), remove: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: mocks.select, insert: mocks.insert, delete: mocks.remove }) } }));
import { secondaryAction } from "./marz-services.server";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockReturnValue({ eq: mocks.eq, order: mocks.order, select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq, single: mocks.single });
  mocks.insert.mockReturnValue({ select: mocks.select });
  mocks.remove.mockReturnValue({ eq: mocks.eq });
  vi.stubEnv("LOVABLE_API_KEY", "test-only"); vi.stubEnv("UDC_MARZPAY_SERVICES_2_API_KEY", "test-only");
});
it("lists receiving accounts only for the authenticated owner without automatic credits", async () => {
  mocks.order.mockResolvedValue({ data: [{ id: "account" }], error: null });
  expect(await secondaryAction("bank-accounts-list", "owner", { merchant_id: "other" })).toEqual({ success: true, data: { accounts: [{ id: "account" }], automatic_wallet_credit: false } });
  expect(mocks.eq).toHaveBeenCalledWith("merchant_id", "owner");
});
it("blocks new receiving registrations after removing the secondary provider", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "success", data: { valid: true, account_name: "Jane Nakato" } })));
  mocks.single.mockResolvedValue({ data: { id: "account", account_name: "Jane Nakato" }, error: null });
  const result = await secondaryAction("bank-accounts-create", "owner", { bank_name: "Equity Bank", account_number: "60001256421", merchant_id: "other", account_name: "Forged name" });
  expect(result.success).toBe(false);
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("never saves a bank name lookup with unconfirmed registration", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "success", data: { valid: false, account_name: "Jane Nakato", status_code: 0 } })));
  expect((await secondaryAction("bank-accounts-create", "owner", { bank_name: "Equity Bank", account_number: "60001256421" })).success).toBe(false);
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("rejects non-UGX receiving accounts before a network call", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  expect((await secondaryAction("bank-accounts-create", "owner", { bank_name: "Equity Bank", account_number: "60001256421", currency: "RWF" })).success).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});
it("deletes only the requested owner account", async () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  mocks.select.mockResolvedValueOnce({ data: [{ id }], error: null });
  expect(await secondaryAction("bank-accounts-delete", "owner", { id })).toEqual({ success: true, data: { id, removed: true } });
  expect(mocks.eq).toHaveBeenCalledWith("id", id);
  expect(mocks.eq).toHaveBeenCalledWith("merchant_id", "owner");
});