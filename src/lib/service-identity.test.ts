import { describe, expect, it, vi } from "vitest";

const rows: Record<string, any> = {};
const from = (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) }) }) });
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from, rpc: vi.fn() } }));
vi.mock("./settle.server", () => ({ settlePaymentRecord: vi.fn(), collectionFeeFor: vi.fn() }));
import { verifiedIdentity } from "./marz-services.server";

describe("service identity check", () => {
  it("accepts a merchant approved only on the migrated merchant profile", async () => {
    rows.kyc_submissions = null;
    rows.merchant_profiles = { verification_status: "approved", company_name: "Acme Ltd" };
    expect(await verifiedIdentity("u")).toEqual({ ok: true, name: "Acme Ltd" });
  });
  it("accepts approved KYC and uses the verified full name", async () => {
    rows.kyc_submissions = { status: "approved", full_name: "Jane  Doe" };
    rows.merchant_profiles = null;
    expect(await verifiedIdentity("u")).toEqual({ ok: true, name: "Jane Doe" });
  });
  it("rejects approved accounts without a verified name", async () => {
    rows.kyc_submissions = { status: "approved", full_name: null };
    rows.merchant_profiles = null;
    expect((await verifiedIdentity("u")).ok).toBe(false);
  });
  it("rejects unverified accounts", async () => {
    rows.kyc_submissions = { status: "pending", full_name: "Jane" };
    rows.merchant_profiles = { verification_status: "pending", company_name: "Acme" };
    expect(await verifiedIdentity("u")).toEqual({ ok: false, error: "Complete identity verification before using this service." });
  });
});
