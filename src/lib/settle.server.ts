// Server-only, idempotent settlement for ObPay-managed payment records
// (hosted checkout links and the public merchant API).
//
// Several things settle a payment at the same time: the payer's status page, the
// merchant dashboard, the API caller, and the webhook receiver. Without a
// single claim step the same payment could be marked successful twice and the
// merchant would receive duplicate emails and webhooks. `settlePaymentRecord`
// claims the record with a conditional update and only the winning caller
// performs the side effects.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const db = () => supabaseAdmin as any;

export type Terminal = "success" | "failed";

export function normalizeSettlementStatus(raw: string): "pending" | Terminal | null {
  const s = String(raw || "").toLowerCase().trim();
  if (["success", "successful", "completed", "complete", "paid", "sandbox"].includes(s)) return "success";
  if (["failed", "failure", "cancelled", "canceled", "rejected", "declined", "expired", "reversed"].includes(s))
    return "failed";
  if (["pending", "processing", "in_progress", "initiated"].includes(s)) return "pending";
  return null;
}

export interface SettleResult {
  claimed: boolean;
  status: string;
  record: Record<string, any> | null;
}

export async function collectionFeeFor(record: Record<string, any>, verifiedPartnerFee?: number) {
  const { collectionFee, collectFeePercent, PARTNER_COLLECTION_PERCENT } = await import("./platform-fees");
  const amount = Number(record.amount) || 0;
  const currency = String(record.currency || "UGX");
  if (amount <= 0) return 0;
  const { data: ps, error } = await db().from("platform_settings").select("platform_fee_percent,currency_fees").limit(1).maybeSingle();
  if (error || ps?.platform_fee_percent == null || !Number.isFinite(Number(ps.platform_fee_percent))) {
    throw new Error("Deposit fees are temporarily unavailable. Please try again shortly.");
  }
  const stored = record.metadata?.partner_fee;
  const reported = verifiedPartnerFee ?? (stored == null ? undefined : Number(stored));
  const partner = reported != null && Number.isFinite(reported) && reported >= 0
    ? reported : amount * PARTNER_COLLECTION_PERCENT / 100;
  return collectionFee(amount, currency, collectFeePercent(currency, Number(ps.platform_fee_percent), ps.currency_fees), partner);
}

/**
 * Moves a pending payment record to a terminal state exactly once and fires
 * the webhook + notification side effects for the caller that won the claim.
 */
export async function settlePaymentRecord(
  record: Record<string, any>,
  next: Terminal,
  opts: { fee?: number; partnerFee?: number; providerReference?: string | null } = {},
): Promise<SettleResult> {
  const now = new Date().toISOString();
  const amount = Number(record.amount) || 0;
  let fee = Number.isFinite(opts.fee) ? Number(opts.fee) : Number(record.fee_amount) || 0;
  // Received payments carry ObPay's admin-set fee, which also covers the partner's charge.
  if (record.type !== "payout" && next === "success") fee = await collectionFeeFor(record, opts.partnerFee);

  const { data: settlement, error } = await db().rpc("settle_payment_record_and_balance", {
    p_record_id: record.id,
    p_status: next,
    p_fee: fee,
    p_provider_reference: opts.providerReference || null,
  });
  if (error) throw new Error(error.message || "Could not settle this payment.");

  const claimed = settlement?.claimed === true;
  const row = settlement?.record || null;
  // Another poller already settled this payment — never notify twice.
  if (!claimed) return { claimed: false, status: row?.status || next, record: row };

  const kind = record.type === "payout" ? "payout" : "collection";

  try {
    const { dispatchWebhook, deliverCallback } = await import("./platform.server");
    const evtPayload = {
      reference: record.reference,
      amount,
      fee,
      net_amount: row.net_amount,
      currency: record.currency,
      phone_number: record.phone_number,
      status: next,
      type: kind,
      metadata: record.metadata?.merchant_metadata ?? null,
    };
    const cb = String(record.metadata?.callback_url || "").trim();
    if (cb) await deliverCallback(record.merchant_id, cb, `${kind}.${next}`, evtPayload);
    await dispatchWebhook(record.merchant_id, `${kind}.${next}`, {
      reference: record.reference,
      provider_reference: row.provider_reference ?? null,
      amount,
      fee: fee,
      net_amount: row.net_amount,
      currency: record.currency,
      phone_number: record.phone_number,
      status: next,
      type: kind,
    });
  } catch {
    /* webhook delivery must never break settlement */
  }

  try {
    const { notifySettlement } = await import("./notify.server");
    await notifySettlement({
      merchantId: record.merchant_id,
      reference: record.reference,
      type: kind,
      amount,
      currency: record.currency,
      status: next,
      phone_number: record.phone_number,
      description: record.description,
      source: record.source || "api",
    });
  } catch {
    /* notifications must never break settlement */
  }

  return { claimed: true, status: next, record: row };
}

/**
 * Asks the gateway for the current state of a pending record and settles it when
 * the partner reports a terminal status. Returns the up-to-date record.
 *
 * Payouts can be queried directly. Collections are completed by the payer on the
 * hosted checkout and are settled by the callback endpoint, so there is nothing
 * to poll for them.
 */
export async function refreshPaymentRecord(record: Record<string, any>): Promise<Record<string, any>> {
  if (!record || record.status !== "pending") return record;
  // A network request still in flight (or timed out) is not a failed payout.
  // Keep its reservation until acceptance is saved or support verifies it.
  if (record.type === "payout" && record.metadata?.atomic_reservation && !record.provider_reference) return record;
  const { getGatewayCreds, gatewayPayoutStatus, gatewayCollectionStatus } = await import("./gateway.server");
  const creds = await getGatewayCreds();
  if (!creds) return record;

  if (record.type !== "payout") {
    const chk = await gatewayCollectionStatus(creds, record.reference);
    if (!chk.ok || !chk.status || chk.status === "pending") return record;
    const status = chk.status === "success" && chk.amount > 0 && chk.amount < Number(record.amount || 0) ? "failed" : chk.status;
    const done = await settlePaymentRecord(record, status, { providerReference: record.reference, partnerFee: chk.partnerFee });
    return done.record || { ...record, status };
  }

  const out = await gatewayPayoutStatus(creds, {
    merchantReference: record.reference,
    platformReference: record.provider_reference || null,
  });
  const next = out.ok ? out.status : null;
  if (!next || next === "pending") return record;

  const settled = await settlePaymentRecord(record, next, {
    providerReference: out.platformReference || record.provider_reference || null,
  });
  if (settled.record) return settled.record;

  // Lost the claim: return whatever the winner wrote.
  const { data: fresh } = await db().from("payment_records").select("*").eq("id", record.id).maybeSingle();
  return fresh || { ...record, status: next };
}

/** Reconciles a bounded batch before returning a merchant's balance. */
export async function refreshMerchantPendingPayments(merchantId: string, limit = 50): Promise<void> {
  const { data: pending } = await db()
    .from("payment_records")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));

  for (const record of pending ?? []) {
    try {
      await refreshPaymentRecord(record);
    } catch {
      /* one provider lookup must not prevent the remaining records from syncing */
    }
  }
}
