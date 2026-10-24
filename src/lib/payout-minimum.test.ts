import { afterEach, expect, it, vi } from "vitest";
import { gatewayPayout, payoutQuote, friendlyError } from "./gateway.server";

const creds = { key: "test-key", secret: "test-only", basic: "" };
const rwfRules = { success: true, payout_methods: { available: true, minimum_withdrawal: 500, fee: { type: "percent", percent: 4.1, floor: 500 } } };

afterEach(() => vi.unstubAllGlobals());

function stubRules(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("quotes the partner fee on top of the entered amount so the recipient is paid in full", async () => {
  stubRules(rwfRules);
  const quote = await payoutQuote(creds, "RWF", 927);
  expect(quote.error).toBeNull();
  // 4.1% with a 500 floor: max(927 / 0.959, 927 + 500) = 1427.
  expect(quote.net).toBe(927);
  expect(quote.gross).toBe(1427);
  expect(quote.partnerFee).toBe(500);
});

it("rejects amounts below the live partner minimum before any money moves", async () => {
  const fetchMock = stubRules(rwfRules);
  const quote = await payoutQuote(creds, "RWF", 400);
  expect(quote.error).toContain("RWF 500");
  const result = await gatewayPayout(creds, {
    reference: "below-min-test-only", amount: 400, currency: "RWF", typeTrans: 2,
    bankCode: "", accountNumber: "250788123456", customerName: "Test recipient",
  });
  expect(result.ok).toBe(false);
  expect(friendlyError(result.res, "payout")).toContain("RWF 500");
  // Only the rules lookup happened — no payout was submitted.
  expect(fetchMock.mock.calls.every((c) => c[1]?.method !== "POST")).toBe(true);
});

it("sends the gross amount to the partner while the recipient receives the entered amount", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(rwfRules), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout: { reference: "WDR_TEST_1" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await gatewayPayout(creds, {
    reference: "fee-on-top-test-only", amount: 927, currency: "RWF", typeTrans: 2,
    bankCode: "", accountNumber: "250788123456", customerName: "Test recipient",
    platformFee: 10, platformFeePercent: 1,
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.gross).toBe(1427);
    expect(result.net).toBe(927);
    expect(result.partnerFee).toBe(500);
    expect(result.platformFee).toBe(10);
  }
  const sentBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
  expect(sentBody.amount).toBe(1427);
});
