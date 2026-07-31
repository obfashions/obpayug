import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ────────────────────────────────────────────────────────────────────────────────
// MarzPay Webhook Receiver (FALLBACK)
//
// PRIMARY sync mechanism: aggressive 5-pass polling in obpay-api-no-jwt.
// THIS FUNCTION: safety net — resolves transactions as soon as MarzPay notifies us.
// Deploy with verify_jwt=false so MarzPay can POST directly.
//
// MarzPay payload:
// {
//   "event_type": "collection.completed" | "collection.failed" |
//                 "disbursement.completed" | "disbursement.failed",
//   "transaction": { "uuid", "reference", "status", "amount": { "raw", "currency" }, ... },
//   "collection" | "disbursement": { "provider", "phone_number", "charge": { "raw" }, ... }
// }
// Signature header: X-MarzPay-Signature (HMAC-SHA256 of the raw body, hex).
// ────────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-marzpay-signature, x-webhook-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function normalizeStatus(raw: string): "success" | "failed" | "pending" | null {
  const s = (raw || "").toLowerCase().trim();
  if (["success", "successful", "completed", "sandbox"].includes(s)) return "success";
  if (["failed", "failure", "rejected", "declined", "cancelled", "canceled", "expired"].includes(s)) return "failed";
  if (["pending", "processing", "in_progress", "initiated"].includes(s)) return "pending";
  return null;
}

function statusFromEvent(eventType: string): "success" | "failed" | "pending" | null {
  const e = (eventType || "").toLowerCase();
  if (e.endsWith(".completed") || e.endsWith(".successful") || e.endsWith(".success")) return "success";
  if (e.endsWith(".failed") || e.endsWith(".cancelled") || e.endsWith(".expired")) return "failed";
  if (e.endsWith(".pending") || e.endsWith(".processing")) return "pending";
  return null;
}

async function verifySignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const given = (signature || "").replace(/^sha256=/i, "").trim().toLowerCase();
    if (given.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    return json({
      status: "ok",
      message: "MarzPay Webhook Receiver v1.0",
      provider: "marzpay",
      primary_mechanism: "Aggressive 5-pass polling in obpay-api-no-jwt",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const rawBody = await req.text();
  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON" }, 400); }

  // Optional signature verification — enabled once MARZ_WEBHOOK_SECRET is set.
  const webhookSecret = Deno.env.get("MARZ_WEBHOOK_SECRET") || "";
  if (webhookSecret) {
    const signature = req.headers.get("x-marzpay-signature") || req.headers.get("x-webhook-signature") || "";
    if (!signature || !(await verifySignature(webhookSecret, rawBody, signature))) {
      console.warn("[Marz Webhook] Invalid signature — rejected");
      return json({ error: "Invalid signature" }, 401);
    }
  }

  console.log("[Marz Webhook] Received:", rawBody.slice(0, 500));

  const webhookId = crypto.randomUUID();
  await supabase.from("julypay_hooks").insert({
    id: webhookId,
    payload,
    received_at: new Date().toISOString(),
    processed: false,
  }).then(() => {}, () => {});

  const txnNode = payload.transaction || payload.data?.transaction || {};
  const detail = payload.collection || payload.disbursement || payload.data?.collection || payload.data?.disbursement || {};
  const eventType = payload.event_type || payload.event || "";
  const providerRef = String(txnNode.reference || payload.reference || "").trim();
  const providerUuid = String(txnNode.uuid || payload.uuid || "").trim();
  const normalizedStatus = normalizeStatus(txnNode.status || payload.status || "") || statusFromEvent(eventType);

  if (!providerRef && !providerUuid) {
    return json({ received: true, warning: "No transaction reference in payload" });
  }
  if (!normalizedStatus || normalizedStatus === "pending") {
    return json({ received: true, note: `Event "${eventType}" is not terminal` });
  }

  // Match on the provider reference stored when the transaction was created.
  let txn: any = null;
  const { data: pendingRows } = await supabase.from("transactions").select("*").eq("status", "pending").limit(500);
  for (const row of pendingRows || []) {
    const meta = row.metadata || {};
    if (
      (providerRef && (meta.lp_reference === providerRef || row.merchant_reference === providerRef || row.reference === providerRef || row.provider_reference === providerRef)) ||
      (providerUuid && (meta.lp_internal_ref === providerUuid || row.provider_reference === providerUuid))
    ) { txn = row; break; }
  }

  if (!txn) {
    console.warn(`[Marz Webhook] No pending txn for ref="${providerRef}" uuid="${providerUuid}"`);
    await supabase.from("julypay_hooks").update({ processed: true, processing_note: "no_matching_transaction" }).eq("id", webhookId);
    return json({ received: true, note: "Transaction not found or already resolved" });
  }

  const chargeAmount = Number(detail.charge?.raw ?? detail.charge ?? 0) || 0;
  const updates: any = { status: normalizedStatus };
  if (normalizedStatus === "success") {
    updates.completed_at = new Date().toISOString();
    if (chargeAmount > 0) updates.fee_amount = chargeAmount;
  }
  if (providerUuid) updates.provider_reference = providerUuid;

  const { data: updatedRows } = await supabase.from("transactions").update(updates).eq("id", txn.id).eq("status", "pending").select("id");
  if (!updatedRows || updatedRows.length === 0) {
    await supabase.from("julypay_hooks").update({ processed: true, processing_note: "race_condition_resolved_by_polling" }).eq("id", webhookId);
    return json({ received: true, note: "Already resolved by polling engine" });
  }

  const fee = chargeAmount > 0 ? chargeAmount : Number(txn.fee_amount || 0);
  const creditAmount = Number(txn.amount) - fee;

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

  console.log(`[Marz Webhook] Resolved txn ${txn.id.slice(0, 8)} -> ${normalizedStatus}`);
  return json({ received: true, resolved: normalizedStatus, transaction_id: txn.id, reference: txn.reference });
});
