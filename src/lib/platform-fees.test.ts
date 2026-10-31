import { describe, expect, it } from "vitest";
import { collectionFee, collectionMarginFee, currencyFeeOverride, reportedCollectionFee, payoutPlatformFee, minimumFeeInclusivePayout, payoutFeePercent } from "./platform-fees";

describe("platform fees", () => {
  for (const currency of ["UGX", "KES", "RWF", "NGN", "XOF", "USD", "ZMW", "SLL", "CDF", "XAF"]) {
    it(`retains 2% above the partner charge once in ${currency}`, () => {
      expect(collectionMarginFee(10000, currency, 2, 600)).toBe(800);
      expect(payoutPlatformFee(10000, currency, 2)).toBe(200);
    });
  }
  it("does not interpret missing or empty currency overrides as zero", () => {
    expect(currencyFeeOverride({ RWF: { collect: null } }, "RWF", "collect")).toBeUndefined();
    expect(currencyFeeOverride({ RWF: { withdraw: "" } }, "RWF", "withdraw")).toBeUndefined();
    expect(currencyFeeOverride({ RWF: { withdraw: 0 } }, "RWF", "withdraw")).toBe(0);
  });
  it("refuses charges that cannot cover the partner and margin", () => {
    expect(() => collectionMarginFee(100, "RWF", 2, 99)).toThrow("leave no available funds");
  });
  it("reads the documented KES 36.75 charge on a 2450 deposit", () => {
    expect(reportedCollectionFee({ amount: 2450, fee: 36.75, net_amount: 2413.25 })).toBe(36.75);
    expect(reportedCollectionFee({ amount: 2450, net_amount: 2413.25 })).toBe(36.75);
  });
  it("preserves explicit zero fees and rejects invalid reported fees", () => {
    expect(reportedCollectionFee({ fee: 0 })).toBe(0);
    expect(reportedCollectionFee({ fee: -1 })).toBeUndefined();
    expect(reportedCollectionFee({ fee: "bad" })).toBeUndefined();
  });
  it("covers a higher live partner recharge fee without adding the charge twice", () => {
    expect(collectionFee(10000, "RWF", 4.8, 600)).toBe(600);
    expect(collectionFee(10000, "RWF", 4.8, 150)).toBe(480);
  });
  it("charges the admin-set per-currency override on Rwanda payouts, rounded to whole RWF", () => {
    const overrides = { RWF: { withdraw: 1 } };
    const rate = payoutFeePercent("RWF", 5, overrides);
    expect(rate).toBe(1);
    expect(payoutFeePercent("rwf", 4.8, overrides)).toBe(1);
    expect(payoutPlatformFee(10000, "RWF", rate)).toBe(100);
    expect(payoutPlatformFee(507, "RWF", rate)).toBe(6);
  });
  it("keeps Uganda and Kenya's configured payout rates unchanged", () => {
    const overrides = { RWF: { withdraw: 1 } };
    expect(payoutFeePercent("UGX", 4.8, overrides)).toBe(4.8);
    expect(payoutFeePercent("KES", 5, overrides)).toBe(5);
    expect(payoutFeePercent("RWF", 4.8)).toBe(4.8);
  });
  it("rounds fees up to whole units for every mobile-money currency", () => {
    for (const cur of ["UGX", "RWF", "KES", "XOF", "XAF", "CDF", "ZMW", "SLL"]) {
      expect(payoutPlatformFee(1001, cur, 4.1)).toBe(42);
    }
    expect(payoutPlatformFee(1001, "NGN", 4.1)).toBe(41.05);
  });
  it("requires 507 RWF at 1% with the separate 500 RWF partner fee floor", () => {
    const rate = payoutFeePercent("RWF", 5, { RWF: { withdraw: 1 } });
    expect(minimumFeeInclusivePayout(500, "RWF", rate, { type: "percent", floor: 500 })).toBe(507);
    expect(507 - payoutPlatformFee(507, "RWF", rate) - 500).toBe(1);
    expect(506 - payoutPlatformFee(506, "RWF", rate) - 500).toBe(0);
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
