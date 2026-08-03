// Server-only data layer for everything ObPay now manages itself:
// API keys, payment links, webhooks, request logs, verification files and
// payment records. Merchant accounts and balances are untouched.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireIdentity, requireAdmin, type Identity } from "./identity.server";

const db = () => supabaseAdmin as any;

// ─── helpers ──────────────────────────────────────────────────

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(length = 32): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function slugify(input: string): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function fail(error: string) {
  return { success: false, error };
}
function done(data: unknown = null) {
  return { success: true, data };
}

// ─── API keys ─────────────────────────────────────────────────

export async function listApiKeys(id: Identity) {
  const { data, error } = await db()
    .from("merchant_api_keys")
    .select("id, name, environment, public_key, secret_prefix, secret_last4, status, last_used_at, created_at")
    .eq("merchant_id", id.userId)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message);
  return done(data ?? []);
}

export async function createApiKey(id: Identity, name: string, environment: string) {
  const env = environment === "sandbox" ? "sandbox" : "live";
  const publicKey = `pk_${env}_${randomToken(24)}`;
  const secretKey = `sk_${env}_${randomToken(32)}`;
  const { data, error } = await db()
    .from("merchant_api_keys")
    .insert({
      merchant_id: id.userId,
      name: name?.trim() || "Default key",
      environment: env,
      public_key: publicKey,
      secret_hash: await sha256(secretKey),
      secret_prefix: secretKey.slice(0, 11),
      secret_last4: secretKey.slice(-4),
    })
    .select("id, name, environment, public_key, secret_prefix, secret_last4, status, created_at")
    .single();
  if (error) return fail(error.message);
  return done({ ...data, secret_key: secretKey });
}

export async function revokeApiKey(id: Identity, keyId: string) {
  const { error } = await db()
    .from("merchant_api_keys")
    .update({ status: "revoked" })
    .eq("id", keyId)
    .eq("merchant_id", id.userId);
  if (error) return fail(error.message);
  return done();
}

export async function deleteApiKey(id: Identity, keyId: string) {
  const { error } = await db()
    .from("merchant_api_keys")
    .delete()
    .eq("id", keyId)
    .eq("merchant_id", id.userId);
  if (error) return fail(error.message);
  return done();
}

/** Resolves a raw `sk_...` secret to its owning merchant. Used by the public API. */
export async function merchantForSecret(secret: string): Promise<string | null> {
  const clean = String(secret || "").trim();
  if (!clean.startsWith("sk_")) return null;
  const { data } = await db()
    .from("merchant_api_keys")
    .select("id, merchant_id, status")
    .eq("secret_hash", await sha256(clean))
    .maybeSingle();
  if (!data || data.status !== "active") return null;
  await db().from("merchant_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data.merchant_id as string;
}

// ─── payment links ────────────────────────────────────────────

export async function listPaymentLinks(id: Identity) {
  const { data, error } = await db()
    .from("payment_links")
    .select("*")
    .eq("merchant_id", id.userId)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message);
  return done(data ?? []);
}

export async function createPaymentLink(id: Identity, body: Record<string, any>) {
  const title = String(body.title || "").trim();
  if (!title) return fail("Give the payment link a title.");
  const amount = body.amount === "" || body.amount == null ? null : Number(body.amount);
  if (amount != null && (!Number.isFinite(amount) || amount <= 0)) {
    return fail("Enter a valid amount, or leave it blank to let the payer choose.");
  }

  let slug = slugify(body.slug || title) || `link-${randomToken(6).toLowerCase()}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: taken } = await db().from("payment_links").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${slugify(title)}-${randomToken(4).toLowerCase()}`;
  }

  const { data, error } = await db()
    .from("payment_links")
    .insert({
      merchant_id: id.userId,
      slug,
      title,
      description: String(body.description || "").trim() || null,
      amount,
      currency: String(body.currency || "UGX").toUpperCase(),
      fixed_amount: amount != null,
      redirect_url: String(body.redirect_url || "").trim() || null,
    })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return done(data);
}

export async function updatePaymentLink(id: Identity, linkId: string, patch: Record<string, any>) {
  const allowed: Record<string, any> = { updated_at: new Date().toISOString() };
  if (patch.status) allowed.status = patch.status === "active" ? "active" : "paused";
  if (patch.title) allowed.title = String(patch.title).trim();
  if ("description" in patch) allowed.description = String(patch.description || "").trim() || null;
  if ("amount" in patch) {
    const amount = patch.amount === "" || patch.amount == null ? null : Number(patch.amount);
    allowed.amount = amount;
    allowed.fixed_amount = amount != null;
  }
  const { error } = await db()
    .from("payment_links")
    .update(allowed)
    .eq("id", linkId)
    .eq("merchant_id", id.userId);
  if (error) return fail(error.message);
  return done();
}

export async function deletePaymentLink(id: Identity, linkId: string) {
  const { error } = await db()
    .from("payment_links")
    .delete()
    .eq("id", linkId)
    .eq("merchant_id", id.userId);
  if (error) return fail(error.message);
  return done();
}

/** Public — used by the hosted checkout page. No token required. */
export async function publicPaymentLink(slug: string) {
  const { data, error } = await db()
    .from("payment_links")
    .select("id, merchant_id, slug, title, description, amount, currency, fixed_amount, redirect_url, status, views")
    .eq("slug", String(slug || "").trim())
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("This payment link does not exist.");
  if (data.status !== "active") return fail("This payment link is no longer accepting payments.");
  await db().from("payment_links").update({ views: ((data as any).views ?? 0) + 1 }).eq("id", data.id);
  return done(data);
}

// ─── webhooks ─────────────────────────────────────────────────

export async function listWebhooks(id: Identity) {
  const { data, error } = await db()
    .from("webhook_endpoints")
    .select("*")
    .eq("merchant_id", id.userId)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message);
  return done(data ?? []);
}

/**
 * Webhook URLs are merchant-supplied and this server calls them, so they must
 * be public HTTPS hosts — otherwise an endpoint could be pointed at internal
 * infrastructure (SSRF).
 */
export function isSafeWebhookUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const [a, b] = host.split(".").map(Number) as [number, number];
    if (a === 10 || a === 127 || a === 0 || a === 169) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
  }
  if (host.includes(":")) return false; // raw IPv6 literal
  return true;
}

export async function createWebhook(id: Identity, body: Record<string, any>) {
  const url = String(body.url || "").trim();
  if (!isSafeWebhookUrl(url)) return fail("The endpoint URL must be a public https:// address.");

  const events: string[] = Array.isArray(body.events) && body.events.length
    ? body.events.map(String)
    : ["collection.success", "collection.failed", "payout.success", "payout.failed"];
  const { data, error } = await db()
    .from("webhook_endpoints")
    .insert({ merchant_id: id.userId, url, events, secret: `whsec_${randomToken(32)}` })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return done(data);
}

export async function deleteWebhook(id: Identity, endpointId: string) {
  const { error } = await db()
    .from("webhook_endpoints")
    .delete()
    .eq("id", endpointId)
    .eq("merchant_id", id.userId);
  if (error) return fail(error.message);
  return done();
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Delivers one event to every matching endpoint and records the attempt. */
export async function dispatchWebhook(merchantId: string, event: string, payload: Record<string, unknown>) {
  const { data: endpoints } = await db()
    .from("webhook_endpoints")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "active");

  const results: Array<Record<string, unknown>> = [];
  for (const endpoint of endpoints ?? []) {
    if (Array.isArray(endpoint.events) && endpoint.events.length && !endpoint.events.includes(event)) continue;
    const bodyText = JSON.stringify({ event, created_at: new Date().toISOString(), data: payload });
    let responseCode: number | null = null;
    let responseBody = "";
    if (!isSafeWebhookUrl(endpoint.url)) {
      responseBody = "Endpoint URL is not a public https:// address; delivery skipped.";
    } else
    try {
      // A merchant endpoint that never answers must not hold up a payment
      // response, so every delivery is capped at 8 seconds.
      const resp = await fetch(endpoint.url, {
        method: "POST",
        signal: AbortSignal.timeout(8000),
        headers: {
          "Content-Type": "application/json",
          "X-ObPay-Event": event,
          "X-ObPay-Signature": await hmacHex(endpoint.secret, bodyText),
        },
        body: bodyText,
      });

      responseCode = resp.status;
      responseBody = (await resp.text()).slice(0, 2000);
    } catch (err: any) {
      responseBody = err?.message || "Could not reach the endpoint";
    }
    await db().from("webhook_deliveries").insert({
      endpoint_id: endpoint.id,
      merchant_id: merchantId,
      event,
      payload,
      response_code: responseCode,
      response_body: responseBody,
      status: responseCode && responseCode >= 200 && responseCode < 300 ? "delivered" : "failed",
    });
    results.push({ url: endpoint.url, response_code: responseCode, response_body: responseBody });
  }
  return results;
}

export async function testWebhook(id: Identity, endpointId: string) {
  const { data: endpoint } = await db()
    .from("webhook_endpoints")
    .select("*")
    .eq("id", endpointId)
    .eq("merchant_id", id.userId)
    .maybeSingle();
  if (!endpoint) return fail("That endpoint no longer exists.");
  const results = await dispatchWebhook(id.userId, "test.ping", {
    reference: `test_${randomToken(8)}`,
    message: "This is a test event from ObPay.",
  });
  return done(results);
}

export async function listWebhookDeliveries(id: Identity, limit = 50) {
  const { data, error } = await db()
    .from("webhook_deliveries")
    .select("*")
    .eq("merchant_id", id.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return done(data ?? []);
}

// ─── request logs ─────────────────────────────────────────────

export async function logApiRequest(entry: Record<string, unknown>) {
  try {
    await db().from("api_request_logs").insert(entry);
  } catch {
    /* logging must never break a payment */
  }
}

export async function listApiLogs(id: Identity, limit = 100) {
  const query = db().from("api_request_logs").select("*").order("created_at", { ascending: false }).limit(limit);
  if (!id.isAdmin) query.eq("merchant_id", id.userId);
  const { data, error } = await query;
  if (error) return fail(error.message);
  return done(data ?? []);
}

// ─── verification (KYC) ───────────────────────────────────────

export async function getKyc(id: Identity) {
  const { data: submission } = await db()
    .from("kyc_submissions")
    .select("*")
    .eq("merchant_id", id.userId)
    .maybeSingle();
  const { data: documents } = await db()
    .from("kyc_documents")
    .select("*")
    .eq("merchant_id", id.userId)
    .order("created_at", { ascending: false });
  return done({ submission: submission ?? null, documents: documents ?? [] });
}

export async function saveKyc(id: Identity, body: Record<string, any>) {
  const payload = {
    merchant_id: id.userId,
    email: id.email,
    full_name: String(body.full_name || "").trim() || null,
    business_name: String(body.business_name || "").trim() || null,
    phone: String(body.phone || "").trim() || null,
    address: String(body.address || "").trim() || null,
    id_type: String(body.id_type || "").trim() || null,
    id_number: String(body.id_number || "").trim() || null,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await db()
    .from("kyc_submissions")
    .upsert(payload, { onConflict: "merchant_id" })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return done(data);
}

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const binary = atob(match[2]!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType: match[1]! };
}

export async function uploadKycDocument(id: Identity, body: Record<string, any>) {
  const decoded = decodeDataUrl(body.file_data);
  if (!decoded) return fail("That file could not be read. Try another photo.");
  const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "application/pdf"];
  if (!ALLOWED.includes(decoded.contentType.toLowerCase())) {
    return fail("Upload a JPG, PNG, WEBP or PDF document.");
  }
  if (decoded.bytes.length > 8 * 1024 * 1024) return fail("Each document must be under 8 MB.");


  const docType = String(body.doc_type || "document");
  const ext = decoded.contentType.includes("pdf") ? "pdf" : decoded.contentType.split("/")[1] || "jpg";
  const path = `${id.userId}/${docType}-${Date.now()}.${ext}`;

  const { error: uploadError } = await db()
    .storage.from("kyc-documents")
    .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: true });
  if (uploadError) return fail(uploadError.message);

  const { data: submission } = await db()
    .from("kyc_submissions")
    .select("id")
    .eq("merchant_id", id.userId)
    .maybeSingle();

  const { data, error } = await db()
    .from("kyc_documents")
    .insert({
      merchant_id: id.userId,
      submission_id: submission?.id ?? null,
      doc_type: docType,
      file_path: path,
      file_name: String(body.file_name || "").slice(0, 200) || null,
      file_size: decoded.bytes.length,
    })
    .select("*")
    .single();
  if (error) return fail(error.message);
  return done(data);
}

export async function documentUrl(id: Identity, documentId: string) {
  const query = db().from("kyc_documents").select("*").eq("id", documentId);
  if (!id.isAdmin) query.eq("merchant_id", id.userId);
  const { data: doc } = await query.maybeSingle();
  if (!doc) return fail("That document is not available.");
  const { data, error } = await db()
    .storage.from("kyc-documents")
    .createSignedUrl(doc.file_path, 60 * 10);
  if (error) return fail(error.message);
  return done({ url: data?.signedUrl, doc_type: doc.doc_type, file_name: doc.file_name });
}

export async function adminListKyc(_id: Identity, status?: string) {
  const query = db().from("kyc_submissions").select("*").order("updated_at", { ascending: false });
  if (status && status !== "all") query.eq("status", status);
  const { data: submissions, error } = await query;
  if (error) return fail(error.message);
  const { data: documents } = await db().from("kyc_documents").select("*");
  return done({ submissions: submissions ?? [], documents: documents ?? [] });
}

export async function adminReviewKyc(id: Identity, submissionId: string, status: string, notes: string) {
  const next = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
  const { error } = await db()
    .from("kyc_submissions")
    .update({
      status: next,
      review_notes: String(notes || "").trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: id.email,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId);
  if (error) return fail(error.message);
  await db().from("kyc_documents").update({ status: next }).eq("submission_id", submissionId);
  return done();
}

// ─── payment records ──────────────────────────────────────────

export async function recordPayment(merchantId: string, row: Record<string, any>) {
  const { data, error } = await db()
    .from("payment_records")
    .upsert({ merchant_id: merchantId, ...row, updated_at: new Date().toISOString() }, { onConflict: "reference" })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function listPayments(id: Identity, limit = 100) {
  const { data, error } = await db()
    .from("payment_records")
    .select("*")
    .eq("merchant_id", id.userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return done(data ?? []);
}

// ─── public hosted checkout ───────────────────────────────────
// A payer is not signed in, so these run without a merchant session. The
// payment link itself identifies the merchant. Collections go straight to
// MarzPay from this server, and the result is stored in ObPay's own records —
// nothing here touches the merchant account backend.

function marzCountry(currency: string): string {
  const c = String(currency || "UGX").toUpperCase();
  if (c === "KES") return "kenya";
  if (c === "TZS") return "tanzania";
  return "uganda";
}

export async function publicCollect(body: Record<string, any>) {
  const { readMarzCreds, marzFetch, normalizePhone } = await import("./marz.server");
  const creds = readMarzCreds();
  if (!creds) return fail("Payments are temporarily unavailable. Please try again shortly.");

  const slug = String(body.slug || "").trim();
  const { data: link } = await db()
    .from("payment_links")
    .select("id, merchant_id, title, description, amount, currency, fixed_amount, status, payments_count")
    .eq("slug", slug)
    .maybeSingle();
  if (!link) return fail("This payment link does not exist.");
  if (link.status !== "active") return fail("This payment link is no longer accepting payments.");

  const amount = Number(link.fixed_amount && link.amount != null ? link.amount : body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter a valid amount to pay.");
  const phone = normalizePhone(body.phoneNumber, link.currency);
  if (!phone) return fail("Enter the mobile money number that will pay.");

  const reference = `OBP${Date.now().toString(36).toUpperCase()}${randomToken(4).toUpperCase()}`;
  const res = await marzFetch(creds, "/collect-money", {
    method: "POST",
    body: {
      amount: Math.round(amount),
      phone_number: phone,
      method: "mobile_money",
      country: marzCountry(link.currency),
      reference,
      description: String(link.description || link.title || "ObPay payment").slice(0, 255),
    },
  });

  if (!res.ok) {
    await recordPayment(link.merchant_id, {
      reference,
      payment_link_id: link.id,
      type: "collection",
      source: "payment_link",
      amount,
      currency: link.currency,
      status: "failed",
      phone_number: phone,
      description: link.title,
    });
    return fail(res.error || "The mobile money request could not be started. Please try again.");
  }

  const providerRef = res.data?.data?.transaction?.reference || reference;
  await recordPayment(link.merchant_id, {
    reference,
    provider_reference: providerRef,
    payment_link_id: link.id,
    type: "collection",
    source: "payment_link",
    amount,
    currency: link.currency,
    status: "pending",
    phone_number: phone,
    description: link.title,
  });
  await db()
    .from("payment_links")
    .update({ payments_count: (link.payments_count ?? 0) + 1 })
    .eq("id", link.id);

  return done({
    reference,
    provider_reference: providerRef,
    amount,
    currency: link.currency,
    status: "pending",
    message: "Approve the prompt on your phone to complete the payment.",
  });
}

export async function publicPaymentStatus(reference: string) {
  const ref = String(reference || "").trim();
  if (!ref) return fail("Missing payment reference.");
  // Unauthenticated endpoint: only hosted-checkout payments (whose references
  // are server-generated and unguessable) may be looked up here. API-created
  // records use merchant-chosen references and stay behind the merchant API.
  const { data: record } = await db()
    .from("payment_records")
    .select("*")
    .eq("reference", ref)
    .eq("source", "payment_link")
    .maybeSingle();
  if (!record) return fail("We could not find that payment.");

  if (record.status !== "pending") return done({ status: record.status, reference: ref, amount: record.amount });

  const { readMarzCreds, marzFetch } = await import("./marz.server");
  const creds = readMarzCreds();
  if (creds) {
    const lookupRef = record.provider_reference || ref;
    const res = await marzFetch(creds, `/transactions/${encodeURIComponent(lookupRef)}`);
    const raw = String(res.data?.data?.transaction?.status || "").toLowerCase();
    const next =
      ["success", "successful", "completed", "complete"].includes(raw)
        ? "success"
        : ["failed", "cancelled", "canceled", "rejected", "expired"].includes(raw)
          ? "failed"
          : null;
    if (next) {
      await db()
        .from("payment_records")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("reference", ref);
      await dispatchWebhook(record.merchant_id, next === "success" ? "collection.success" : "collection.failed", {
        reference: ref,
        amount: record.amount,
        currency: record.currency,
        phone_number: record.phone_number,
      });
      return done({ status: next, reference: ref, amount: record.amount });
    }
  }

  return done({ status: "pending", reference: ref, amount: record.amount });
}


// ─── action router ────────────────────────────────────────────

export async function runPlatformAction(
  action: string,
  accessToken: string,
  body: Record<string, any>,
): Promise<any> {
  try {
    // Public actions need no session.
    if (action === "public-link") return await publicPaymentLink(body.slug);
    if (action === "public-pay") return await publicCollect(body);
    if (action === "public-status") return await publicPaymentStatus(body.reference);


    const id =
      action.startsWith("admin-")
        ? await requireAdmin(accessToken)
        : await requireIdentity(accessToken);

    switch (action) {
      case "api-keys.list":
        return await listApiKeys(id);
      case "api-keys.create":
        return await createApiKey(id, body.name, body.environment);
      case "api-keys.revoke":
        return await revokeApiKey(id, body.id);
      case "api-keys.delete":
        return await deleteApiKey(id, body.id);

      case "links.list":
        return await listPaymentLinks(id);
      case "links.create":
        return await createPaymentLink(id, body);
      case "links.update":
        return await updatePaymentLink(id, body.id, body);
      case "links.delete":
        return await deletePaymentLink(id, body.id);

      case "webhooks.list":
        return await listWebhooks(id);
      case "webhooks.create":
        return await createWebhook(id, body);
      case "webhooks.delete":
        return await deleteWebhook(id, body.id);
      case "webhooks.test":
        return await testWebhook(id, body.id);
      case "webhooks.deliveries":
        return await listWebhookDeliveries(id, body.limit);

      case "logs.list":
        return await listApiLogs(id, body.limit);
      case "payments.list":
        return await listPayments(id, body.limit);

      case "kyc.get":
        return await getKyc(id);
      case "kyc.save":
        return await saveKyc(id, body);
      case "kyc.upload":
        return await uploadKycDocument(id, body);
      case "kyc.document-url":
        return await documentUrl(id, body.id);

      case "admin-kyc.list":
        return await adminListKyc(id, body.status);
      case "admin-kyc.review":
        return await adminReviewKyc(id, body.id, body.status, body.notes);
      case "admin-kyc.document-url":
        return await documentUrl(id, body.id);

      default:
        return fail(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    return fail(err?.message || "Something went wrong. Please try again.");
  }
}
