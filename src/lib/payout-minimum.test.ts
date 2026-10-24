import { afterEach, expect, it, vi } from "vitest";
import { gatewayPayout, friendlyError } from "./gateway.server";

afterEach(() => vi.unstubAllGlobals());

it("uses the new live 500 RWF minimum but rejects 527 because the partner fee leaves zero", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true,
    payout_methods: { available: true, minimum_withdrawal: 500, fee: { type: "percent", percent: 4.1, floor: 500 } },
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await gatewayPayout({ key: "new-minimum-test", secret: "test-only", basic: "" }, {
    reference: "new-minimum-test-only", amount: 527, currency: "RWF", typeTrans: 2,
    bankCode: "", accountNumber: "250788123456", customerName: "Test recipient",
    feeInclusive: true, platformFee: 27, platformFeePercent: 5,
  });
  expect(result.ok).toBe(false);
  expect(friendlyError(result.res, "payout")).toContain("RWF 528");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("rejects Mukoya's 2016 RWF amount with the fee-inclusive minimum before sending any payout", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
    success: true,
    payout_methods: { available: true, minimum_withdrawal: 2000, fee: { type: "percent", percent: 4.1, floor: 500 } },
  }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const result = await gatewayPayout({ key: "minimum-test-key", secret: "test-only", basic: "" }, {
    reference: "minimum-test-only", amount: 2016, currency: "RWF", typeTrans: 2,
    bankCode: "", accountNumber: "250788123456", customerName: "Test recipient",
    feeInclusive: true, platformFee: 101, platformFeePercent: 5,
  });
  expect(result.ok).toBe(false);
  expect(friendlyError(result.res, "payout")).toContain("RWF 2,106");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
});