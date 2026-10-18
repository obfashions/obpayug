import { describe, expect, it } from "vitest";
import { combinedBalances } from "./balance-values";

describe("spendable account balances", () => {
  it("does not resurrect a withdrawn main balance from its old JSON mirror", () => {
    expect(combinedBalances({ available_balance: 0, balances_by_currency: { UGX: 40000 } }, [], "UGX").UGX).toBe(0);
  });
  it("includes separately held managed funds without relabeling currencies", () => {
    expect(combinedBalances({ available_balance: 10000, balances_by_currency: { KES: 2500 } }, [{ currency: "UGX", available_balance: 20000 }], "UGX")).toEqual({ UGX: 30000, KES: 2500 });
  });
  it("retains negative corrections instead of concealing debt", () => {
    expect(combinedBalances({ available_balance: -34000, balances_by_currency: { UGX: 0 } }, [], "UGX").UGX).toBe(-34000);
  });
});