import { afterEach, expect, it, vi } from "vitest";
import { cardPaymentError } from "./card-payments";
import { gatewayCollect } from "./gateway.server";
vi.mock("./merchant-identity.server", () => ({ tagDescription: (_m: unknown, text: string) => text, tagMetadata: () => ({}) }));
afterEach(() => vi.unstubAllGlobals());
it.each([["USD", 0.5], ["KES", 1], ["NGN", 100]])("accepts documented card minimum %s %s", (currency, amount) => {
  expect(cardPaymentError(currency, amount)).toBeNull();
  expect(cardPaymentError(currency, amount - 0.01)).not.toBeNull();
});
it("does not offer UGX cards or round incompatible amounts", () => {
  expect(cardPaymentError("UGX", 5000)).not.toBeNull();
  expect(cardPaymentError("USD", 1.001)).not.toBeNull();
  expect(cardPaymentError("KES", 1.5)).not.toBeNull();
  expect(cardPaymentError("NGN", 100.5)).not.toBeNull();
});
it.each(["USD", "KES", "NGN"])("returns hosted checkout without a PIN prompt or crypto redirect for %s cards", async currency => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ success: true, data: { reference: "card-1", payment_url: "https://checkout.example/card-1", crypto_payment_url: "https://checkout.example/crypto", stk_sent: true } }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await gatewayCollect({ key: "test", secret: "test", basic: "" }, { reference: "card-1", currency, amount: 100, customerName: "Customer", customerEmail: "customer@example.com", phone: "254712345678", card: true });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("Expected checkout");
  expect(result.promptSent).toBe(false);
  expect(result.checkoutUrl).toBe("https://checkout.example/card-1");
  expect(fetchMock).toHaveBeenCalledOnce();
  const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
  if (currency === "KES") expect(request.stk_push).toBe(false);
  expect(request.currency).toBe(currency);
});