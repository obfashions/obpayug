import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), persisted: vi.fn(), link: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: any) => fn }) }) }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: vi.fn(async () => ({ data: true, error: null })),
  auth: { admin: { updateUserById: vi.fn(async () => ({ data: { user: { id: "merchant", email: "test@example.com", user_metadata: {} } }, error: null })), generateLink: mocks.link } },
  from: () => ({ upsert: mocks.upsert, update: () => ({ eq: () => ({ select: () => ({ maybeSingle: mocks.persisted }) }) }) }),
} }));
import { verifyRegistrationCode } from "./registration.functions";
beforeEach(() => { vi.clearAllMocks(); mocks.upsert.mockResolvedValue({ error: null }); mocks.persisted.mockResolvedValue({ data: { id: "merchant" }, error: null }); mocks.link.mockResolvedValue({ data: { properties: { hashed_token: "one-time" } }, error: null }); });
it("does not announce registration success if the profile could not be created", async () => {
  mocks.upsert.mockResolvedValue({ error: { message: "write failed" } });
  const result = await (verifyRegistrationCode as any)({ data: { userId: "merchant", code: "123456" } });
  expect(result.success).toBe(false); expect(mocks.link).not.toHaveBeenCalled();
});
it("does not announce registration success when the profile update affects no rows", async () => {
  mocks.persisted.mockResolvedValue({ data: null, error: null });
  const result = await (verifyRegistrationCode as any)({ data: { userId: "merchant", code: "123456" } });
  expect(result.success).toBe(false); expect(mocks.link).not.toHaveBeenCalled();
});
it("returns the one-time sign-in token after the profile is persisted", async () => {
  const result = await (verifyRegistrationCode as any)({ data: { userId: "merchant", code: "123456" } });
  expect(result).toEqual({ success: true, tokenHash: "one-time" });
});