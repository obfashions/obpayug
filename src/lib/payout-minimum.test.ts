import { afterEach, expect, it, vi } from "vitest";
import { gatewayPayout, payoutQuote, friendlyError } from "./gateway.server";

const creds = { key: "test-key", secret: "test-only", basic: "" };
const rwfRules = { success: true, payout_methods: { available: true, minimum_withdrawal: 500, fee: { type: "percent", percent: 4.1, floor: 500 } } };

afterEach(() => vi.unstubAllGlobals());

it.each(["0971234567", "+260971234567", "00260971234567"])("sends Zambia %s through the live mobile_money rail with both fees", async (phone) => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout_methods: { available: true, minimum_withdrawal: 30, fee: { type: "percent", percent: 4.67, floor: 5 } } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout: { reference: "WDR_ZMW_TEST" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const quote = await payoutQuote(creds, "ZMW", 30, "account", 5);
  expect(quote).toMatchObject({ gross: 35, net: 30, partnerFee: 5, platformFee: 2, totalDebit: 37, error: null });
  const result = await gatewayPayout(creds, { reference: "zambia-test", amount: 30, currency: "ZMW", network: "airtel", preparedQuote: quote, typeTrans: 2, bankCode: "", accountNumber: phone, customerName: "Test recipient" });
  expect(result.ok).toBe(true);
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({ currency: "ZMW", method: "mobile_money", account_number: "260971234567", account_name: "Test recipient", amount: 35 });
});

it("rejects malformed Zambia numbers before contacting the partner", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const result = await gatewayPayout(creds, { reference: "bad-zambia-test", amount: 30, currency: "ZMW", typeTrans: 2, bankCode: "", accountNumber: "097123", customerName: "Test recipient" });
  expect(result.ok).toBe(false);
  expect(result.res.code).toBe("bad_number");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("submits the explicitly chosen compatible UGX quote with whole gross and net amounts", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout_methods: { available: true, minimum_withdrawal: 1500, fee: { type: "percent", percent: 4.5, floor: 1000 } } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout: { reference: "WDR_UGX_TEST" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const quote = await payoutQuote(creds, "UGX", 29987, "account", 5);
  const result = await gatewayPayout(creds, { reference: "approved-ugx-test", amount: 29987, currency: "UGX", network: "mtn", preparedQuote: quote, typeTrans: 2, bankCode: "", accountNumber: "256772123456", customerName: "Test recipient" });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result).toMatchObject({ gross: 31400, net: 29987, partnerFee: 1413, platformFee: 1500 });
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).amount).toBe(31400);
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).method).toBe("mobile_money");
});

it("uses mobile_money for UGX Airtel and never reports a rejected payout as accepted", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout_methods: { available: true, minimum_withdrawal: 1500, fee: { type: "percent", percent: 4.5, floor: 1000 } } }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, message: "Insufficient balance" }), { status: 400 }));
  vi.stubGlobal("fetch", fetchMock);
  const quote = await payoutQuote(creds, "UGX", 29987, "account", 5);
  const result = await gatewayPayout(creds, { reference: "rejected-ugx-test", amount: 29987, currency: "UGX", network: "airtel", preparedQuote: quote, typeTrans: 2, bankCode: "", accountNumber: "256752123456", customerName: "Test recipient" });
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).method).toBe("mobile_money");
  expect(result.ok).toBe(false);
  expect(result.res.httpStatus).toBe(400);
});

it("never submits the original incompatible UGX amount", async () => {
  const fetchMock = stubRules({ success: true, payout_methods: { available: true, minimum_withdrawal: 1500, fee: { type: "percent", percent: 4.5, floor: 1000 } } });
  const result = await gatewayPayout(creds, { reference: "blocked-ugx-test", amount: 30000, currency: "UGX", typeTrans: 2, bankCode: "", accountNumber: "256772123456", customerName: "Test recipient" });
  expect(result.ok).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

function stubRules(body: unknown) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })));
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

it("sends the reserved submitted-amount quote unchanged even if partner fee lookups would change", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(rwfRules), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, payout: { reference: "WDR_MODE_TEST" } }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const quote = await payoutQuote(creds, "RWF", 927, "amount", 1);
  const result = await gatewayPayout(creds, { reference: "amount-mode-test", amount: 927, currency: "RWF", feeInclusive: true, preparedQuote: quote, typeTrans: 2, bankCode: "", accountNumber: "250788123456", customerName: "Test recipient" });
  expect(result.ok).toBe(true);
  if (result.ok) expect(result).toMatchObject({ gross: 917, net: 417, partnerFee: 500, platformFee: 10 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).amount).toBe(917);
});
