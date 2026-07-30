import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ────────────────────────────────────────────────────────────────────────────────
// LivePay Webhook Receiver (FALLBACK ONLY)
//
// PRIMARY sync mechanism: Aggressive 5-pass polling in obpay-api-no-jwt (v5.0)
// THIS FUNCTION: Safety net — catches LivePay webhooks if they arrive.
// Deployed with verify_jwt=false so LivePay can POST directly.
//
// LivePay webhook payload:
// {
//   "status": "Success" | "Failed" | "Pending",
//   "message": "Payment completed successfully",
//   "customer_reference": "INV-123456789",
//   "internal_reference": "uuid",
//   "msisdn": "+256777123456",
//   "amount": 50000,
//   "currency": "UGX",
//   "provider": "MTN",
//   "charge": 1500,
//   "completed_at": "2024-01-15 10:35:00"
// }
// ────────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeLivePayStatus(rawStatus: string): "success" | "failed" | "pending" | null {
  const s = (rawStatus || "").toLowerCase().trim();
  if (["success", "successful", "completed"].includes(s)) return "success";
  if (["failed", "failure", "rejected", "declined", "cancelled", "fail"].includes(s)) return "failed";
  if (["pending", "processing"].includes(s)) return "pending";
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json({
      status: "ok",
      message: "LivePay Webhook Receiver v2.0 — fallback only",
      primary_mechanism: "Aggressive 5-pass polling in obpay-api-no-jwt",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  let payload: any;
  try { payload = JSON.parse(await req.text()); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  console.log("[LivePay Webhook v2] Received:", JSON.stringify(payload).slice(0, 500));

  // Store raw webhook for audit
  const webhookId = crypto.randomUUID();
  await supabase.from("julypay_hooks").insert({
    id: webhookId,
    payload,
    received_at: new Date().toISOString(),
    processed: false,
  }).then(() => {}, () => {});

  const customerRef = payload.customer_reference || payload.reference || "";
  const internalRef = payload.internal_reference || "";
  const rawStatus = payload.status || "";
  const normalizedStatus = normalizeLivePayStatus(rawStatus);

  if (!customerRef && !internalRef) {
    return json({ received: true, warning: "No transaction reference in payload" });
  }

  if (!normalizedStatus || normalizedStatus === "pending") {
    return json({ received: true, note: `Status "${rawStatus}" is not terminal` });
  }

  // Find matching transaction — try multiple strategies
  let txn: any = null;

  if (customerRef) {
    const { data } = await supabase.from("transactions").select("*")
      .or(`merchant_reference.eq.${customerRef},reference.eq.${customerRef}`)
      .eq("status", "pending").maybeSingle();
    if (data) txn = data;
  }

  if (!txn && internalRef) {
    const { data: rows } = await supabase.from("transactions").select("*").eq("status", "pending");
    if (rows) {
      for (const row of rows) {
        const meta = row.metadata || {};
        if (meta.lp_internal_ref === internalRef || meta.lp_reference === customerRef || meta.lp_reference === internalRef) {
          txn = row; break;
        }
      }
    }
  }

  if (!txn && customerRef) {
    const { data } = await supabase.from("transactions").select("*").eq("provider_reference", customerRef).eq("status", "pending").maybeSingle();
    if (data) txn = data;
  }

  if (!txn) {
    console.warn(`[LivePay Webhook v2] No pending txn for ref="${customerRef}"`);
    await supabase.from("julypay_hooks").update({ processed: true, processing_note: "no_matching_transaction" }).eq("id", webhookId);
    return json({ received: true, note: "Transaction not found or already resolved" });
  }

  // Update transaction
  const updates: any = { status: normalizedStatus };
  const chargeAmount = Number(payload.charge || 0);

  if (normalizedStatus === "success") {
    updates.completed_at = payload.completed_at ? new Date(payload.completed_at).toISOString() : new Date().toISOString();
    if (chargeAmount > 0) updates.fee_amount = chargeAmount;
  }

  const { data: updatedRows } = await supabase.from("transactions").update(updates).eq("id", txn.id).eq("status", "pending").select("id");
  if (!updatedRows || updatedRows.length === 0) {
    console.log(`[LivePay Webhook v2] Race — txn ${txn.id} already resolved (likely by polling)`);
    await supabase.from("julypay_hooks").update({ processed: true, processing_note: "race_condition_resolved_by_polling" }).eq("id", webhookId);
    return json({ received: true, note: "Already resolved by polling engine" });
  }

  const fee = chargeAmount > 0 ? chargeAmount : Number(txn.fee_amount || 0);
  const creditAmount = txn.amount - fee;

  // Credit wallet on success
  if (normalizedStatus === "success" && txn.type === "collection") {
    const { data: wallet } = await supabase.from("merchant_wallets")
      .select("available_balance, total_collections").eq("user_id", txn.user_id).maybeSingle();
    if (wallet) {
      await supabase.from("merchant_wallets").update({
        available_balance: Number(wallet.available_balance || 0) + creditAmount,
        total_collections: Number(wallet.total_collections || 0) + creditAmount,
        updated_at: new Date().toISOString(),
      }).eq("user_id", txn.user_id);
    } else {
      await supabase.from("merchant_wallets").insert({
        user_id: txn.user_id, currency: txn.currency || "UGX",
        available_balance: creditAmount, total_collections: creditAmount,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    }
  }

  // Refund on failed payout
  if (normalizedStatus === "failed" && txn.type === "payout") {
    const refundAmount = Number(txn.amount) + Number(txn.fee_amount || 0);
    const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance").eq("user_id", txn.user_id).maybeSingle();
    if (wallet && refundAmount > 0) {
      await supabase.from("merchant_wallets").update({
        available_balance: Number(wallet.available_balance) + refundAmount,
        updated_at: new Date().toISOString(),
      }).eq("user_id", txn.user_id);
    }
  }

  await supabase.from("julypay_hooks").update({ processed: true, processing_note: `resolved_${normalizedStatus}` }).eq("id", webhookId);

  console.log(`[LivePay Webhook v2] Resolved txn ${txn.id.slice(0, 8)} -> ${normalizedStatus} (webhook fallback)`);
  return json({ received: true, resolved: normalizedStatus, transaction_id: txn.id, reference: txn.reference });
});
