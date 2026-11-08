import { expect, it, vi } from "vitest";
vi.mock("./marz-services.server", () => ({ secondaryAction: vi.fn(), secondaryPurchase: vi.fn() }));
import { serviceApi } from "./service-api.server";
import { bankCapabilities } from "./bank-capabilities";
it("never advertises generic checkout as bank collections or disbursements", async () => {
  const result = await serviceApi("GET", "services/banks/catalog", "owner", {}, new URLSearchParams());
  expect(result).toEqual({ success: true, data: bankCapabilities });
  expect(bankCapabilities.bank_collection_available).toBe(false);
  expect(bankCapabilities.bank_disbursement_available).toBe(false);
  expect(bankCapabilities.automatic_wallet_credit).toBe(false);
});
it.each(["collect", "transfers", "validate", "accounts"])("blocks bank %s before provider access", async operation => {
  const { secondaryAction, secondaryPurchase } = await import("./marz-services.server");
  const result = await serviceApi("POST", `services/banks/${operation}`, "owner", { amount: 100000 }, new URLSearchParams());
  expect(result).toMatchObject({ success: false, code: "bank_contract_required" });
  expect(secondaryAction).not.toHaveBeenCalled();
  expect(secondaryPurchase).not.toHaveBeenCalled();
});