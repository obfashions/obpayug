import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), claim: vi.fn(), send: vi.fn(), remove: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: any) => fn }) }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  auth: { admin: { getUserById: mocks.lookup } }, rpc: mocks.claim,
  from: () => ({ delete: () => ({ eq: mocks.remove }) }),
} }));
vi.mock("./verification-email.server", () => ({ sendCodeEmail: mocks.send }));
import { sendRegistrationCode } from "./registration.functions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockResolvedValue({ data: { user: { email: "account@example.com" } }, error: null });
  mocks.claim.mockResolvedValue({ data: "claim-123", error: null });
  mocks.send.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue({ error: null });
});
it("sends a registration code without a session only to the account's stored email", async () => {
  const result = await (sendRegistrationCode as any)({ data: { userId: "merchant" } });
  expect(result.success).toBe(true);
  expect(mocks.send).toHaveBeenCalledWith("account@example.com", expect.stringMatching(/^\d{6}$/), "claim-123");
});
it("does not claim successful delivery and releases the code after a sender failure", async () => {
  mocks.send.mockRejectedValue(new Error("daily limit"));
  const result = await (sendRegistrationCode as any)({ data: { userId: "merchant" } });
  expect(result.success).toBe(false);
  expect(mocks.remove).toHaveBeenCalledWith("id", "claim-123");
});
it("does not send another email when the atomic rate limiter rejects a new claim", async () => {
  mocks.claim.mockResolvedValue({ data: null, error: null });
  await (sendRegistrationCode as any)({ data: { userId: "merchant" } });
  expect(mocks.send).not.toHaveBeenCalled();
});