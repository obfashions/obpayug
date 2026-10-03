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
  const balances: any[] = (rows ?? []).map((row: any) => ({
    currency: row.currency,
    available_balance: Number(row.available_balance) || 0,
    pending_balance: Number(row.pending_balance) || 0,
    collected: Number(row.total_collections) || 0,
    paid_out: Number(row.total_payouts) || 0,
  }));
  // The merchant's main wallet (dashboard balance) is part of the same spendable
  // money — add it exactly like the dashboard does so API and dashboard agree.
  try {
    const [{ data: wallet }, { data: profile }] = await Promise.all([
      db().from("merchant_wallets").select("available_balance, balances_by_currency").eq("user_id", merchantId).maybeSingle(),
      db().from("profiles").select("default_currency").eq("id", merchantId).maybeSingle(),
    ]);
    if (wallet) {
      const walletBalances: Record<string, number> = { ...((wallet.balances_by_currency as any) || {}) };
      const legacyCurrency = String(profile?.default_currency || "UGX").toUpperCase();
      if (wallet.available_balance != null) {
        walletBalances[legacyCurrency] = Math.max(Number(walletBalances[legacyCurrency]) || 0, Number(wallet.available_balance) || 0);
      }
      for (const [cur, amt] of Object.entries(walletBalances)) {
        const value = Number(amt) || 0;
        if (!value) continue;
        const code = cur.toUpperCase();
        const row = balances.find((b) => b.currency === code);
        if (row) row.available_balance += value;
        else balances.push({ currency: code, available_balance: value, pending_balance: 0, collected: 0, paid_out: 0 });
      }
    }
  } catch {
    /* fall back to managed balance only */
  }
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

// ─── shared input helpers ─────────────────────────────────────

function pick(body: Record<string, any>, ...keys: string[]): string {
  const c = body.customer && typeof body.customer === "object" ? body.customer : {};
  for (const k of keys) {
    const v = body[k] ?? c[k.replace(/^customer_/, "")];
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function callbackFrom(body: Record<string, any>): Promise<{ url: string | null; error?: string }> {
  const raw = String(body.callback_url || body.callbackUrl || "").trim();
  if (!raw) return { url: null };
  const { isSafeWebhookUrl } = await import("./platform.server");
  if (!isSafeWebhookUrl(raw)) return { url: null, error: "`callback_url` must be a public https:// address." };
  return { url: raw };
}

function merchantMeta(body: Record<string, any>) {
  return body.metadata && typeof body.metadata === "object" ? body.metadata : null;
}

// ─── collections ──────────────────────────────────────────────

export async function apiCollect(merchantId: string, body: Record<string, any>, source = "api") {
  const { getGatewayCreds, gatewayCollect, walletNumber, networkCode, friendlyError, callbackUrl } = await import(
    "./gateway.server"
  );
  const creds = await getGatewayCreds();
  if (!creds) return err("Payments are temporarily unavailable.");

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  if (!["UGX", "KES", "RWF", "USD"].includes(currency)) return err("`currency` must be one of UGX, KES, RWF or USD.");
  const crypto = body.crypto === true || body.payment_method === "crypto" || currency === "USD";
  const customerName = pick(body, "customer_name", "customerName", "customer_name");
  const customerEmail = pick(body, "customer_email", "customerEmail");
  const cb = await callbackFrom(body);
  if (cb.error) return err(cb.error);
  if (!customerName) return err("`customer_name` is required.");
  if (!/^\S+@\S+\.\S+$/.test(customerEmail)) return err("`customer_email` must be a valid email address.");
  const { intlPhone, countryFor } = await import("./countries");
  const rawPhone = pick(body, "phone_number", "phoneNumber", "customer_phone");
  const phone = currency === "USD" ? "" : currency === "UGX" ? walletNumber(rawPhone) : intlPhone(rawPhone, currency);
  if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be greater than zero.");
  if (currency !== "USD" && !Number.isInteger(amount)) return err("`amount` must be a whole number.");
  if (currency === "USD" && amount < 0.5) return err("The minimum crypto/USD payment is 0.50.");
  if (currency !== "USD" && !phone) return err(`\`phone_number\` must be a ${countryFor(currency)?.country} mobile money number, e.g. ${countryFor(currency)?.example}.`);

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
    if (existing.merchant_id !== merchantId) return err("That reference is not available. Use a different one.");
    // Retried request (double click, network retry): answer with the existing
    // payment's current state instead of an error, so integrations stay idempotent.
    const current = await apiTransaction(merchantId, reference);
    const rec: any = (current as any).data || {};
    return ok({
      reference,
      duplicate: true,
      message: "This reference was already submitted. Returning its current status.",
      checkout_url: rec.metadata?.checkout_url || null,
      amount: Number(rec.amount) || amount,
      currency: rec.currency || currency,
      status: rec.status || "pending",
      type: "collection",
    });
  }

  const { merchantTag } = await import("./merchant-identity.server");
  const out = await gatewayCollect(creds, {
    merchant: await merchantTag(merchantId),
    channel: `${source}_collection`,
    currency,
    crypto,
    network: String(body.network || ""),
    reference,
    amount,
    customerName,
    customerEmail,
    phone,
    bankCode: networkCode(body.network || body.payment_method, phone),
    description: String(body.description || reference),
    redirectUrl: body.redirect_url || body.redirectUrl || undefined,
    notifyUrl: callbackUrl(),
  });

  if (!out.ok) {
    await recordPayment(merchantId, {
      reference,
      type: "collection",
      source,
      amount,
      currency,
      status: "failed",
      phone_number: phone,
      description: body.description || null,
      metadata: { merchant_metadata: merchantMeta(body) },
    });
    return err(friendlyError(out.res, "collection"));
  }

  await recordPayment(merchantId, {
    reference,
    provider_reference: out.platformReference,
    type: "collection",
    source,
    amount,
    currency,
    status: "pending",
    phone_number: phone,
    description: body.description || null,
    metadata: { merchant_metadata: merchantMeta(body), callback_url: cb.url, checkout_url: out.checkoutUrl },
  });

  return ok({
    reference,
    prompt_sent: out.promptSent,
    message: out.promptSent
      ? "A PIN prompt was sent to the customer's phone. They approve it to complete the payment."
      : "Send the customer to checkout_url to complete the payment.",
    checkout_url: out.checkoutUrl || null,
    crypto_payment_url: out.cryptoUrl || null,
    callback_url: cb.url,
    amount,
    currency,
    status: "pending",
    type: "collection",
  });
}

// ─── payouts (send money) ─────────────────────────────────────

export async function apiPayout(merchantId: string, body: Record<string, any>, source = "api") {
  const { getGatewayCreds, gatewayPayout, walletNumber, networkCode, friendlyError, callbackUrl, UG_BANKS } =
    await import("./gateway.server");
  const creds = await getGatewayCreds();
  if (!creds) return err("Payouts are temporarily unavailable.");

  const amount = Number(body.amount);
  const currency = String(body.currency || "UGX").toUpperCase();
  if (!["UGX", "KES", "RWF"].includes(currency)) return err("`currency` must be one of UGX, KES or RWF.");
  if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be greater than zero.");
  if (!Number.isInteger(amount)) return err("`amount` must be a whole number.");

  if (body.bank_code || body.bankCode) {
    return err("Bank payouts are not available yet. Send to an MTN or Airtel mobile money number.");
  }
  const cb = await callbackFrom(body);
  if (cb.error) return err(cb.error);
  const isBank = false;
  const { intlPhone, countryFor } = await import("./countries");
  const rawAcct = pick(body, "phone_number", "phoneNumber", "account_number");
  const accountNumber = currency === "UGX" ? walletNumber(rawAcct) : intlPhone(rawAcct, currency);
  if (!accountNumber) return err(`\`phone_number\` must be a ${countryFor(currency)?.country} mobile money number, e.g. ${countryFor(currency)?.example}.`);
  const recipientName = pick(body, "customer_name", "customerName", "recipient_name");
  if (!recipientName) return err("`customer_name` is required for every payout.");
  const recipientEmail = pick(body, "customer_email", "customerEmail");
  if (recipientEmail && !/^\S+@\S+\.\S+$/.test(recipientEmail)) return err("`customer_email` must be a valid email address.");

  const reference = String(body.reference || `OBW${Date.now().toString(36).toUpperCase()}`).slice(0, 40);
  const { data: existing, error: lookupError } = await db()
    .from("payment_records")
    .select("merchant_id, type, status, amount, currency, phone_number, provider_reference")
    .eq("reference", reference)
    .maybeSingle();
  if (lookupError) return err("Could not check this payout reference. No new payout was sent; please try again later.");
  if (existing) {
    if (existing.merchant_id !== merchantId) return err("That reference is not available. Use a different one.");
    if (existing.type !== "payout" || Number(existing.amount) !== amount || existing.currency !== currency || existing.phone_number !== accountNumber) {
      return err("This reference belongs to a different payment. Use a new reference for this payout.");
    }
    if (existing.status === "failed") return err("That payout failed previously. Use a new reference to submit a new payout.");
    // A request without a partner reference may not have reached the partner.
    // Never report it as sent or submit it again automatically.
    if (!existing.provider_reference) return err(`This payout's submission could not be confirmed. Do not retry it with a new reference until support checks reference ${reference} with the payment network.`);
    // A real previously-submitted payout: return its current state, not a new request.
    const current = await apiTransaction(merchantId, reference);
    if (!current.success) return current;
    const rec: any = (current as any).data || {};
    if (rec.status === "failed") return err("That payout failed previously. Use a new reference to submit a new payout.");
    return ok({
      reference,
      duplicate: true,
      message: "This payout was already submitted. Returning its current status; no new payout was sent.",
      amount: Number(rec.amount),
      currency: rec.currency,
      status: rec.status || "pending",
      type: "payout",
    });
  }

  // Only pay out money the merchant has actually collected through ObPay.
  const balance: any = await apiBalance(merchantId);
  const row = (balance?.data?.balances || []).find((b: any) => b.currency === currency);
  const available = Number(row?.available_balance ?? 0);
  if (Number.isFinite(available) && amount > available) {
    return err(`Insufficient balance. Available: ${available.toLocaleString()} ${currency}.`);
  }

  // Reserve the unique reference before the money-moving request. Concurrent
  // submissions must not both reach the partner, and a missing record must not
  // make a timed-out request safe to repeat.
  const { error: reservationError } = await db().from("payment_records").insert({
    merchant_id: merchantId, reference, type: "payout", source, amount, currency,
    status: "pending", phone_number: accountNumber, description: body.description || null,
    metadata: { submission_state: "submitting" },
  });
  if (reservationError) return err("Could not reserve this payout reference. No payout was sent. Check its status before trying again.");

  const { merchantTag } = await import("./merchant-identity.server");
  const out = await gatewayPayout(creds, {
    merchant: await merchantTag(merchantId),
    channel: `${source}_payout`,
    currency,
    network: String(body.network || ""),
    feeInclusive: true,
    reference,
    amount,
    typeTrans: isBank ? 3 : 2,
    bankCode: networkCode(body.network, accountNumber),
    accountNumber,
    customerName: recipientName || "ObPay recipient",
    ...(isBank ? {} : { customerPhone: accountNumber }),
    ...(recipientEmail ? { customerEmail: recipientEmail } : {}),
    remark: String(body.description || reference),
    notifyUrl: callbackUrl(),
  });

  if (!out.ok) {
    // A timeout or server error does not prove that the partner rejected the
    // payout. Leave the reservation pending for manual reconciliation instead
    // of inviting a retry that might pay the recipient twice.
    if (!out.res || out.res.httpStatus === 0 || out.res.httpStatus >= 500) {
      console.error("Payout submission status uncertain", reference, out.res?.httpStatus);
      return err(`We could not confirm whether this payout reached the payment network. Do not retry until support checks reference ${reference}.`);
    }
    const failed = await recordPayment(merchantId, {
      reference,
      type: "payout",
      source,
      amount,
      currency,
      status: "failed",
      phone_number: accountNumber,
      description: body.description || null,
      metadata: { submission_state: "rejected", reason: friendlyError(out.res, "payout") },
    });
    if (!failed) console.error("Payout rejection could not be recorded", reference);
    return err(friendlyError(out.res, "payout"));
  }

  if (!out.platformReference) {
    console.error("Partner accepted payout without a reference", reference);
    return err(`The payment network did not return a tracking reference. Do not retry until support checks reference ${reference}.`);
  }

  const saved = await recordPayment(merchantId, {
    reference,
    provider_reference: out.platformReference,
    type: "payout",
    source,
    amount,
    currency,
    status: "pending",
    phone_number: accountNumber,
    description: body.description || null,
    fee_amount: out.partnerFee,
    net_amount: out.net,
    metadata: { submission_state: "accepted", merchant_metadata: merchantMeta(body), callback_url: cb.url, recipient_name: recipientName, fee_inclusive: true, fee: out.partnerFee, recipient_gets: out.net },
  });
  if (!saved) {
    console.error("Partner accepted payout but record update failed", reference);
    return err(`Your payout was accepted but its status could not be saved. Do not retry. Contact support with reference ${reference}.`);
  }

  return ok({
    reference,
    provider_reference: out.platformReference,
    callback_url: cb.url,
    amount,
    fee: out.partnerFee,
    recipient_gets: out.net,
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
