import { expect, it, vi } from "vitest";
vi.mock("./marz-services.server", () => ({ secondaryAction: vi.fn().mockResolvedValue({ success: true }), secondaryPurchase: vi.fn().mockResolvedValue({ success: true }) }));
import { serviceApi } from "./service-api.server";
it("keeps incoming bank collections blocked (no documented collection rail)", async () => {
  const { secondaryAction, secondaryPurchase } = await import("./marz-services.server");
  const result = await serviceApi("POST", "services/banks/collect", "owner", { amount: 100000 }, new URLSearchParams());
  expect(result).toMatchObject({ success: false, code: "bank_contract_required" });
  expect(secondaryAction).not.toHaveBeenCalled();
  expect(secondaryPurchase).not.toHaveBeenCalled();
});
it("routes bank payouts through the shared safeguarded purchase as API source", async () => {
  const { secondaryPurchase } = await import("./marz-services.server");
  const body = { amount: 100000, expected_fee: 3000 };
  await serviceApi("POST", "services/banks/transfers", "owner", body, new URLSearchParams());
  expect(secondaryPurchase).toHaveBeenCalledWith("owner", "bank", body, "api");
});
