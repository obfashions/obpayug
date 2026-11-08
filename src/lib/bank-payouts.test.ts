import { describe, expect, it } from "vitest";
import { bankPayoutQuote, bankPayoutError } from "./bank-payouts";

const base = { currency: "UGX", amount: 100000, bank_name: "Stanbic Bank", account_number: "9030012345678", account_name: "Jane Doe" };
describe("bank payout fee", () => {
  it("charges 4.5% on top of the amount sent", () => expect(bankPayoutQuote(100000)).toEqual({ amount: 100000, fee: 4500, total: 104500 }));
  it("rounds the fee up to a whole unit", () => expect(bankPayoutQuote(10001).fee).toBe(451));
  it("rejects fractional amounts", () => expect(() => bankPayoutQuote(100.5)).toThrow());
  it("enforces the UGX minimum", () => expect(bankPayoutError({ ...base, amount: 5000 })).toMatch(/minimum/));
  it("requires the account name", () => expect(bankPayoutError({ ...base, account_name: "" })).toMatch(/name/));
  it("rejects USD wallets", () => expect(bankPayoutError({ ...base, currency: "USD" })).toMatch(/currency/));
  it("accepts valid details", () => expect(bankPayoutError(base)).toBeNull());
});
