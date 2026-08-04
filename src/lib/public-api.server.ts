// Server-only implementation of the public ObPay merchant API (v1).
// Authenticated with a merchant secret key; everything it touches lives in
// ObPay's own managed storage.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { merchantForSecret, recordPayment, dispatchWebhook } from "./platform.server";

export { merchantForSecret };

const db = () => supabaseAdmin as any;

function marzCountry(currency: string): string {
  const c = String(currency || "UGX").toUpperCase();
  const map: Record<string, string> = { UGX: "UG", KES: "KE", TZS: "TZ", GHS: "GH", XAF: "CM" };
  return map[c] || "UG";
}

export async function apiCollect(merchantId: string, body: Record<string, any>) {
  const { readMarzCreds, marzFetch, normalizePhone } = await import("./marz.server");
  const creds = readMarzCreds();
  if (!creds) return { success: false, error: "Payments are temporarily unavailable." };

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  const phone = normalizePhone(body.phone_number ?? body.phoneNumber, currency);
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "`amount` must be greater than zero." };
  if (!phone) return { success: false, error: "`phone_number` is required." };

  const reference = String(body.reference || `OBP${Date.now().toString(36).toUpperCase()}`).slice(0, 40);
  // `reference` is globally unique (payment_records upserts on it), so the
  // check must be global too — otherwise one merchant's reference could
  // overwrite another's record. The message stays neutral so it cannot be
  // used to probe other merchants' references.
  const { data: existing } = await db()
    .from("payment_records")
    .select("merchant_id")
    .eq("reference", reference)
    .maybeSingle();
  if (existing) {
    return existing.merchant_id === merchantId
      ? { success: false, error: `Reference "${reference}" has already been used.` }
      : { success: false, error: "That reference is not available. Use a different one." };
  }


  // MarzPay requires a UUID reference; keep the merchant's reference locally.
  const marzRef = crypto.randomUUID();
  const res = await marzFetch(creds, "/collect-money", {
    method: "POST",
    body: {
      amount: Math.round(amount),
      phone_number: phone,
      method: "mobile_money",
      country: marzCountry(currency),
      reference: marzRef,
      description: String(body.description || "ObPay collection").slice(0, 255),
    },
  });

  if (!res.ok) {
    await recordPayment(merchantId, {
      reference,
      type: "collection",
      source: "api",
      amount,
      currency,
      status: "failed",
      phone_number: phone,
      description: body.description || null,
    });
    return { success: false, error: res.error || "The collection could not be started." };
  }

  const providerRef = res.data?.data?.transaction?.reference || marzRef;
  await recordPayment(merchantId, {
    reference,
    provider_reference: providerRef,
    type: "collection",
    source: "api",
    amount,
    currency,
    status: "pending",
    phone_number: phone,
    description: body.description || null,
  });

  return {
    success: true,
    data: { reference, provider_reference: providerRef, amount, currency, status: "pending" },
  };
}

export async function apiTransaction(merchantId: string, reference: string) {
  const { data: record } = await db()
    .from("payment_records")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("reference", reference)
    .maybeSingle();
  if (!record) return { success: false, error: "No transaction with that reference." };
  if (record.status !== "pending") return { success: true, data: record };

  const { readMarzCreds, marzFetch } = await import("./marz.server");
  const creds = readMarzCreds();
  if (creds) {
    const res = await marzFetch(creds, `/transactions/${encodeURIComponent(record.provider_reference || reference)}`);
    const raw = String(res.data?.data?.transaction?.status || "").toLowerCase();
    const next = ["success", "successful", "completed", "complete"].includes(raw)
      ? "success"
      : ["failed", "cancelled", "canceled", "rejected", "expired"].includes(raw)
        ? "failed"
        : null;
    if (next) {
      await db()
        .from("payment_records")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", record.id);
      await dispatchWebhook(merchantId, next === "success" ? "collection.success" : "collection.failed", {
        reference,
        amount: record.amount,
        currency: record.currency,
        phone_number: record.phone_number,
      });
      const { notifySettlement } = await import("./notify.server");
      await notifySettlement({
        merchantId,
        reference,
        type: record.type || "collection",
        amount: record.amount,
        currency: record.currency,
        status: next,
        phone_number: record.phone_number,
        description: record.description,
        source: "api",
      });
      return { success: true, data: { ...record, status: next } };

    }
  }
  return { success: true, data: record };
}

export async function apiPayments(merchantId: string) {
  const { data } = await db()
    .from("payment_records")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(100);
  return { success: true, data: data ?? [] };
}
