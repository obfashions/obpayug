import { describe, expect, it } from "vitest";
import { exchangeReceive } from "./exchange-math";

describe("currency exchange payout", () => {
  it("deducts the 1.5% fee from what the merchant receives", () => {
    // 100,000 UGX at 0.035 KES/UGX = 3,500 KES gross; 1.5% fee leaves 3,447.5 -> whole KES 3,447.
    expect(exchangeReceive(100000, 0.035, 1.5, "KES")).toBe(3447);
  });
  it("keeps whole units for zero-decimal currencies", () => {
    expect(exchangeReceive(1000, 1, 1.5, "UGX")).toBe(985);
  });
  it("rounds USD down to cents", () => {
    expect(exchangeReceive(100, 0.00027, 1.5, "USD")).toBe(0.02);
  });
  it("never pays out more than the gross amount", () => {
    expect(exchangeReceive(5000, 2, 1.5, "RWF")).toBeLessThan(10000);
  });
});
