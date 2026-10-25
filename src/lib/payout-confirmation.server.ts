import { getGatewayCreds, gatewayPayoutStatus } from "./gateway.server";

export async function reviewVerifiedPayout(input: { recordId: string; partnerReference: string; status?: "success" | "failed"; reason?: string }, actor: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;
  const { data: record, error } = await db.from("payment_records").select("*").eq("id", input.recordId).single();
  if (error || !record || record.type !== "payout") throw new Error("Payout not found.");
  const reference = String(record.provider_reference || input.partnerReference || "").trim();
  if (!reference) throw new Error("Enter the payment-network tracking reference to verify this payout.");
  const creds = await getGatewayCreds();
  if (!creds) throw new Error("Payment verification is unavailable. No balance was changed.");
  const check = await gatewayPayoutStatus(creds, { platformReference: reference });
  const raw = check.res?.raw;
  const partner = raw?.payout || (Array.isArray(raw?.payouts) ? raw.payouts.find((p: any) => p.reference === reference) : null) || raw?.data?.payout || raw?.data;
  if (!check.ok || !partner || String(partner.reference || "") !== reference || !check.status) throw new Error("No matching payment-network payout was found. No balance was changed.");
  const currency = String(partner.currency || "").toUpperCase();
  const net = Number(partner.net_amount);
  const total = Number(record.metadata?.total_debit);
  const fees = Number(record.metadata?.partner_fee || 0) + Number(record.metadata?.obpay_fee || 0);
  if (currency !== record.currency || !Number.isFinite(net) || !Number.isFinite(total) || Math.abs(net - (total - fees)) > 0.01) throw new Error("The payment-network currency or amount does not match this payout. No balance was changed.");
  // A rejected submission may have no saved tracking reference. Never attach an
  // unrelated payout merely because its amount matches.
  if (!record.provider_reference) {
    const digits = (s: unknown) => String(s || "").replace(/\D/g, "").slice(-9);
    const phone = digits(partner.account_number);
    const metadata = partner.metadata || {};
    if (!phone || phone !== digits(record.phone_number) ||
        (metadata.obpay_reference !== record.reference && partner.merchant_reference !== record.reference && partner.reference !== record.reference)) {
      throw new Error("The network payout is not linked to this ObPay reference and recipient. No balance was changed.");
    }
  }
  const evidence = { reference, status: check.status, currency, net_amount: net, fee: Number(partner.fee || 0), verified_at: new Date().toISOString() };
  if (!input.status) return { success: true as const, evidence, currentStatus: record.status, totalDebit: total, fee: fees };
  if (input.status !== check.status || check.status === "pending") throw new Error("Confirmation must match the payment-network result. Pending payouts cannot be confirmed yet.");
  const reason = String(input.reason || "").trim();
  if (reason.length < 5) throw new Error("Enter a confirmation reason of at least five characters.");
  const { data: result, error: confirmError } = await db.rpc("confirm_payout_status", {
    p_record_id: record.id, p_status: input.status, p_provider_reference: reference,
    p_actor: actor, p_reason: reason, p_evidence: evidence,
  });
  if (confirmError) throw new Error(confirmError.message || "Could not confirm this payout.");
  return { success: true as const, evidence, result };
}