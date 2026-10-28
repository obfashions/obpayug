import { describe, expect, it, vi, beforeEach } from "vitest";
import { airtimeInput, billInput, cardInput, moneyRaw, serviceState } from "./secondary-service-rules";

const reference = "550e8400-e29b-41d4-a716-446655440000";
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("./settle.server", () => ({ settlePaymentRecord: vi.fn(async (r, status) => ({ record: { ...r, status } })), collectionFeeFor: vi.fn(async () => 250) }));
import { refreshSecondaryRecord, secondaryAction } from "./marz-services.server";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-only");
  vi.stubEnv("UDC_MARZPAY_SERVICES_2_API_KEY", "test-only");
  rpc.mockReset();
});
describe("secondary service rules", () => {
  it("accepts 500 UGX airtime and rejects 499 and fractional amounts", () => {
    expect(airtimeInput.parse({ reference, purchase_type: "airtime", msisdn: "0771234567", amount: 500 }).msisdn).toBe("256771234567");
    for (const amount of [499, 500.5]) expect(airtimeInput.safeParse({ reference, purchase_type: "airtime", msisdn: "0771234567", amount }).success).toBe(false);
  });
  it("does not accept an entered amount on a data bundle", () => {
    expect(airtimeInput.safeParse({ reference, purchase_type: "bundle", msisdn: "0771234567", bundle_id: "p", amount: 500 }).success).toBe(false);
  });
  it("requires a NWSC area and TV package", () => {
    const base = { reference, meter_number: "123456789", phone_number: "0771234567", amount: 1000, expected_fee: 1200 };
    expect(billInput.safeParse({ ...base, utility_code: "NWSC" }).success).toBe(false);
    expect(billInput.safeParse({ ...base, utility_code: "DSTV" }).success).toBe(false);
    expect(billInput.safeParse({ ...base, utility_code: "NWSC", area: "Kampala" }).success).toBe(true);
  });
  it("limits card amounts to 500 through 10000000 whole UGX", () => {
    expect(cardInput.safeParse({ reference, amount: 10000000, description: "Order" }).success).toBe(true);
    for (const amount of [499, 10000001, 500.5]) expect(cardInput.safeParse({ reference, amount, description: "Order" }).success).toBe(false);
  });
  it("rejects nonfinite or missing trusted fees", () => {
    expect(moneyRaw({ raw: "1200.00" })).toBe(1200);
    for (const value of [null, Infinity, "NaN", ""]) expect(moneyRaw(value)).toBeNull();
  });
  it("does not treat an API success envelope as delivery confirmation", () => {
    expect(serviceState("success")).toBe("pending");
    expect(serviceState("completed")).toBe("success");
  });
  it("keeps automatic bank transfers blocked before moving money", async () => {
    const out = await secondaryAction("bank-transfer", "merchant", { amount: 1000 });
    expect(out.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not settle a mismatched card amount", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { status: "completed", amount: { raw: 4000 }, charge: { raw: 200 } } }))));
    const row = { id: "record", reference, amount: 5000, status: "pending", metadata: { provider: "marz", service: "card_payments" } };
    expect(await refreshSecondaryRecord(row)).toEqual(row);
    expect(rpc).not.toHaveBeenCalled();
  });
});