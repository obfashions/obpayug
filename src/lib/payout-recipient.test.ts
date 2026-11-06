import { describe, expect, it } from "vitest";
import { payoutRecipientName } from "./payout-recipient";
describe("payout recipient names", () => {
  it("keeps the name supplied by every merchant payout caller", () => {
    for (const key of ["customer_name", "customerName", "recipient_name", "recipientName", "account_name", "accountName"]) expect(payoutRecipientName({ [key]: " Jane Merchant " })).toBe("Jane Merchant");
  });
  it("does not let an empty alias mask an entered nested name", () => {
    expect(payoutRecipientName({ customer_name: " ", customer: { name: "Jane Merchant" } })).toBe("Jane Merchant");
  });
  it("never substitutes a phone number or fabricated name", () => {
    expect(payoutRecipientName({ phoneNumber: "07856119684", customerName: " " })).toBe("");
  });
});