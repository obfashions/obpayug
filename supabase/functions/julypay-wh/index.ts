
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-julypay-signature, x-julypay-event, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  if (req.method === "GET") {
    return new Response(JSON.stringify({
      status: "ok",
      message: "JulyPay Webhook v4.0 — JWT bypassed, ready for callbacks",
      timestamp: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ received: false, error: "Method not allowed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bodyText = await req.text();
  console.log("[JulyPay-v4] RAW:", bodyText.slice(0, 1200));

  let rawPayload: any;
  try { rawPayload = JSON.parse(bodyText); } catch {
    console.error("[JulyPay-v4] Invalid JSON");
    return new Response(JSON.stringify({ received: false, error: "Invalid JSON body" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const eventId = String(rawPayload?.id || rawPayload?.event_id || crypto.randomUUID());
  await supabaseAdmin.from("incoming_webhooks").insert({
    event_id: eventId,
    event_type: rawPayload?.type || rawPayload?.event || rawPayload?.event_type || "unknown",
    created_epoch: Date.now(),
    payload: rawPayload,
    processed: false,
    created_at: new Date().toISOString(),
  }).then(() => {}, (e: any) => console.warn("[JulyPay-v4] Log fail:", e.message));

  const eventData = rawPayload?.data || rawPayload?.payload || rawPayload?.transaction || rawPayload?.body || rawPayload;
  const eventType = String(rawPayload?.type || rawPayload?.event || rawPayload?.event_type || "");
  const status = String(eventData?.status || eventData?.state || "").toLowerCase().trim();
  const amount = parseFloat(String(eventData?.amount || eventData?.gross_amount || "0")) || 0;
  const feeAmount = parseFloat(String(eventData?.fee_amount || eventData?.collection_fee || eventData?.charge || "0")) || 0;

  const providerTxnId = String(eventData?.id || eventData?.transaction_id || eventData?.provider_id || eventData?.txn_id || eventData?.payment_id || "");
  const externalRef = String(eventData?.external_reference || eventData?.merchant_reference || eventData?.reference || eventData?.ref || "");
  const webhookPhone = String(eventData?.customer_phone || eventData?.phone || eventData?.phone_number || "");

  console.log(`[JulyPay-v4] type="${eventType}" status="${status}" amount=${amount} extRef="${externalRef}"`);

  const SKIP_EVENTS = new Set(["transaction.created", "transaction.pending", "payment.initiated", "collection.initiated"]);
  if (SKIP_EVENTS.has(eventType)) {
    return new Response(JSON.stringify({ received: true, status: "acknowledged" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUCCESS_STATUSES = new Set(["success", "successful", "completed", "done", "paid", "settled", "confirmed"]);
  const FAILED_STATUSES = new Set(["failed", "failure", "error", "declined", "rejected", "cancelled", "canceled", "expired"]);
  const isSuccessEvent = eventType.includes(".success") || eventType.includes(".completed") || eventType.includes("transaction.successful");
  const isFailedEvent = eventType.includes(".failed") || eventType.includes(".rejected") || eventType.includes(".declined");

  let txn: any = null;

  if (providerTxnId) {
    const { data } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, description, fee_amount")
      .eq("provider_reference", providerTxnId).maybeSingle();
    if (data) txn = data;
  }

  if (!txn && externalRef) {
    let { data } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, description, fee_amount")
      .eq("reference", externalRef).maybeSingle();
    if (data) txn = data;
    if (!txn) {
      const { data: d2 } = await supabaseAdmin.from("transactions")
        .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, description, fee_amount")
        .eq("merchant_reference", externalRef).maybeSingle();
      if (d2) txn = d2;
    }
  }

  if (!txn && amount > 0 && webhookPhone) {
    const { data: candidates } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, description, fee_amount")
      .eq("customer_phone", webhookPhone).eq("status", "pending").eq("type", "collection")
      .order("created_at", { ascending: false }).limit(5);
    if (candidates) txn = candidates.find((c: any) => Math.abs(Number(c.amount) - amount) < 1) || null;
  }

  if (!txn) {
    return new Response(JSON.stringify({ received: true, warning: "No matching transaction found" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (txn.status !== "pending") {
    return new Response(JSON.stringify({ received: true, message: `Already ${txn.status}` }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isSuccess = SUCCESS_STATUSES.has(status) || isSuccessEvent;
  const isFailed = FAILED_STATUSES.has(status) || isFailedEvent;

  if (isSuccess) {
    const gross = Number(txn.amount);
    const finalFee = feeAmount || Number(txn.fee_amount || 0);
    const finalNet = gross - finalFee;

    const { data: updatedRows } = await supabaseAdmin.from("transactions").update({
      status: "success", fee_amount: finalFee, net_amount: finalNet,
      provider_reference: providerTxnId || txn.provider_reference,
      completed_at: new Date().toISOString(),
    }).eq("id", txn.id).eq("status", "pending").select("id");

    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({ received: true, status: "already_resolved" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (txn.type === "collection") {
      const { data: wallet } = await supabaseAdmin.from("merchant_wallets")
        .select("id, available_balance, total_collections").eq("user_id", txn.user_id).maybeSingle();
      if (wallet) {
        await supabaseAdmin.from("merchant_wallets").update({
          available_balance: Number(wallet.available_balance || 0) + finalNet,
          total_collections: Number(wallet.total_collections || 0) + finalNet,
          updated_at: new Date().toISOString(),
        }).eq("user_id", txn.user_id);
      } else {
        await supabaseAdmin.from("merchant_wallets").insert({
          user_id: txn.user_id, currency: txn.currency || "UGX",
          available_balance: finalNet, pending_balance: 0,
          total_collections: finalNet, total_payouts: 0,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
      }
      await supabaseAdmin.from("notifications").insert({
        user_id: txn.user_id, type: "payment_received", title: "Payment Received",
        message: `${finalNet.toLocaleString()} ${txn.currency || "UGX"} from ${txn.customer_phone || "customer"}. Ref: ${txn.reference}`,
      }).then(() => {}, () => {});
    }

    await supabaseAdmin.from("incoming_webhooks").update({ processed: true }).eq("event_id", eventId).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, status: "success", credited: txn.type === "collection", transaction_id: txn.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isFailed) {
    const { data: updatedRows } = await supabaseAdmin.from("transactions").update({
      status: "failed", completed_at: new Date().toISOString(),
    }).eq("id", txn.id).eq("status", "pending").select("id");

    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({ received: true, status: "already_resolved" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (txn.type === "payout") {
      const refundAmount = Number(txn.amount) + (feeAmount || 0);
      const { data: wallet } = await supabaseAdmin.from("merchant_wallets")
        .select("available_balance").eq("user_id", txn.user_id).maybeSingle();
      if (wallet && refundAmount > 0) {
        await supabaseAdmin.from("merchant_wallets").update({
          available_balance: Number(wallet.available_balance) + refundAmount,
          updated_at: new Date().toISOString(),
        }).eq("user_id", txn.user_id);
      }
    }

    await supabaseAdmin.from("incoming_webhooks").update({ processed: true }).eq("event_id", eventId).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, status: "failed", transaction_id: txn.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true, status: "acknowledged", transaction_id: txn.id }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
