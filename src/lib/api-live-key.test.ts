import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), update: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }), update: () => ({ eq: mocks.update }) }) } }));
import { merchantForSecret } from "./platform.server";
beforeEach(() => vi.clearAllMocks());
it("refuses a stored sandbox environment even with a live-looking key", async () => {
  mocks.lookup.mockResolvedValue({ data: { id: "key", merchant_id: "merchant", status: "active", environment: "sandbox" } });
  expect(await merchantForSecret("sk_live_test-only")).toBeNull();
  expect(mocks.update).not.toHaveBeenCalled();
});
it("accepts an active stored live environment", async () => {
  mocks.lookup.mockResolvedValue({ data: { id: "key", merchant_id: "merchant", status: "active", environment: "live" } });
  expect(await merchantForSecret("sk_live_test-only")).toBe("merchant");
});