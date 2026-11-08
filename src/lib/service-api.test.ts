import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ action: vi.fn(), purchase: vi.fn() }));
const cards = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock("./card-payments.server", () => ({ cardAction: cards.action }));
vi.mock("./marz-services.server", () => ({ secondaryAction: mocks.action, secondaryPurchase: mocks.purchase }));
import { serviceApi } from "./service-api.server";
beforeEach(() => { vi.clearAllMocks(); mocks.action.mockResolvedValue({ success: true }); mocks.purchase.mockResolvedValue({ success: true }); });
const query = new URLSearchParams();
it("exposes outgoing banks with the same merchant and API audit origin", async () => {
  const body = { amount: 100000, expected_fee: 50000 };
  await serviceApi("POST", "services/banks/transfers", "owner", body, query);
  expect(mocks.purchase).toHaveBeenCalledWith("owner", "bank", body, "api");
});
it("maps every service purchase to the shared safeguards", async () => {
  for (const [path, kind] of [["airtime", "airtime"], ["bills", "bill"]]) {
    await serviceApi("POST", `services/${path}`, "owner", {}, query);
    expect(mocks.purchase).toHaveBeenCalledWith("owner", kind, {}, "api");
  }
});
it("routes new cards through primary collection with the authenticated API owner and origin", async () => {
  const body = { currency: "USD", amount: 20 };
  await serviceApi("POST", "services/cards", "owner", body, query);
  expect(cards.action).toHaveBeenCalledWith("card-create", "owner", body, "api");
  expect(mocks.purchase).not.toHaveBeenCalled();
});
it("exposes bank validation and saved accounts to the authenticated key owner", async () => {
  await serviceApi("POST", "services/banks/validate", "owner", { bank_name: "Equity Bank", account_number: "60001256421" }, query);
  expect(mocks.action).toHaveBeenCalledWith("bank-validate", "owner", { bankName: "Equity Bank", accountNumber: "60001256421" });
  await serviceApi("GET", "services/banks/accounts", "owner", {}, query);
  expect(mocks.action).toHaveBeenCalledWith("bank-accounts-list", "owner", {});
});
it("exposes bill verification and packages needed before purchase", async () => {
  await serviceApi("POST", "services/bills/verify", "owner", { utility_code: "NWSC", meter_number: "12345678", area: "Kampala" }, query);
  expect(mocks.action).toHaveBeenCalledWith("bill-verify", "owner", { utilityCode: "NWSC", meterNumber: "12345678", area: "Kampala" });
  await serviceApi("GET", "services/bills/packages", "owner", {}, new URLSearchParams("utility_code=DSTV"));
  expect(mocks.action).toHaveBeenCalledWith("bill-bouquets", "owner", { utilityCode: "DSTV" });
});
it("rejects malformed account and payment identifiers before actions", async () => {
  expect((await serviceApi("DELETE", "services/banks/accounts/not-a-uuid", "owner", {}, query))?.success).toBe(false);
  expect((await serviceApi("GET", "services/status/not-a-uuid", "owner", {}, query))?.success).toBe(false);
  expect(mocks.action).not.toHaveBeenCalled();
});
it("does not invent an incoming bank collection endpoint", async () => {
  expect(await serviceApi("POST", "services/banks/collect", "owner", {}, query)).toBeNull();
  expect(mocks.purchase).not.toHaveBeenCalled();
});