import { describe, expect, it } from "vitest";
import { collectionFee, payoutPlatformFee, minimumFeeInclusivePayout } from "./platform-fees";

describe("platform fees", () => {
  it("charges the admin's 5% on a received payment", () => {
    expect(collectionFee(10000, "UGX", 5, 150)).toBe(500);
  });
  it("never charges less than the partner's own fee", () => {
    expect(collectionFee(10000, "RWF", 1, 150)).toBe(150);
  });
  it("charges ObPay's withdrawal percentage in whole units", () => {
    expect(payoutPlatformFee(10000, "UGX", 4.8)).toBe(480);
    expect(payoutPlatformFee(2284, "RWF", 5)).toBe(115);
  });
  it("requires 2106 RWF to leave the live 2000 RWF minimum after the 5% ObPay charge", () => {
    expect(minimumFeeInclusivePayout(2000, "RWF", 5)).toBe(2106);
    expect(2106 - payoutPlatformFee(2106, "RWF", 5)).toBe(2000);
    expect(2105 - payoutPlatformFee(2105, "RWF", 5)).toBe(1999);
    expect(2016 - payoutPlatformFee(2016, "RWF", 5)).toBe(1915);
  });
  it("keeps the partner minimum unchanged for fee-exempt refunds", () => {
    expect(minimumFeeInclusivePayout(2000, "RWF", 0)).toBe(2000);
  });
  it("requires 527 RWF to leave the new 500 RWF minimum after the 5% withdrawal fee", () => {
    expect(minimumFeeInclusivePayout(500, "RWF", 5)).toBe(527);
    expect(527 - payoutPlatformFee(527, "RWF", 5)).toBe(500);
    expect(526 - payoutPlatformFee(526, "RWF", 5)).toBe(499);
  });
});
