import { describe, expect, it, vi, beforeEach } from "vitest";
import { airtimeInput, billInput, cardInput, moneyRaw, serviceState, bankFee, bankInput } from "./secondary-service-rules";

const reference = "550e8400-e29b-41d4-a716-446655440000";
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("./settle.server", () => ({ settlePaymentRecord: vi.fn(async (r, status) => ({ record: { ...r, status } })), collectionFeeFor: vi.fn(async () => 250) }));
import { refreshSecondaryRecord, secondaryAction, secondaryErrorMessage } from "./marz-services.server";

beforeEach(() => {
  vi.stubEnv("LOVABLE_API_KEY", "test-only");
  vi.stubEnv("UDC_MARZPAY_SERVICES_2_API_KEY", "test-only");
  rpc.mockReset();
});
describe("secondary service rules", () => {
  it("does not call a named but unconfirmed Bank of Africa account verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { account_name: "RAHA VOYAGE SAFARIS LTD", valid: false, is_registered: "", status_code: 0, status_description: "SUCCESS" } }))));
    expect(await secondaryAction("bank-validate", "merchant", { bankName: "Bank of Africa", accountNumber: "03897690002" })).toEqual({ success: false, error: "The bank found this account, but has not confirmed it is active. Ask your bank to confirm its registration for bank-network transfers, then try verification again. No money has been moved." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("accepts network-confirmed active bank accounts with a registered name", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { account_name: "RAHA VOYAGE SAFARIS LTD", valid: true, is_registered: "ACTIVE", status_code: 0 } }))));
    expect(await secondaryAction("bank-validate", "merchant", { bankName: "Bank of Africa", accountNumber: "03897690002" })).toEqual({ success: true, data: { account_name: "RAHA VOYAGE SAFARIS LTD", valid: true } });
  });
  it("distinguishes bank validation rejection from a connection outage", () => {
    expect(secondaryErrorMessage("VALIDATION_FAILED", 400)).toBe("The bank could not verify this account. Check the bank and account number with the recipient.");
    expect(secondaryErrorMessage("BANK_NOT_SUPPORTED", 400)).toBe("This bank is not supported. Select a bank from the current list.");
  });
  it("reads an enabled bank connection without inventing fee settings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { bank_transfer_available: true } }))));
    expect(await secondaryAction("bank-services", null, {})).toEqual({ success: true, data: { bank_transfer_available: true, bank_transfer_settings: null } });
  });
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
    expect(serviceState("successful")).toBe("success");
  });
  it("rejects incomplete bank transfers before moving money", async () => {
    const out = await secondaryAction("bank-transfer", "merchant", { amount: 1000 });
    expect(out.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires an exact bank fee rather than guessing the documentation example", () => {
    expect(bankFee(null, 100000)).toBeNull();
    expect(bankFee({ amount_type: "fixed", fixed_transfer_charge: 50000 }, 100000)).toBe(50000);
    expect(bankFee({ amount_type: "percentage", charge_percentage: 2 }, 100000)).toBe(2000);
  });
  it("accepts recipient bank details without a linked business bank account", () => {
    expect(bankInput.safeParse({ reference, amount: 100000, description: "Services", bank_name: "Equity Bank", bank_account_number: "60001256421", confirmed_name: "John Doe", expected_fee: 50000 }).success).toBe(true);
  });
  it("does not settle a mismatched card amount", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { status: "completed", amount: { raw: 4000 }, charge: { raw: 200 } } }))));
    const row = { id: "record", reference, amount: 5000, status: "pending", metadata: { provider: "marz", service: "card_payments" } };
    expect(await refreshSecondaryRecord(row)).toEqual(row);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("credits a matching verified card only through the restricted wallet RPC", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { transaction: { reference, status: "completed", amount: { raw: 5000, currency: "UGX" }, charge: { raw: 200 } } } }))));
    rpc.mockResolvedValue({ data: { record: { status: "success" } }, error: null });
    await refreshSecondaryRecord({ id: "record", reference, amount: 5000, status: "pending", metadata: { provider: "marz", service: "card_payments" } });
    expect(rpc).toHaveBeenCalledWith("settle_secondary_card", { p_record_id: "record", p_status: "success", p_fee: 250, p_partner_fee: 200 });
  });
  it("never credits a same-number amount in a different currency", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status: "success", data: { transaction: { reference, status: "completed", amount: { raw: 5000, currency: "RWF" }, charge: { raw: 200 } } } }))));
    await refreshSecondaryRecord({ id: "record", reference, amount: 5000, status: "pending", metadata: { provider: "marz", service: "card_payments" } });
    expect(rpc).not.toHaveBeenCalled();
  });
});