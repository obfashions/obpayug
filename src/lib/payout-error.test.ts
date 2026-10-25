import { expect, it } from "vitest";
import { payoutError } from "./payout-error";

it("keeps a payment-network compatible amount instead of reporting internet failure", () => {
  const message = "Use UGX 29,987 so the payment network can send a whole amount after both fees. No money was sent.";
  expect(payoutError(message)).toBe(message);
});
it("keeps uncertain submission instructions and the reference without inviting a retry", () => {
  const message = "We could not confirm whether this payout reached the payment network. Do not retry until support checks reference W123.";
  expect(payoutError(message)).toBe(message);
});
it("recognizes an actual failed browser request", () => {
  expect(payoutError("Failed to fetch")).toBe("Connection issue. Check your internet and retry.");
});