import { expect, it } from "vitest";
import { payoutAmounts } from "./payout-fee-mode";

const rwf = { min: 500, percent: 4.1, floor: 500, flat: 0 };
const zmw = { min: 30, percent: 4.67, floor: 5, flat: 0 };
it("fee-exempt Rwanda payouts deduct the partner fee but no ObPay fee", () => {
  expect(payoutAmounts(927, "RWF", rwf, "account", 0)).toMatchObject({ net: 927, platformFee: 0, partnerFee: 500, totalDebit: 1427, error: null });
});
it("Zambia sender-paid fees debit 37 ZMW and pay the full 30 ZMW", () => {
  expect(payoutAmounts(30, "ZMW", zmw, "account", 5)).toMatchObject({ gross: 35, net: 30, partnerFee: 5, platformFee: 2, totalDebit: 37, error: null });
});
it("Zambia recipient-paid fees debit only 32 ZMW and pay 25 ZMW", () => {
  expect(payoutAmounts(32, "ZMW", zmw, "amount", 5)).toMatchObject({ gross: 30, net: 25, partnerFee: 5, platformFee: 2, totalDebit: 32, error: null });
});
it("Zambia percentage fees require explicit approval of compatible whole amounts", () => {
  const original = payoutAmounts(200, "ZMW", zmw, "account", 5);
  expect(original.error).not.toBeNull();
  expect(original.compatibleAmount).toBe(102);
  expect(payoutAmounts(102, "ZMW", zmw, "account", 5)).toMatchObject({ gross: 107, net: 102, partnerFee: 5, platformFee: 6, totalDebit: 113, error: null });
});
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
  const quote = payoutAmounts(10000, "UGX", { min: 1500, percent: 4.5, floor: 0, flat: 0 }, "amount", 5);
  expect(quote.compatibleAmount).toBe(9895);
  expect(payoutAmounts(9895, "UGX", { min: 1500, percent: 4.5, floor: 0, flat: 0 }, "amount", 5)).toMatchObject({ gross: 9400, net: 8977, totalDebit: 9895, error: null });
});
it("offers an approved compatible account-mode UGX amount without changing the original quote", () => {
  const rules = { min: 1500, percent: 4.5, floor: 1000, flat: 0 };
  const original = payoutAmounts(30000, "UGX", rules, "account", 5);
  expect(original.compatibleAmount).toBe(29987);
  expect(original.net).toBe(30000);
  expect(original.error).not.toBeNull();
  expect(payoutAmounts(29987, "UGX", rules, "account", 5)).toMatchObject({ gross: 31400, net: 29987, partnerFee: 1413, platformFee: 1500, totalDebit: 32900, error: null });
});
it("keeps 10000 UGX payouts valid in either mode when the live fee floor applies", () => {
  const rules = { min: 1500, percent: 4.5, floor: 1000, flat: 0 };
  expect(payoutAmounts(10000, "UGX", rules, "account", 5)).toMatchObject({ gross: 11000, net: 10000, totalDebit: 11500, error: null });
  expect(payoutAmounts(10000, "UGX", rules, "amount", 5)).toMatchObject({ gross: 9500, net: 8500, totalDebit: 10000, error: null });
});
it("both modes keep flat KES network and ObPay fees accounted for", () => {
  const rules = { min: 500, flat: 155, percent: 0, floor: 0 };
  expect(payoutAmounts(1000, "KES", rules, "amount", 1)).toMatchObject({ net: 835, totalDebit: 1000, partnerFee: 155, platformFee: 10, error: null });
  expect(payoutAmounts(1000, "KES", rules, "account", 1)).toMatchObject({ net: 1000, totalDebit: 1165, partnerFee: 155, platformFee: 10, error: null });
});