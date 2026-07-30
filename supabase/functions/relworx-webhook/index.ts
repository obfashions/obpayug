import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { createHmac } from "https://deno.land/std@0.168.0/hash/mod.ts";

/**
 * Relworx Webhook Receiver
 *
 * Relworx sends a POST to this endpoint when a transaction status changes.
 * All incoming requests are verified via HMAC-SHA256 using the RELIORX_WEBHOOK_SIGNING_KEY.
 *
 * Payload format from Relworx docs:
 * {
 *   "status": "success",
 *   "message": "Request payment completed successfully.",
 *   "customer_reference": "kemist656ehgvcd",
 *   "internal_reference": "fdd10a4c5d6b459d54ebc5f09d095101",
 *   "msisdn": "+256773454899",
 *   "amount": 500.0,
 *   "currency": "UGX",
 *   "provider": "mtn_mobile_money",
 *   "charge": 12.5,
 *   "completed_at": "2025-04-10T15:12:58.977+03:00"
 * }
 *
 * This receiver:
 * 1. Verifies the x-relworx-signature HMAC before processing
 * 2. Finds the matching transaction by customer_reference or internal_reference
 * 3. Updates transaction status
 * 4. Credits merchant wallet on success
 * 5. Responds 200 OK to acknowledge (Relworx retries 10x with exponential backoff if not 200)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-relworx-signature",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUCCESS_STATES = new Set(["success", "successful", "completed", "complete", "approved", "done", "paid"]);
const FAILED_STATES = new Set(["failed", "failure", "error", "declined", "rejected", "cancelled", "canceled", "expired"]);

/**
 * Verify the HMAC-SHA256 signature from Relworx.
 * Relworx signs the raw request body with the signing key and sends it as x-relworx-signature.
 */
function verifySignature(bodyText: string, signatureHeader: string | null, signingKey: string): boolean {
  if (!signatureHeader) {
    console.warn("[relworx-webhook] Missing x-relworx-signature header");
    return false;
  }

  if (!signingKey) {
    console.error("[relworx-webhook] RELIORX_WEBHOOK_SIGNING_KEY not configured");
    return false;
  }

  try {
    const hmac = createHmac("sha256", signingKey);
    hmac.update(bodyText);
    const computedSignature = hmac.toString("hex");

    // Allow both raw hex and hex-prefixed comparisons
    const isValid = computedSignature === signatureHeader || 
                    computedSignature === signatureHeader.toLowerCase();

    if (!isValid) {
      console.warn(`[relworx-webhook] Signature mismatch. Expected: ${computedSignature.substring(0, 16)}..., Got: ${signatureHeader.substring(0, 16)}...`);
    }

    return isValid;
  } catch (err) {
    console.error("[relworx-webhook] Error computing HMAC:", err);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", message: "Relworx webhook receiver is live", provider: "Relworx" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ---- SIGNATURE VERIFICATION ----
  const signingKey = Deno.env.get("RELIORX_WEBHOOK_SIGNING_KEY") ?? "";
  const signatureHeader = req.headers.get("x-relworx-signature");

  const bodyText = await req.text();
  
  if (!verifySignature(bodyText, signatureHeader, signingKey)) {
    console.error("[relworx-webhook] HMAC verification failed — rejecting webhook");
    return new Response(JSON.stringify({ received: false, error: "Invalid signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[relworx-webhook] HMAC signature verified successfully");
  // ---- END SIGNATURE VERIFICATION ----

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    console.error("[relworx-webhook] Invalid JSON received");
    return new Response(JSON.stringify({ received: false, error: "Invalid JSON" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Extract fields from Relworx payload
  const status = String(payload?.status || "").toLowerCase().trim();
  const customerReference = String(payload?.customer_reference || "");
  const internalReference = String(payload?.internal_reference || "");
  const msisdn = String(payload?.msisdn || "");
  const amount = parseFloat(String(payload?.amount || "0")) || 0;
  const currency = String(payload?.currency || "UGX");
  const provider = String(payload?.provider || "");
  const charge = parseFloat(String(payload?.charge || "0")) || 0;
  const completedAt = payload?.completed_at || new Date().toISOString();

  console.log(`[relworx-webhook] Received: status=${status}, customer_ref=${customerReference}, internal_ref=${internalReference}, amount=${amount} ${currency}, provider=${provider}`);

  // Log the webhook
  await supabaseAdmin.from("webhook_logs").insert({
    event_type: `relworx.payment.${status}`,
    payload: payload,
    created_at: new Date().toISOString(),
  }).then(() => {}, () => {});

  // Find matching transaction
  let txn: any = null;

  // First try by customer_reference (our merchant reference)
  if (customerReference) {
    const { data } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, merchant_reference, fee_amount")
      .or(`reference.eq.${customerReference},merchant_reference.eq.${customerReference}`)
      .maybeSingle();
    if (data) txn = data;
  }

  // Then try by internal_reference (Relworx's own reference)
  if (!txn && internalReference) {
    const { data } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, merchant_reference, fee_amount")
      .eq("provider_reference", internalReference)
      .maybeSingle();
    if (data) txn = data;
  }

  if (!txn) {
    console.warn(`[relworx-webhook] No matching transaction found: customer_ref=${customerReference}, internal_ref=${internalReference}`);
    return new Response(JSON.stringify({ received: true, warning: "Transaction not found", acknowledged: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If already in a terminal state, skip
  if (txn.status !== "pending") {
    console.log(`[relworx-webhook] Transaction ${txn.id} already in terminal state: ${txn.status}`);
    return new Response(JSON.stringify({ received: true, message: `Already ${txn.status}`, acknowledged: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const gross = parseFloat(String(txn.amount));
  const netAmount = gross - charge;

  if (SUCCESS_STATES.has(status)) {
    console.log(`[relworx-webhook] SUCCESS — crediting wallet for txn ${txn.id}, user ${txn.user_id}, amount ${gross} ${currency}`);

    // Update transaction
    await supabaseAdmin.from("transactions").update({
      status: "success",
      fee_amount: charge,
      net_amount: netAmount,
      provider_reference: internalReference || txn.provider_reference,
      completed_at: completedAt,
    }).eq("id", txn.id);

    if (txn.type === "collection") {
      // Credit merchant wallet
      const { data: w } = await supabaseAdmin.from("merchant_wallets")
        .select("id, available_balance, total_collections")
        .eq("user_id", txn.user_id).maybeSingle();

      if (w) {
        const newAvailable = Number(w.available_balance || 0) + gross;
        const newTotal = Number(w.total_collections || 0) + gross;
        await supabaseAdmin.from("merchant_wallets").update({
          available_balance: newAvailable,
          total_collections: newTotal,
          updated_at: new Date().toISOString(),
        }).eq("user_id", txn.user_id);
        console.log(`[relworx-webhook] Wallet credited: ${Number(w.available_balance)} -> ${newAvailable} for user ${txn.user_id}`);
      } else {
        // Create wallet
        await supabaseAdmin.from("merchant_wallets").insert({
          user_id: txn.user_id, currency,
          available_balance: gross, pending_balance: 0,
          total_collections: gross, total_payouts: 0,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        console.log(`[relworx-webhook] New wallet created for user ${txn.user_id} with balance ${gross}`);
      }

      // Send notification
      await supabaseAdmin.from("notifications").insert({
        user_id: txn.user_id,
        type: "payment_received",
        title: "Payment Received",
        message: `${gross.toLocaleString()} ${currency} collected via ${provider || "mobile money"}. Transaction: ${txn.reference}.`,
      }).then(() => {}, () => {});
    } else if (txn.type === "payout") {
      // Update payout_requests record
      await supabaseAdmin.from("payout_requests").update({
        status: "completed",
        provider_reference: internalReference || txn.provider_reference,
        completed_at: completedAt,
      }).eq("provider_reference", txn.reference).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ received: true, status: "success", credited: txn.type === "collection", acknowledged: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (FAILED_STATES.has(status)) {
    console.log(`[relworx-webhook] FAILED — marking txn ${txn.id} as failed`);

    await supabaseAdmin.from("transactions").update({
      status: "failed",
      completed_at: completedAt,
    }).eq("id", txn.id);

    // Refund wallet for failed payouts
    if (txn.type === "payout") {
      const refundAmount = parseFloat(String(txn.amount)) + parseFloat(String(txn.fee_amount || 0));
      const { data: w } = await supabaseAdmin.from("merchant_wallets")
        .select("available_balance").eq("user_id", txn.user_id).maybeSingle();
      if (w && refundAmount > 0) {
        await supabaseAdmin.from("merchant_wallets").update({
          available_balance: Number(w.available_balance) + refundAmount,
          updated_at: new Date().toISOString(),
        }).eq("user_id", txn.user_id);
        console.log(`[relworx-webhook] Refunded ${refundAmount} to payout user ${txn.user_id}`);
      }

      // Update payout request
      await supabaseAdmin.from("payout_requests").update({
        status: "failed",
        rejection_reason: `Relworx: ${payload?.message || status}`,
      }).eq("provider_reference", txn.reference).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ received: true, status: "failed", acknowledged: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Unknown status — acknowledge but don't update
  console.log(`[relworx-webhook] Unknown status: ${status}. Acknowledging without update.`);
  return new Response(JSON.stringify({ received: true, status: "acknowledged", note: `Unknown status: ${status}` }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});