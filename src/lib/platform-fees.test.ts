import { describe, expect, it } from "vitest";
import { collectionFee, payoutPlatformFee, minimumFeeInclusivePayout, payoutFeePercent } from "./platform-fees";

describe("platform fees", () => {
  it("charges 2% ObPay on Rwanda payouts, rounded to whole RWF", () => {
    const rate = payoutFeePercent("RWF", 5);
    expect(rate).toBe(2);
    expect(payoutFeePercent("rwf", 4.8)).toBe(2);
    expect(payoutPlatformFee(10000, "RWF", rate)).toBe(200);
    expect(payoutPlatformFee(512, "RWF", rate)).toBe(11);
  });
  it("keeps Uganda and Kenya's configured payout rates unchanged", () => {
    expect(payoutFeePercent("UGX", 4.8)).toBe(4.8);
    expect(payoutFeePercent("KES", 5)).toBe(5);
  });
  it("requires 512 RWF at 2% with the separate 500 RWF partner fee floor", () => {
    const rate = payoutFeePercent("RWF", 5);
    expect(minimumFeeInclusivePayout(500, "RWF", rate, { type: "percent", floor: 500 })).toBe(512);
    expect(512 - payoutPlatformFee(512, "RWF", rate) - 500).toBe(1);
    expect(511 - payoutPlatformFee(511, "RWF", rate) - 500).toBe(0);
  });
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
  it("requires 528 RWF when the live partner fee floor is also 500 RWF", () => {
    expect(minimumFeeInclusivePayout(500, "RWF", 5, { type: "percent", floor: 500 })).toBe(528);
    expect(528 - payoutPlatformFee(528, "RWF", 5) - 500).toBe(1);
    expect(527 - payoutPlatformFee(527, "RWF", 5) - 500).toBe(0);
  });
});
