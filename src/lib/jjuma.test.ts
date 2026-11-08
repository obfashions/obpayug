import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("./identity.server", () => ({ requireAdmin: mocks.admin }));
import { jjumaConnectionStatus } from "./jjuma.server";
beforeEach(() => {
  vi.clearAllMocks(); mocks.admin.mockResolvedValue({});
  vi.stubEnv("LOVABLE_API_KEY", "test-only"); vi.stubEnv("UDC_JJUMA_PAY_3_API_KEY", "test-only");
});
it("checks admin permission before accessing pooled provider data", async () => {
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  mocks.admin.mockRejectedValue(new Error("Forbidden"));
  await expect(jjumaConnectionStatus("test-token")).rejects.toThrow("Forbidden");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("returns only connection status, not pooled transactions or key metadata", async () => {
  const fetchMock = vi.fn(async () => Response.json({ success: true, data: [{ customer_name: "private" }], api_key: { secret: "private" } }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await jjumaConnectionStatus("test-token");
  expect(result.data.connected).toBe(true);
  expect(result.data.bank_collection_available).toBe(false);
  expect(Object.keys(result.data)).not.toContain("api_key");
  expect(Object.keys(result.data)).not.toContain("data");
  expect(fetchMock).toHaveBeenCalledOnce();
});