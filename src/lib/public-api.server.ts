// Server-only implementation of the public ObPay merchant API (v1).
// Authenticated with a merchant secret key; everything it touches lives in
// ObPay's own managed storage.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  merchantForSecret,
  recordPayment,
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


function ok(data: unknown) {
  return { success: true, data };
}
function err(message: string) {
  return { success: false, error: message };
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
  const { refreshMerchantPendingPayments } = await import("./settle.server");
  await refreshMerchantPendingPayments(merchantId);
  const { data: rows, error } = await db()
    .from("merchant_balances")
    .select("currency, available_balance, pending_balance, total_collections, total_payouts")
    .eq("merchant_id", merchantId)
    .order("currency");
  if (error) return err("Balance is temporarily unavailable.");
  const balances = (rows ?? []).map((row: any) => ({
    currency: row.currency,
    available_balance: Number(row.available_balance) || 0,
    pending_balance: Number(row.pending_balance) || 0,
    collected: Number(row.total_collections) || 0,
    paid_out: Number(row.total_payouts) || 0,
  }));
  const primary = balances.find((row: any) => row.currency === "UGX") || balances[0];
  return ok({
    currency: primary?.currency || "UGX",
    available_balance: primary?.available_balance || 0,
    pending_balance: primary?.pending_balance || 0,
    collected: primary?.collected || 0,
    paid_out: primary?.paid_out || 0,
    net: primary?.available_balance || 0,
    balances,
  });
}

// ─── collections ──────────────────────────────────────────────

export async function apiCollect(merchantId: string, body: Record<string, any>) {
  const { getGatewayCreds, gatewayCollect, walletNumber, networkCode, friendlyError, callbackUrl } = await import(
    "./gateway.server"
  );
  const creds = await getGatewayCreds();
  if (!creds) return err("Payments are temporarily unavailable.");

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  if (currency !== "UGX") return err("`currency` must be `UGX`.");
  const customerName = String(body.customer_name || body.customerName || "").trim();
  const customerEmail = String(body.customer_email || body.customerEmail || "").trim();
  if (!customerName) return err("`customer_name` is required.");
  if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return err("`customer_email` must be a valid email address.");
  const phone = walletNumber(body.phone_number ?? body.phoneNumber);
  if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be greater than zero.");
  if (!Number.isInteger(amount)) return err("`amount` must be a whole number.");
  if (!phone) return err("`phone_number` must be a Ugandan mobile money number, e.g. 0772123456.");

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

  const out = await gatewayCollect(creds, {
    reference,
    amount,
    customerName,
    customerEmail,
    phone,
    bankCode: networkCode(body.network || body.payment_method, phone),
    description: String(body.description || "ObPay collection"),
    redirectUrl: body.redirect_url || body.redirectUrl || undefined,
    notifyUrl: callbackUrl(),
  });

  if (!out.ok) {
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
    return err(friendlyError(out.res, "collection"));
  }

  await recordPayment(merchantId, {
    reference,
    provider_reference: out.platformReference,
    type: "collection",
    source: "api",
    amount,
    currency,
    status: "pending",
    phone_number: phone,
    description: body.description || null,
    metadata: {
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      checkout_url: out.checkoutUrl,
    },
  });

  return ok({
    reference,
    provider_reference: out.platformReference,
    checkout_url: out.checkoutUrl,
    amount,
    currency,
    status: "pending",
    type: "collection",
  });
}

// ─── payouts (send money) ─────────────────────────────────────

export async function apiPayout(merchantId: string, body: Record<string, any>) {
  const { getGatewayCreds, gatewayPayout, walletNumber, networkCode, friendlyError, callbackUrl, UG_BANKS } =
    await import("./gateway.server");
  const creds = await getGatewayCreds();
  if (!creds) return err("Payouts are temporarily unavailable.");

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  if (currency !== "UGX") return err("`currency` must be `UGX`.");
  if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be greater than zero.");
  if (!Number.isInteger(amount)) return err("`amount` must be a whole number.");

  // Bank payout when a bank_code is supplied, mobile money otherwise.
  const rawBankCode = String(body.bank_code || body.bankCode || "").toUpperCase();
  const isBank = UG_BANKS.some((b) => b.code === rawBankCode);
  if (rawBankCode && !isBank && !["UG0030", "UG0031"].includes(rawBankCode)) {
    return err("`bank_code` is not a supported Ugandan bank or mobile money code.");
  }
  const accountNumber = isBank
    ? String(body.account_number || body.accountNumber || "").replace(/\s/g, "")
    : walletNumber(body.phone_number ?? body.phoneNumber ?? body.account_number);

  if (isBank && !/^\d+$/.test(accountNumber)) return err("`account_number` must contain digits only for bank payouts.");
  if (!isBank && !accountNumber) {
    return err("`phone_number` must be a Ugandan mobile money number, e.g. 0772123456.");
  }
  const recipientName = String(body.customer_name || body.customerName || body.recipient_name || "").trim();
  if (!recipientName) return err("`customer_name` is required for every payout.");
  const recipientEmail = String(body.customer_email || body.customerEmail || "").trim();
  if (recipientEmail && !/^\S+@\S+\.\S+$/.test(recipientEmail)) return err("`customer_email` must be a valid email address.");

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

  const out = await gatewayPayout(creds, {
    reference,
    amount,
    typeTrans: isBank ? 3 : 2,
    bankCode: isBank ? rawBankCode : networkCode(body.network, accountNumber),
    accountNumber,
    customerName: recipientName || "ObPay recipient",
    ...(isBank ? {} : { customerPhone: accountNumber }),
    ...(recipientEmail ? { customerEmail: recipientEmail } : {}),
    remark: String(body.description || "ObPay payout"),
    notifyUrl: callbackUrl(),
  });

  if (!out.ok) {
    await recordPayment(merchantId, {
      reference,
      type: "payout",
      source: "api",
      amount,
      currency,
      status: "failed",
      phone_number: accountNumber,
      description: body.description || null,
    });
    return err(friendlyError(out.res, "payout"));
  }

  await recordPayment(merchantId, {
    reference,
    provider_reference: out.platformReference,
    type: "payout",
    source: "api",
    amount,
    currency,
    status: "pending",
    phone_number: accountNumber,
    description: body.description || null,
  });

  return ok({
    reference,
    provider_reference: out.platformReference,
    amount,
    currency,
    status: "pending",
    type: "payout",
  });
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
