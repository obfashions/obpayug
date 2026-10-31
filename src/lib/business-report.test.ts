import { describe, expect, it } from "vitest";
import { businessTotals, businessCsv, type BusinessPayment } from "./business-report";
const payment = (patch: Partial<BusinessPayment>): BusinessPayment => ({ reference: "one", amount: 100, currency: "UGX", status: "success", type: "collection", created_at: "2026-10-31", ...patch });
describe("business statements", () => {
  it("never sums separate currency balances or includes failed receipts", () => {
    expect(businessTotals([payment({}), payment({ currency: "RWF", amount: 200 }), payment({ status: "failed", amount: 9000 })])).toEqual({ UGX: { received: 100, sent: 0, fees: 0 }, RWF: { received: 200, sent: 0, fees: 0 } });
  });
  it("records payouts as money sent and pending payments as unsettled", () => {
    expect(businessTotals([payment({ type: "payout", amount: 500, fee_amount: 20 }), payment({ status: "pending" })]).UGX).toEqual({ received: 0, sent: 500, fees: 20 });
  });
  it("escapes spreadsheet formulas and embedded quotes", () => {
    const csv = businessCsv([payment({ description: '=HYPERLINK("evil")' })]);
    expect(csv).toContain('"\'=HYPERLINK(""evil"")"');
  });
});