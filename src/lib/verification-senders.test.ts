import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), authorize: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: unknown) => fn }) }) }));
vi.mock("./identity.server", () => ({ requireAdmin: mocks.authorize }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }), upsert: mocks.write }) } }));
import { selectedVerificationSender, sendConnectedMailjet, verificationSenders } from "./verification-senders.server";
import { saveVerificationSender } from "./verification-senders.functions";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("LOVABLE_API_KEY", "test-only-managed");
  vi.stubEnv("UDC_MAILJET_VERIFICATION_API_KEY", "test-only-account-one");
  vi.stubEnv("UDC_MAILJET_VERIFICATION_API_KEY_1", "test-only-account-two");
  mocks.read.mockResolvedValue({ data: null, error: null });
  mocks.authorize.mockResolvedValue({ userId: "admin", email: "admin@example.com" });
  mocks.write.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("keeps managed delivery when no account has been selected", async () => {
  expect(await selectedVerificationSender()).toBe("managed");
});
it("offers separately connected Mailjet accounts without exposing credentials", () => {
  const senders = verificationSenders();
  expect(senders.map((sender) => sender.id)).toContain("mailjet-connected");
  expect(senders.map((sender) => sender.id)).toContain("mailjet-connected_1");
  expect(JSON.stringify(senders)).not.toContain("test-only-account");
});
it("routes codes using only the selected additional account", async () => {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Messages: [{ Status: "success" }] })));
  vi.stubGlobal("fetch", request);
  await sendConnectedMailjet("mailjet-connected_1", { email: "merchant@example.com", html: "test", text: "test", claimId: "claim-123" });
  expect(request.mock.calls[0][0]).toBe("https://connector-gateway.lovable.dev/udc_mailjet_verification/v3.1/send");
  expect(request.mock.calls[0][1].headers["X-Connection-Api-Key"]).toBe("test-only-account-two");
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.Messages[0].To).toEqual([{ Email: "merchant@example.com" }]);
  expect(body.Messages[0].CustomID).toBe("verification-code-claim-123");
});
it("does not retry a limited or uncertain Mailjet submission", async () => {
  const request = vi.fn().mockResolvedValue(new Response("quota", { status: 429 }));
  vi.stubGlobal("fetch", request);
  await expect(sendConnectedMailjet("mailjet-connected", { email: "merchant@example.com", html: "test", text: "test", claimId: "claim" })).rejects.toThrow("429");
  expect(request).toHaveBeenCalledTimes(1);
});
it("requires settings authorization before changing the code sender", async () => {
  mocks.authorize.mockRejectedValue(new Error("Forbidden"));
  await expect((saveVerificationSender as any)({ data: { accessToken: "test", sender: "mailjet-connected" } })).rejects.toThrow("Forbidden");
  expect(mocks.write).not.toHaveBeenCalled();
});
it("rejects unknown or unconfigured accounts before saving", async () => {
  await expect((saveVerificationSender as any)({ data: { accessToken: "test", sender: "arbitrary-account" } })).rejects.toThrow("configured");
  expect(mocks.write).not.toHaveBeenCalled();
});
it("persists the administrator's selected Mailjet account and actor", async () => {
  await (saveVerificationSender as any)({ data: { accessToken: "test", sender: "mailjet-connected" } });
  expect(mocks.write).toHaveBeenCalledWith(expect.objectContaining({ key: "verification_email_sender", value: "mailjet-connected", updated_by: "admin@example.com" }), { onConflict: "key" });
});
it("refuses delivery when the selected sender cannot be read reliably", async () => {
  mocks.read.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(selectedVerificationSender()).rejects.toThrow("could not be read");
});