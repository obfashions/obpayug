import { expect, it } from "vitest";
import { payoutAmounts } from "./payout-fee-mode";

const rwf = { min: 500, percent: 4.1, floor: 500, flat: 0 };
it("account mode pays the entered 927 RWF and debits 1437 including both fees", () => {
  expect(payoutAmounts(927, "RWF", rwf, "account", 1)).toMatchObject({ gross: 1427, net: 927, platformFee: 10, partnerFee: 500, totalDebit: 1437, error: null });
});
it("submitted-amount mode deducts both fees from 927 and pays 417 while debiting only 927", () => {
  expect(payoutAmounts(927, "RWF", rwf, "amount", 1)).toMatchObject({ gross: 917, net: 417, platformFee: 10, partnerFee: 500, totalDebit: 927, error: null });
});
it("submitted-amount mode rejects an amount that leaves nothing after both fees", () => {
  expect(payoutAmounts(500, "RWF", rwf, "amount", 1).error).toContain("507");
  expect(payoutAmounts(507, "RWF", rwf, "amount", 1)).toMatchObject({ net: 1, totalDebit: 507, error: null });
});
it("submitted-amount mode applies the live percent above the partner fee floor", () => {
  expect(payoutAmounts(10000, "UGX", { min: 1500, percent: 4.5, floor: 0, flat: 0 }, "amount", 5)).toMatchObject({ gross: 9500, platformFee: 500, partnerFee: 427.5, net: 9072.5 });
  expect(payoutAmounts(10000, "UGX", { min: 1500, percent: 4.5, floor: 0, flat: 0 }, "amount", 5).error).toContain("fractional");
});
it("both modes keep flat KES network and ObPay fees accounted for", () => {
  const rules = { min: 500, flat: 155, percent: 0, floor: 0 };
  expect(payoutAmounts(1000, "KES", rules, "amount", 1)).toMatchObject({ net: 835, totalDebit: 1000, partnerFee: 155, platformFee: 10, error: null });
  expect(payoutAmounts(1000, "KES", rules, "account", 1)).toMatchObject({ net: 1000, totalDebit: 1165, partnerFee: 155, platformFee: 10, error: null });
});