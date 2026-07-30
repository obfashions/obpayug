
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
    return new Response(JSON.stringify({ status: "ok", message: "JulyPay Webhook v5.1 — ready", timestamp: new Date().toISOString() }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ received: false, error: "Method not allowed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let bodyText: string;
  try { bodyText = await req.text(); } catch {
    return new Response(JSON.stringify({ received: false, error: "Failed to read body" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  
  console.log("[JulyPay-v5.1] RAW:", bodyText.slice(0, 2000));

  let rawPayload: any;
  try { rawPayload = JSON.parse(bodyText); } catch {
    console.error("[JulyPay-v5.1] Invalid JSON");
    return new Response(JSON.stringify({ received: false, error: "Invalid JSON" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const eventId = String(rawPayload?.id || rawPayload?.event_id || crypto.randomUUID());
  const eventType = String(rawPayload?.type || rawPayload?.event || rawPayload?.event_type || "");
  const eventData = rawPayload?.data || rawPayload?.payload || rawPayload?.transaction || rawPayload?.body || rawPayload;
  const status = String(eventData?.status || eventData?.state || "").toLowerCase().trim();
  const amount = parseFloat(String(eventData?.amount || eventData?.gross_amount || "0")) || 0;
  const feeAmount = parseFloat(String(eventData?.fee_amount || eventData?.collection_fee || eventData?.charge || "0")) || 0;
  const providerTxnId = String(eventData?.id || eventData?.transaction_id || eventData?.provider_id || eventData?.txn_id || eventData?.payment_id || "");
  const externalRef = String(eventData?.external_reference || eventData?.merchant_reference || eventData?.reference || eventData?.ref || "");
  const webhookPhone = String(eventData?.customer_phone || eventData?.phone || eventData?.phone_number || "");

  console.log(`[JulyPay-v5.1] eventType="${eventType}" status="${status}" amount=${amount} providerTxnId="${providerTxnId}" extRef="${externalRef}"`);

  const skipSet = new Set(["transaction.created", "transaction.pending", "payment.initiated", "collection.initiated"]);
  if (skipSet.has(eventType)) {
    await supabaseAdmin.from("incoming_webhooks").insert({
      event_id: eventId, event_type: eventType, created_epoch: Date.now(),
      payload: rawPayload, processed: true, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, status: "acknowledged", note: "intermediate event" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const successSet = new Set(["success", "successful", "completed", "done", "paid", "settled", "confirmed"]);
  const failedSet = new Set(["failed", "failure", "error", "declined", "rejected", "cancelled", "canceled", "expired"]);
  const isSuccess = successSet.has(status) || eventType.includes(".success") || eventType.includes(".completed");
  const isFailed = failedSet.has(status) || eventType.includes(".failed") || eventType.includes(".rejected") || eventType.includes(".declined");

  if (!isSuccess && !isFailed) {
    await supabaseAdmin.from("incoming_webhooks").insert({
      event_id: eventId, event_type: eventType, created_epoch: Date.now(),
      payload: rawPayload, processed: true, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, status: "acknowledged", note: "unknown outcome" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let txn: any = null;
  if (providerTxnId) {
    const { data } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, fee_amount")
      .eq("provider_reference", providerTxnId).maybeSingle();
    if (data) txn = data;
  }
  if (!txn && externalRef) {
    let { data } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, fee_amount")
      .eq("reference", externalRef).maybeSingle();
    if (data) txn = data;
    if (!txn) {
      const { data: d2 } = await supabaseAdmin.from("transactions")
        .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, fee_amount")
        .eq("merchant_reference", externalRef).maybeSingle();
      if (d2) txn = d2;
    }
  }
  if (!txn && amount > 0 && webhookPhone) {
    const { data: candidates } = await supabaseAdmin.from("transactions")
      .select("id, user_id, amount, currency, status, type, reference, provider_reference, customer_phone, fee_amount")
      .eq("customer_phone", webhookPhone).eq("status", "pending").eq("type", "collection")
      .order("created_at", { ascending: false }).limit(5);
    if (candidates) txn = candidates.find((c: any) => Math.abs(Number(c.amount) - amount) < 1) || null;
  }

  if (!txn) {
    console.warn(`[JulyPay-v5.1] No match. providerTxnId="${providerTxnId}" extRef="${externalRef}"`);
    await supabaseAdmin.from("incoming_webhooks").insert({
      event_id: eventId, event_type: eventType, created_epoch: Date.now(),
      payload: rawPayload, processed: true, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, warning: "No matching transaction" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (txn.status !== "pending") {
    await supabaseAdmin.from("incoming_webhooks").insert({
      event_id: eventId, event_type: eventType, created_epoch: Date.now(),
      payload: rawPayload, processed: true, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, message: `Already ${txn.status}`, transaction_id: txn.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isSuccess) {
    const gross = Number(txn.amount);
    const finalFee = feeAmount || Number(txn.fee_amount || 0);
    const finalNet = gross - finalFee;

    const { data: updated } = await supabaseAdmin.from("transactions").update({
      status: "success", fee_amount: finalFee, net_amount: finalNet,
      provider_reference: providerTxnId || txn.provider_reference,
      completed_at: new Date().toISOString(),
    }).eq("id", txn.id).eq("status", "pending").select("id");

    if (!updated || updated.length === 0) {
      await supabaseAdmin.from("incoming_webhooks").insert({
        event_id: eventId, event_type: eventType, created_epoch: Date.now(),
        payload: rawPayload, processed: true, created_at: new Date().toISOString(),
      }).then(() => {}, () => {});
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
        message: `${finalNet.toLocaleString()} ${txn.currency || "UGX"} confirmed. Ref: ${txn.reference}`,
      }).then(() => {}, () => {});
    }

    await supabaseAdmin.from("incoming_webhooks").insert({
      event_id: eventId, event_type: eventType, created_epoch: Date.now(),
      payload: rawPayload, processed: true, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, status: "success", credited: txn.type === "collection", transaction_id: txn.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (isFailed) {
    const { data: updated } = await supabaseAdmin.from("transactions").update({
      status: "failed", completed_at: new Date().toISOString(),
    }).eq("id", txn.id).eq("status", "pending").select("id");

    if (txn.type === "payout" && updated && updated.length > 0) {
      await supabaseAdmin.from("merchant_wallets").update({
        available_balance: supabaseAdmin.rpc ? undefined : undefined,
      }).eq("user_id", txn.user_id);
    }

    await supabaseAdmin.from("incoming_webhooks").insert({
      event_id: eventId, event_type: eventType, created_epoch: Date.now(),
      payload: rawPayload, processed: true, created_at: new Date().toISOString(),
    }).then(() => {}, () => {});
    return new Response(JSON.stringify({ received: true, status: "failed", transaction_id: txn.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabaseAdmin.from("incoming_webhooks").insert({
    event_id: eventId, event_type: eventType, created_epoch: Date.now(),
    payload: rawPayload, processed: true, created_at: new Date().toISOString(),
  }).then(() => {}, () => {});
  return new Response(JSON.stringify({ received: true, status: "acknowledged", transaction_id: txn.id }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
