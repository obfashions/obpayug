import { describe, expect, it } from "vitest";
import { partnerBalanceFromMessage } from "./partner-balance";

describe("partner balance evidence", () => {
  it("reads RWF balances without swallowing sentence punctuation", () => {
    expect(partnerBalanceFromMessage("Amount exceeds your available RWF balance of 9,951.00.", "RWF")).toBe(9951);
    expect(partnerBalanceFromMessage("Amount exceeds your available RWF balance of 0.", "RWF")).toBe(0);
  });
  it("does not assign another currency or ambiguous formatting to Rwanda", () => {
    expect(partnerBalanceFromMessage("Amount exceeds your available UGX balance of 9951.", "RWF")).toBeNull();
    expect(partnerBalanceFromMessage("Amount exceeds your available RWF balance of 9,95.", "RWF")).toBeNull();
    expect(partnerBalanceFromMessage("Balance unavailable", "RWF")).toBeNull();
  });
});