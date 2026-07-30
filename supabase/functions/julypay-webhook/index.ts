import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-julypay-signature, x-julypay-event",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === "GET") return new Response(JSON.stringify({ status: "ok", message: "Provider webhook receiver is live" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  const bodyText = await req.text();
  let rawPayload: any;
  try { rawPayload = JSON.parse(bodyText); } catch { return new Response(JSON.stringify({ received: false, error: "Invalid JSON" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

  const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { autoRefreshToken: false, persistSession: false } });

  await supabaseAdmin.from("incoming_webhooks").insert({
    event_id: String(rawPayload?.id || crypto.randomUUID()),
    event_type: rawPayload?.type || rawPayload?.event || "unknown",
    created_epoch: Date.now(),
    payload: rawPayload,
    processed: false,
    created_at: new Date().toISOString(),
  }).then(() => {}, (e: any) => console.warn("[Provider-JWT] Failed to log:", e.message));

  const p = rawPayload?.data || rawPayload?.payload || rawPayload?.transaction || rawPayload?.body || rawPayload;
  const providerTxnId = String(p?.id || p?.transaction_id || p?.provider_id || p?.txn_id || p?.payment_id || "");
  const reference = String(p?.reference || p?.ref || p?.merchant_reference || p?.external_reference || "");
  const status = String(p?.status || p?.state || "").toLowerCase().trim();
  const eventType = String(rawPayload?.type || rawPayload?.event || rawPayload?.event_type || "");
  const amount = parseFloat(String(p?.amount || p?.gross_amount || "0")) || 0;
  const feeAmount = parseFloat(String(p?.fee_amount || p?.collection_fee || p?.charge || "0")) || 0;

  const SUCCESS = new Set(["success","successful","completed","done","paid","settled","confirmed"]);
  const FAILED = new Set(["failed","failure","error","declined","rejected","cancelled","expired"]);

  if (eventType === "transaction.created" || eventType === "transaction.pending") {
    return new Response(JSON.stringify({ received: true, status: "acknowledged" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let txn: any = null;
  if (providerTxnId) { const { data } = await supabaseAdmin.from("transactions").select("id,user_id,amount,currency,status,type,reference,provider_reference,fee_amount").eq("provider_reference", providerTxnId).maybeSingle(); if (data) txn = data; }
  if (!txn && reference) { const { data } = await supabaseAdmin.from("transactions").select("id,user_id,amount,currency,status,type,reference,provider_reference,fee_amount").or(`reference.eq.${reference},merchant_reference.eq.${reference}`).maybeSingle(); if (data) txn = data; }
  if (!txn) return new Response(JSON.stringify({ received: true, warning: "Txn not found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (txn.status !== "pending") return new Response(JSON.stringify({ received: true, message: "Already " + txn.status }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (SUCCESS.has(status)) {
    const gross = parseFloat(String(txn.amount));
    const finalFee = feeAmount || Number(txn.fee_amount || 0);
    const finalNet = gross - finalFee;

    // ATOMIC: only update if still pending
    const { data: updatedRows } = await supabaseAdmin.from("transactions").update({
      status: "success",
      fee_amount: finalFee,
      net_amount: finalNet,
      provider_reference: providerTxnId || txn.provider_reference,
      completed_at: new Date().toISOString(),
    }).eq("id", txn.id).eq("status", "pending").select("id");

    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({ received: true, status: "already_resolved", transaction_id: txn.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (txn.type === "collection") {
      const { data: w } = await supabaseAdmin.from("merchant_wallets").select("id,available_balance,total_collections").eq("user_id", txn.user_id).maybeSingle();
      if (w) await supabaseAdmin.from("merchant_wallets").update({ available_balance: Number(w.available_balance||0)+finalNet, total_collections: Number(w.total_collections||0)+finalNet, updated_at: new Date().toISOString() }).eq("user_id", txn.user_id);
      else await supabaseAdmin.from("merchant_wallets").insert({ user_id: txn.user_id, currency: txn.currency||"UGX", available_balance: finalNet, total_collections: finalNet, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }

    return new Response(JSON.stringify({ received: true, status: "success", credited: txn.type === "collection" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (FAILED.has(status)) {
    const { data: updatedRows } = await supabaseAdmin.from("transactions").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", txn.id).eq("status", "pending").select("id");
    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({ received: true, status: "already_resolved", transaction_id: txn.id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (txn.type === "payout") {
      const refundAmount = Number(txn.amount) + feeAmount;
      const { data: w } = await supabaseAdmin.from("merchant_wallets").select("available_balance").eq("user_id", txn.user_id).maybeSingle();
      if (w && refundAmount > 0) {
        await supabaseAdmin.from("merchant_wallets").update({ available_balance: Number(w.available_balance) + refundAmount, updated_at: new Date().toISOString() }).eq("user_id", txn.user_id);
      }
    }

    return new Response(JSON.stringify({ received: true, status: "failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ received: true, status: "acknowledged" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
