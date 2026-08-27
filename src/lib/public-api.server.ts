// Server-only implementation of the public ObPay merchant API (v1).
// Authenticated with a merchant secret key; everything it touches lives in
// ObPay's own managed storage.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  merchantForSecret,
  recordPayment,
  dispatchWebhook,
  listPaymentLinks,
  createPaymentLink,
  updatePaymentLink,
  deletePaymentLink,
  listWebhooks,
  createWebhook,
  deleteWebhook,
  testWebhook,
  listWebhookDeliveries,
} from "./platform.server";
import type { Identity } from "./identity.server";

export { merchantForSecret };

const db = () => supabaseAdmin as any;

/** API keys authenticate a merchant directly; no dashboard session involved. */
function identityFor(merchantId: string): Identity {
  return { userId: merchantId, email: "", isAdmin: false };
}

function marzCountry(currency: string): string {
  const c = String(currency || "UGX").toUpperCase();
  const map: Record<string, string> = { UGX: "UG", KES: "KE", TZS: "TZ", GHS: "GH", XAF: "CM" };
  return map[c] || "UG";
}

function ok(data: unknown) {
  return { success: true, data };
}
function err(message: string) {
  return { success: false, error: message };
}

function normalizeStatus(raw: string): "pending" | "success" | "failed" | null {
  const s = String(raw || "").toLowerCase();
  if (["success", "successful", "completed", "complete", "paid"].includes(s)) return "success";
  if (["failed", "cancelled", "canceled", "rejected", "expired", "reversed"].includes(s)) return "failed";
  if (["pending", "processing", "initiated"].includes(s)) return "pending";
  return null;
}

// ─── account ──────────────────────────────────────────────────

export async function apiPing(merchantId: string) {
  return ok({ merchant_id: merchantId, live: true, time: new Date().toISOString() });
}

export async function apiAccount(merchantId: string) {
  const [{ count: txCount }, { count: linkCount }, { count: hookCount }] = await Promise.all([
    db().from("payment_records").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
    db().from("payment_links").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
    db().from("webhook_endpoints").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId),
  ]);
  return ok({
    merchant_id: merchantId,
    transactions: txCount ?? 0,
    payment_links: linkCount ?? 0,
    webhook_endpoints: hookCount ?? 0,
  });
}

export async function apiBalance(merchantId: string) {
  const { runMarzAction } = await import("./marz.server");
  const res = await runMarzAction("balance", {});
  if (!res.success) return err(res.error || "Balance is temporarily unavailable.");
  const { data: rows } = await db()
    .from("payment_records")
    .select("type, amount, status")
    .eq("merchant_id", merchantId)
    .eq("status", "success");
  let collected = 0;
  let paid = 0;
  for (const r of rows ?? []) {
    if (r.type === "collection") collected += Number(r.amount) || 0;
    else paid += Number(r.amount) || 0;
  }
  return ok({
    currency: "UGX",
    collected,
    paid_out: paid,
    net: collected - paid,
    provider_balance: (res.data as any)?.balance ?? null,
  });
}

// ─── collections ──────────────────────────────────────────────

export async function apiCollect(merchantId: string, body: Record<string, any>) {
  const { getMarzCreds, marzFetch, normalizePhone } = await import("./marz.server");
  const creds = await getMarzCreds();
  if (!creds) return err("Payments are temporarily unavailable.");

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  const phone = normalizePhone(body.phone_number ?? body.phoneNumber, currency);
  if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be greater than zero.");
  if (!phone) return err("`phone_number` is required.");

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
      ? err(`Reference "${reference}" has already been used.`)
      : err("That reference is not available. Use a different one.");
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
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });
    return err(res.error || "The collection could not be started.");
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
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  });

  return ok({ reference, provider_reference: providerRef, amount, currency, status: "pending", type: "collection" });
}

// ─── payouts (send money) ─────────────────────────────────────

export async function apiPayout(merchantId: string, body: Record<string, any>) {
  const { getMarzCreds, marzFetch, normalizePhone, isIpWhitelistError } = await import("./marz.server");
  const creds = await getMarzCreds();
  if (!creds) return err("Payouts are temporarily unavailable.");

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  const phone = normalizePhone(body.phone_number ?? body.phoneNumber, currency);
  if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be greater than zero.");
  if (!phone) return err("`phone_number` is required.");

  const reference = String(body.reference || `OBW${Date.now().toString(36).toUpperCase()}`).slice(0, 40);
  const { data: existing } = await db()
    .from("payment_records")
    .select("merchant_id")
    .eq("reference", reference)
    .maybeSingle();
  if (existing) {
    return existing.merchant_id === merchantId
      ? err(`Reference "${reference}" has already been used.`)
      : err("That reference is not available. Use a different one.");
  }

  // Only pay out money the merchant has actually collected through ObPay.
  const balance = await apiBalance(merchantId);
  const available = Number((balance as any)?.data?.net ?? 0);
  if (Number.isFinite(available) && amount > available) {
    return err(`Insufficient balance. Available: ${available.toLocaleString()} ${currency}.`);
  }

  const marzRef = crypto.randomUUID();
  const res = await marzFetch(creds, "/send-money", {
    method: "POST",
    body: {
      amount: Math.round(amount),
      phone_number: phone,
      method: "mobile_money",
      country: marzCountry(currency),
      reference: marzRef,
      description: String(body.description || "ObPay payout").slice(0, 255),
    },
  });

  if (!res.ok) {
    await recordPayment(merchantId, {
      reference,
      type: "payout",
      source: "api",
      amount,
      currency,
      status: "failed",
      phone_number: phone,
      description: body.description || null,
    });
    if (isIpWhitelistError(res)) {
      return err("Payouts are blocked by the provider's IP whitelist. Contact ObPay support.");
    }
    return err(res.error || "The payout could not be started.");
  }

  const providerRef = res.data?.data?.transaction?.reference || marzRef;
  await recordPayment(merchantId, {
    reference,
    provider_reference: providerRef,
    type: "payout",
    source: "api",
    amount,
    currency,
    status: "pending",
    phone_number: phone,
    description: body.description || null,
  });

  return ok({ reference, provider_reference: providerRef, amount, currency, status: "pending", type: "payout" });
}

// ─── transactions ─────────────────────────────────────────────

export async function apiTransaction(merchantId: string, reference: string) {
  const { data: record } = await db()
    .from("payment_records")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("reference", reference)
    .maybeSingle();
  if (!record) return err("No transaction with that reference.");
  if (record.status !== "pending") return ok(record);

  const { refreshPaymentRecord } = await import("./settle.server");
  return ok(await refreshPaymentRecord(record));
}

export async function apiTransactions(merchantId: string, query: URLSearchParams) {
  const limit = Math.min(Math.max(Number(query.get("limit") || 50) || 50, 1), 200);
  const page = Math.max(Number(query.get("page") || 1) || 1, 1);
  const from = (page - 1) * limit;

  let q = db()
    .from("payment_records")
    .select("*", { count: "exact" })
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .range(from, from + limit - 1);

  const status = query.get("status");
  const type = query.get("type");
  const since = query.get("from");
  const until = query.get("to");
  if (status) q = q.eq("status", status);
  if (type) q = q.eq("type", type);
  if (since) q = q.gte("created_at", since);
  if (until) q = q.lte("created_at", until);

  const { data, count, error } = await q;
  if (error) return err(error.message);
  return { success: true, data: data ?? [], meta: { page, limit, total: count ?? 0 } };
}

export async function apiPayments(merchantId: string) {
  const { data } = await db()
    .from("payment_records")
    .select("*")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ok(data ?? []);
}

// ─── payment links ────────────────────────────────────────────

export async function apiListLinks(merchantId: string) {
  return listPaymentLinks(identityFor(merchantId));
}

export async function apiCreateLink(merchantId: string, body: Record<string, any>) {
  const res: any = await createPaymentLink(identityFor(merchantId), body);
  if (res?.success && res.data?.slug) {
    res.data.url = `https://obpay.online/pay/${res.data.slug}`;
  }
  return res;
}

export async function apiUpdateLink(merchantId: string, linkId: string, body: Record<string, any>) {
  return updatePaymentLink(identityFor(merchantId), linkId, body);
}

export async function apiDeleteLink(merchantId: string, linkId: string) {
  return deletePaymentLink(identityFor(merchantId), linkId);
}

// ─── webhooks ─────────────────────────────────────────────────

export async function apiListWebhooks(merchantId: string) {
  return listWebhooks(identityFor(merchantId));
}

export async function apiCreateWebhook(merchantId: string, body: Record<string, any>) {
  return createWebhook(identityFor(merchantId), body);
}

export async function apiDeleteWebhook(merchantId: string, endpointId: string) {
  return deleteWebhook(identityFor(merchantId), endpointId);
}

export async function apiTestWebhook(merchantId: string, endpointId: string) {
  return testWebhook(identityFor(merchantId), endpointId);
}

export async function apiWebhookDeliveries(merchantId: string, limit = 50) {
  return listWebhookDeliveries(identityFor(merchantId), limit);
}
