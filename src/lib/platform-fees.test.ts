import { describe, expect, it } from "vitest";
import { collectionFee, payoutPlatformFee } from "./platform-fees";

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
});
