
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-obpay-key, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// ════════════════════════════════════════════════════════════════════
// PROVIDER: MarzPay  —  https://wallet.wearemarz.com/api/v1
// Auth: Authorization: Basic base64(api_key:api_secret)
// ════════════════════════════════════════════════════════════════════
const MARZ_BASE = "https://wallet.wearemarz.com/api/v1";

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function apiError(error: string, status = 400, extra?: Record<string, any>): Response {
  return json({ success: false, error, ...(extra || {}) }, status);
}
function apiSuccess(data: any, extra?: Record<string, any>): Response {
  return json({ success: true, data, ...(extra || {}) });
}
function redactKey(k: string): string {
  if (!k || k.length < 16) return "(short/empty)";
  return k.slice(0, 6) + "..." + k.slice(-4);
}

export interface MarzAuth { basic: string; key: string; secret: string; }

function buildAuth(key: string, secret: string): MarzAuth {
  return { basic: btoa(`${key}:${secret}`), key, secret };
}

/** MarzPay only enforces IP whitelisting on sensitive reads (balance/account).
 *  Collections, payouts, transaction status and phone verification work from any IP,
 *  so a whitelist rejection must never be treated as "not connected". */
function isIpWhitelistError(res: { error?: string; data?: any; httpStatus?: number }): boolean {
  const code = (res?.data?.error_code || "").toString().toUpperCase();
  if (code === "IP_WHITELIST_REQUIRED") return true;
  return /ip whitelist/i.test(res?.error || "");
}


// A UUID v4 reference is REQUIRED by MarzPay for collections and disbursements.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function providerReference(candidate?: string): string {
  return candidate && UUID_V4.test(candidate.trim()) ? candidate.trim() : crypto.randomUUID();
}

function mapNetwork(network?: string): string | undefined {
  if (!network) return undefined;
  const lower = (network || "").toLowerCase().trim();
  if (lower === "bank" || lower === "card") return undefined;
  if (lower.includes("mtn")) return "MTN";
  if (lower.includes("airtel")) return "AIRTEL";
  return network.toUpperCase();
}

function marzCountry(currency?: string): string {
  const map: Record<string, string> = { UGX: "UG", KES: "KE", GHS: "GH", XAF: "CM", TZS: "TZ" };
  return map[(currency || "UGX").toUpperCase()] || "UG";
}

/**
 * Resolve MarzPay credentials.
 * Order: Supabase secrets → platform_settings (marz_* columns) →
 *        platform_settings legacy slots → per-user credential rows.
 * A single combined value in the form "key:secret" is also accepted.
 */
async function getMarzCreds(
  supabase: any,
  userId?: string | null,
): Promise<{ key: string; secret: string; source: string; auth: MarzAuth | null }> {
  const pack = (key: string, secret: string, source: string) => {
    const k = (key || "").trim();
    let s = (secret || "").trim();
    if (k && !s && k.includes(":")) {
      const parts = k.split(":");
      return { key: parts[0].trim(), secret: parts.slice(1).join(":").trim(), source, auth: buildAuth(parts[0].trim(), parts.slice(1).join(":").trim()) };
    }
    if (k && s.includes(":") && s.startsWith(k + ":")) s = s.slice(k.length + 1);
    if (k && s) return { key: k, secret: s, source, auth: buildAuth(k, s) };
    return null;
  };

  const envHit = pack(Deno.env.get("MARZ_API_KEY") || "", Deno.env.get("MARZ_API_SECRET") || "", "supabase_secret");
  if (envHit) return envHit;

  // Optional: a ready-made base64 "key:secret" value for the Authorization header.
  const basicEnv = (Deno.env.get("MARZ_API_BASIC") || "").trim();
  if (basicEnv) {
    try {
      const decoded = atob(basicEnv);
      const idx = decoded.indexOf(":");
      if (idx > 0) {
        const k = decoded.slice(0, idx).trim();
        const s = decoded.slice(idx + 1).trim();
        if (k && s) return { key: k, secret: s, source: "supabase_secret_basic", auth: { basic: basicEnv, key: k, secret: s } };
      }
    } catch (_) { /* not valid base64 — ignore */ }
  }


  try {
    const { data: ps } = await supabase.from("platform_settings")
      .select("marz_api_key, marz_api_secret").limit(1).maybeSingle();
    const hit = pack(ps?.marz_api_key || "", ps?.marz_api_secret || "", "platform_settings");
    if (hit) return hit;
  } catch (_) { /* columns may not exist yet */ }

  // Legacy storage slots reused by the admin settings screen.
  try {
    const { data: ps } = await supabase.from("platform_settings")
      .select("livepay_api_key, livepay_account_number").limit(1).maybeSingle();
    const hit = pack(ps?.livepay_api_key || "", ps?.livepay_account_number || "", "platform_settings_legacy_slot");
    if (hit) return hit;
  } catch (_) { /* ignore */ }

  if (userId) {
    try {
      const { data: row } = await supabase.from("livepay_credentials")
        .select("api_key, account_number").eq("user_id", userId).eq("status", "active").maybeSingle();
      const hit = pack(row?.api_key || "", row?.account_number || "", "merchant_credentials");
      if (hit) return hit;
    } catch (_) { /* ignore */ }
  }

  return { key: "", secret: "", source: "none", auth: null };
}

async function authenticateRequest(req: Request, body: any, supabase: any): Promise<{ userId: string | null; error: string | null; authMethod: string }> {
  const xApiKey = req.headers.get("x-api-key") || "";
  const xObpayKey = req.headers.get("x-obpay-key") || "";
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const bodyApiKey = (body?._api_key || body?.apiKey || "").trim();

  for (const [key, method] of [[xApiKey, "x_api_key"], [xObpayKey, "x_obpay_key"], [bodyApiKey, "body_api_key"], [apiKeyHeader, "apikey_header"]] as [string, string][]) {
    if (key && key.startsWith("sk_live_")) {
      const { data: keyData } = await supabase.from("api_keys").select("user_id, status").eq("secret_key", key).eq("status", "active").maybeSingle();
      if (!keyData) return { userId: null, error: "Invalid API key", authMethod: method + "_invalid" };
      const { data: profileData } = await supabase.from("profiles").select("status").eq("id", keyData.user_id).maybeSingle();
      if (!profileData || profileData.status !== "active") return { userId: null, error: "Account not active", authMethod: "account_inactive" };
      return { userId: keyData.user_id, error: null, authMethod: method };
    }
  }

  if (bearerToken && bearerToken.startsWith("eyJ")) {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerToken);
      if (authErr || !user) return { userId: null, error: "Session expired", authMethod: "jwt_failed" };
      const { data: profileData } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
      if (!profileData || profileData.status !== "active") return { userId: null, error: "Account not active", authMethod: "jwt_inactive" };
      return { userId: user.id, error: null, authMethod: "jwt" };
    } catch { return { userId: null, error: "JWT auth failed", authMethod: "jwt_exception" }; }
  }

  return { userId: null, error: "Authentication required", authMethod: "none" };
}

// ─── MarzPay HTTP layer ─────────────────────────────────────────────
async function marzRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  auth: MarzAuth,
  body?: Record<string, any>,
): Promise<{ ok: boolean; data?: any; error?: string; httpStatus?: number; raw?: string }> {
  const url = `${MARZ_BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: {
      "Authorization": `Basic ${auth.basic}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  try {
    const resp = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
    const raw = await resp.text();
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch {
      return { ok: false, httpStatus: resp.status, error: `MarzPay non-JSON (HTTP ${resp.status}): ${raw.slice(0, 200)}`, raw: raw.slice(0, 500) };
    }
    const failed = !resp.ok || parsed?.status === "error" || parsed?.success === false;
    if (failed) {
      const detail = parsed?.errors ? JSON.stringify(parsed.errors).slice(0, 200) : "";
      return { ok: false, data: parsed, httpStatus: resp.status, error: parsed?.message || parsed?.error || `MarzPay HTTP ${resp.status}${detail ? ` — ${detail}` : ""}`, raw: raw.slice(0, 500) };
    }
    return { ok: true, data: parsed, httpStatus: resp.status };
  } catch (err: any) {
    return { ok: false, error: `Cannot reach MarzPay: ${err.message}` };
  }
}

async function marzCollect(auth: MarzAuth, params: {
  phoneNumber: string; amount: number; currency: string; reference?: string; description: string; network?: string; callbackUrl?: string; method?: string;
}): Promise<{ ok: boolean; data?: any; error?: string; httpStatus?: number; raw?: any }> {
  const ref = providerReference(params.reference);
  const payload: Record<string, any> = {
    amount: Math.round(Number(params.amount)),
    country: marzCountry(params.currency),
    reference: ref,
    description: (params.description || "Payment via ObPay").slice(0, 255),
  };
  if (params.method === "card") payload.method = "card";
  else { payload.method = "mobile_money"; payload.phone_number = params.phoneNumber; }
  if (params.callbackUrl) payload.callback_url = params.callbackUrl.slice(0, 255);

  const res = await marzRequest("POST", "/collect-money", auth, payload);
  if (!res.ok) return res;
  const d = res.data?.data || {};
  return {
    ok: true,
    httpStatus: res.httpStatus,
    data: {
      reference: d.transaction?.reference || ref,
      internal_reference: d.transaction?.uuid || "",
      network: (d.collection?.provider || mapNetwork(params.network) || "").toUpperCase(),
      status: d.transaction?.status || "processing",
      redirect_url: d.redirect_url || "",
      message: res.data?.message || "Collection initiated",
    },
    raw: res.data,
  };
}

async function marzSend(auth: MarzAuth, params: {
  phoneNumber: string; amount: number; currency: string; reference?: string; description: string; network?: string; callbackUrl?: string;
}): Promise<{ ok: boolean; data?: any; error?: string; httpStatus?: number; raw?: any }> {
  const ref = providerReference(params.reference);
  const payload: Record<string, any> = {
    amount: Math.round(Number(params.amount)),
    phone_number: params.phoneNumber,
    country: marzCountry(params.currency),
    reference: ref,
    description: (params.description || "Payout via ObPay").slice(0, 255),
  };
  if (params.callbackUrl) payload.callback_url = params.callbackUrl.slice(0, 255);

  const res = await marzRequest("POST", "/send-money", auth, payload);
  if (!res.ok) return res;
  const d = res.data?.data || {};
  return {
    ok: true,
    httpStatus: res.httpStatus,
    data: {
      reference: d.transaction?.reference || ref,
      internal_reference: d.transaction?.uuid || "",
      provider_reference: d.transaction?.provider_reference || "",
      network: (d.disbursement?.provider || mapNetwork(params.network) || "").toUpperCase(),
      status: d.transaction?.status || "processing",
      message: res.data?.message || "Send money initiated",
    },
    raw: res.data,
  };
}

async function marzBalance(auth: MarzAuth) {
  const res = await marzRequest("GET", "/balance", auth);
  if (!res.ok) return res;
  const account = res.data?.data?.account || {};
  return {
    ok: true,
    httpStatus: res.httpStatus,
    data: {
      business_name: account.business_name || "",
      balance: account.balance?.raw ?? 0,
      formatted: account.balance?.formatted || "0.00",
      currency: account.balance?.currency || "UGX",
      mode: account.status?.mode || "",
      account_status: account.status?.account_status || "",
      is_frozen: !!account.status?.is_frozen,
      summary: res.data?.data?.summary || null,
    },
  };
}

/** Transaction details — accepts the MarzPay uuid or your reference. */
async function marzTxnStatus(auth: MarzAuth, reference: string) {
  const res = await marzRequest("GET", `/transactions/${encodeURIComponent(reference)}`, auth);
  if (!res.ok) return res;
  const body = res.data?.data || res.data || {};
  const txn = body.transaction || {};
  const detail = body.collection || body.disbursement || {};
  return {
    ok: true,
    httpStatus: res.httpStatus,
    data: {
      status: txn.status || "",
      event_type: body.event_type || "",
      uuid: txn.uuid || "",
      reference: txn.reference || reference,
      charge: Number(detail.charge?.raw ?? detail.charge ?? txn.charge?.raw ?? txn.charge ?? 0) || 0,
      provider_transaction_id: detail.provider_transaction_id || txn.provider_reference || "",
      amount: txn.amount?.raw ?? null,
      currency: txn.amount?.currency || "UGX",
    },
  };
}

async function marzVerifyPhone(auth: MarzAuth, phoneNumber: string) {
  const res = await marzRequest("POST", "/phone-verification/verify", auth, { phone_number: phoneNumber });
  if (!res.ok) return res;
  const d = res.data?.data || {};
  return {
    ok: true,
    httpStatus: res.httpStatus,
    data: {
      customer_name: d.name || d.customer_name || d.user?.name || null,
      network: (d.provider || d.network || "").toUpperCase(),
    },
  };
}

function normalizeStatus(rawStatus: string): "pending" | "success" | "failed" | null {
  const s = (rawStatus || "").toLowerCase().trim();
  if (["success", "successful", "completed", "sandbox"].includes(s)) return "success";
  if (["failed", "failure", "rejected", "declined", "cancelled", "canceled", "expired"].includes(s)) return "failed";
  if (["pending", "processing", "in_progress", "initiated"].includes(s)) return "pending";
  return null;
}


async function dispatchMerchantWebhooks(supabase: any, userId: string, event: string, payload: any) {
  try {
    const { data: configs } = await supabase.from("webhook_configs")
      .select("id, webhook_url, webhook_secret, is_active").eq("user_id", userId).eq("is_active", true);
    if (!configs || configs.length === 0) return;
    for (const cfg of configs) {
      const wp = { event, data: payload, timestamp: new Date().toISOString() };
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json", "X-ObPay-Event": event, "User-Agent": "OBPay-Webhook/5.5" };
        if (cfg.webhook_secret) {
          const encoder = new TextEncoder();
          const kd = await crypto.subtle.importKey("raw", encoder.encode(cfg.webhook_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
          const sig = await crypto.subtle.sign("HMAC", kd, encoder.encode(JSON.stringify(wp)));
          headers["X-ObPay-Signature"] = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
        }
        const resp = await fetch(cfg.webhook_url, { method: "POST", headers, body: JSON.stringify(wp), signal: AbortSignal.timeout(10000) });
        await supabase.from("webhook_logs").insert({ user_id: userId, event_type: event, status: resp.ok ? "delivered" : "failed", attempts: 1, response_code: resp.status, payload: wp });
      } catch (err: any) {
        await supabase.from("webhook_logs").insert({ user_id: userId, event_type: event, status: "failed", attempts: 1, response_code: 0, payload: { error: err.message } });
      }
    }
  } catch (err: any) { console.error("[ObPay v5.5] dispatchMerchantWebhooks error:", err.message); }
}

async function sendTransactionEmail(supabase: any, userId: string, txn: any, normalized: "success" | "failed", fee: number, creditAmount: number) {
  try {
    const { data: userProfile } = await supabase.from("profiles").select("email").eq("id", userId).maybeSingle();
    const userEmail = userProfile?.email;
    if (!userEmail) return;

    const emailType = normalized === "success" ? "transaction_success" : "transaction_failed";
    const emailPayload: Record<string, any> = {
      reference: txn.reference, amount: txn.amount, currency: txn.currency || "UGX",
      type: txn.type, customer_phone: txn.customer_phone,
      customer_name: txn.customer_name, fee_amount: fee,
      net_amount: normalized === "success" ? creditAmount : txn.amount,
      created_at: txn.created_at,
      completed_at: normalized === "success" ? new Date().toISOString() : null,
    };
    if (normalized === "failed") {
      emailPayload.error_reason = txn.metadata?.error || txn.metadata?.providerResponse?.message || "Provider declined the transaction";
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: userEmail, type: emailType, data: emailPayload }),
    });
  } catch (e) {
    console.error("[ObPay] Transaction email send failed:", e);
  }
}

async function autoSyncTransaction(supabase: any, txn: any, auth: MarzAuth): Promise<{ synced: boolean; newStatus?: string; note?: string }> {
  if (txn.status !== "pending") return { synced: false, note: "Already resolved" };
  const meta = txn.metadata || {};
  const lpRef = String(meta?.lp_reference || meta?.customer_reference || txn.merchant_reference || "").trim();
  const ourRef = String(txn.reference || "").trim();
  const currency = txn.currency || "UGX";
  const refsToTry = [...new Set([lpRef, ourRef].filter(Boolean))];
  for (const ref of refsToTry) {
    const result = await marzTxnStatus(auth, ref);
    if (!result.ok || !result.data) continue;
    const normalized = normalizeStatus(result.data.status);
    if (!normalized || normalized === "pending") continue;
    const updates: any = { status: normalized };
    if (normalized === "success") updates.completed_at = new Date().toISOString();
    const lpData: any = result.data;
    if (lpData.charge) updates.fee_amount = Number(lpData.charge);
    const { data: updatedRows } = await supabase.from("transactions").update(updates).eq("id", txn.id).eq("status", "pending").select("id");
    if (!updatedRows || updatedRows.length === 0) return { synced: false, note: "Race condition" };
    const fee = Number(lpData.charge || txn.fee_amount || 0);
    const creditAmount = txn.amount - fee;
    if (normalized === "success" && txn.type === "collection") {
      const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance, total_collections").eq("user_id", txn.user_id).maybeSingle();
      if (wallet) {
        await supabase.from("merchant_wallets").update({ available_balance: Number(wallet.available_balance || 0) + creditAmount, total_collections: Number(wallet.total_collections || 0) + creditAmount, updated_at: new Date().toISOString() }).eq("user_id", txn.user_id);
      } else {
        await supabase.from("merchant_wallets").insert({ user_id: txn.user_id, currency, available_balance: creditAmount, total_collections: creditAmount, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      await supabase.from("notifications").insert({ user_id: txn.user_id, type: "payment_received", title: "Payment Received", message: `${creditAmount.toLocaleString()} ${currency} collected. Ref: ${txn.reference}` }).then(() => {}, () => {});
    }
    if (normalized === "failed" && txn.type === "payout") {
      const refundAmount = Number(txn.amount) + Number(txn.fee_amount || 0);
      const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance").eq("user_id", txn.user_id).maybeSingle();
      if (wallet && refundAmount > 0) {
        await supabase.from("merchant_wallets").update({ available_balance: Number(wallet.available_balance) + refundAmount, updated_at: new Date().toISOString() }).eq("user_id", txn.user_id);
      }
    }
    const eventName = normalized === "success" ? (txn.type === "payout" ? "payout.success" : "payment.success") : (txn.type === "payout" ? "payout.failed" : "payment.failed");
    dispatchMerchantWebhooks(supabase, txn.user_id, eventName, { transaction_id: txn.id, reference: txn.reference, status: normalized, amount: txn.amount, currency: txn.currency || "UGX", type: txn.type, fee_amount: fee, net_amount: normalized === "success" ? creditAmount : 0, customer_phone: txn.customer_phone, customer_name: txn.customer_name, description: txn.description, completed_at: normalized === "success" ? new Date().toISOString() : null });

    // Send transactional email to the merchant (non-blocking)
    EdgeRuntime.waitUntil(sendTransactionEmail(supabase, txn.user_id, txn, normalized, fee, creditAmount));

    return { synced: true, newStatus: normalized };
  }
  return { synced: false, note: `MarzPay lookup failed for refs: ${refsToTry.join(", ")}` };
}

function schedulePostCollectSync(supabase: any, txnId: string, auth: MarzAuth) {
  EdgeRuntime.waitUntil((async () => {
    const intervals = [2000, 5000, 10000, 20000, 35000];
    for (let pass = 0; pass < intervals.length; pass++) {
      await new Promise(r => setTimeout(r, intervals[pass]));
      try {
        const { data: freshTxn } = await supabase.from("transactions").select("*").eq("id", txnId).maybeSingle();
        if (!freshTxn || freshTxn.status !== "pending") return;
        const result = await autoSyncTransaction(supabase, freshTxn, auth);
        if (result.synced) return;
      } catch (err: any) { console.error(`[ObPay v5.5] Pass ${pass + 1} error for ${txnId.slice(0, 8)}:`, err.message); }
    }
  })());
}

async function checkWithdrawalLimit(supabase: any, userId: string, amount: number) {
  const { data: wallet } = await supabase.from("merchant_wallets")
    .select("daily_withdrawal_limit, last_24h_withdrawal_total, last_withdrawal_reset_at").eq("user_id", userId).maybeSingle();
  const limit = Number(wallet?.daily_withdrawal_limit || 0);
  if (!limit || limit <= 0) return { allowed: true };
  const now = new Date();
  const resetAt = wallet?.last_withdrawal_reset_at ? new Date(wallet.last_withdrawal_reset_at) : new Date(0);
  const hoursSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60);
  let used24h = Number(wallet?.last_24h_withdrawal_total || 0);
  if (hoursSinceReset >= 24) {
    used24h = 0;
    await supabase.from("merchant_wallets").update({ last_24h_withdrawal_total: 0, last_withdrawal_reset_at: now.toISOString() }).eq("user_id", userId);
  }
  const remaining = limit - used24h;
  if (amount > remaining) return { allowed: false, error: `Daily withdrawal limit reached. You have ${remaining.toLocaleString()} UGX remaining. Limit resets every 24h.`, limit, remaining, used24h };
  return { allowed: true, limit, remaining: remaining - amount, used24h };
}

async function recordWithdrawal(supabase: any, userId: string, amount: number) {
  const { data: wallet } = await supabase.from("merchant_wallets")
    .select("daily_withdrawal_limit, last_24h_withdrawal_total, last_withdrawal_reset_at").eq("user_id", userId).maybeSingle();
  if (!wallet || !Number(wallet.daily_withdrawal_limit)) return;
  const resetAt = wallet.last_withdrawal_reset_at ? new Date(wallet.last_withdrawal_reset_at) : new Date(0);
  const hoursSinceReset = (new Date().getTime() - resetAt.getTime()) / (1000 * 60 * 60);
  let newTotal = Number(wallet.last_24h_withdrawal_total || 0);
  if (hoursSinceReset >= 24) newTotal = 0;
  newTotal += amount;
  await supabase.from("merchant_wallets").update({ last_24h_withdrawal_total: newTotal, last_withdrawal_reset_at: hoursSinceReset >= 24 ? new Date().toISOString() : resetAt.toISOString() }).eq("user_id", userId);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let body: any = {};
    try { body = JSON.parse(await req.text()); } catch { body = {}; }
    const action = (body._action || body.action || "").trim();

    // ═══ Public / no-auth endpoints ═══
    if (action === "health") {
      const { key, secret, source, auth } = await getMarzCreds(supabase);
      let ps: any = { configured: !!(key && secret), keySource: source, keyRedacted: key ? redactKey(key) : "none", secretConfigured: !!secret };
      if (key && secret) {
        const balRes = await marzBalance(auth!);
        ps.connected = balRes.ok;
        ps.balance = balRes.data || null;
        ps.balanceError = balRes.error || null;
      }
      return apiSuccess({ version: "6.0.0-marzpay", requestId, timestamp: new Date().toISOString(), provider: "marzpay", provider_base: MARZ_BASE, provider_status: ps, sync_mechanism: "aggressive_5_pass_polling", sync_intervals: ["2s", "5s", "10s", "20s", "35s"] });
    }

    if (action === "auth-check") {
      return apiSuccess({ version: "6.0.0-marzpay", requestId, received: { method: req.method, bodyKeys: Object.keys(body) } });
    }

    if (action === "diagnostic" || action === "test-marz" || action === "test-livepay") {
      const { key, secret, source, auth } = await getMarzCreds(supabase, body.userId || null);
      const diag: any = { version: "6.0.0-marzpay", provider: "marzpay", key_source: source, key_redacted: redactKey(key), key_length: key?.length || 0, has_key: !!key, has_secret: !!secret, timestamp: new Date().toISOString() };
      if (key && secret) {
        const balRes = await marzBalance(auth!);
        diag.marz_test = { endpoint: "/balance", ok: balRes.ok, http_status: balRes.httpStatus || null, error: balRes.error || null, balance_data: balRes.data || null };
        if (!balRes.ok) {
          const errMsg = (balRes.error || "").toLowerCase();
          if (errMsg.includes("unauthenticated") || errMsg.includes("unauthorized") || errMsg.includes("invalid credentials") || balRes.httpStatus === 401) diag.recommendation = "MarzPay rejected the credentials. Check the API key and API secret in your MarzPay dashboard, and make sure the key is active.";
          else if (balRes.httpStatus === 403) diag.recommendation = "MarzPay denied access. Your account may not be approved for API access, or this IP is not allowed.";
          else if (errMsg.includes("frozen")) diag.recommendation = "Your MarzPay account is frozen. Contact MarzPay support.";
          else diag.recommendation = `MarzPay error: ${balRes.error}`;
        }
      } else { diag.recommendation = key && !secret ? "API key is set but the API secret is missing." : "No MarzPay credentials found. Set MARZ_API_KEY and MARZ_API_SECRET."; }
      return apiSuccess(diag);
    }


    if (action === "verify-phone" || action === "verify-number") {
      const phoneNumber = (body.phoneNumber || body.phone || "").trim();
      if (!phoneNumber) return apiError("Missing phoneNumber");
      const { auth } = await getMarzCreds(supabase);
      if (!auth) return apiError("Provider key not configured", 503);
      const result = await marzVerifyPhone(auth!, phoneNumber);
      if (result.ok && result.data?.customer_name) {
        return apiSuccess({ phone: phoneNumber, customer_name: result.data.customer_name, network: result.data.network || "", validated: true });
      }
      return apiSuccess({ phone: phoneNumber, customer_name: null, validated: false, message: result.data?.message || "Not validated", error: result.error || null });
    }

    // ─── PUBLIC: Check transaction by reference ──
    if (action === "public-check-transaction") {
      const ref = body.reference;
      if (!ref) return apiError("Missing reference");
      const { data: txn } = await supabase.from("transactions").select("*").eq("reference", ref).maybeSingle();
      if (!txn) return apiError(`Transaction "${ref}" not found`, 404);
      return apiSuccess({ id: txn.id, reference: txn.reference, status: txn.status, amount: txn.amount, currency: txn.currency, fee_amount: txn.fee_amount || 0, net_amount: txn.net_amount || txn.amount, created_at: txn.created_at, completed_at: txn.completed_at });
    }

    // ─── PUBLIC: Collect payment ─────
    if (action === "public-collect") {
      const { phoneNumber, amount, currency, reference, description, customerName, network } = body;
      const slug: string = (body.merchantSlug || body._merchant_slug || "").trim();
      if (!phoneNumber || !amount || !slug) return apiError("Required: phoneNumber, amount, merchantSlug");

      let merchantUserId: string | null = null;

      const { data: paymentLink } = await supabase.from("payment_links")
        .select("user_id, amount, description, reference, status, expiry_date")
        .eq("url_slug", slug).eq("status", "active").maybeSingle();

      if (paymentLink?.user_id) {
        if (paymentLink.expiry_date && new Date(paymentLink.expiry_date) < new Date()) {
          return apiError("This payment link has expired", 400);
        }
        merchantUserId = paymentLink.user_id;
      }

      if (!merchantUserId) {
        const { data: merchant } = await supabase.from("merchant_profiles")
          .select("user_id").eq("merchant_slug", slug).eq("verification_status", "approved").maybeSingle();
        if (merchant?.user_id) merchantUserId = merchant.user_id;
      }

      if (!merchantUserId) return apiError("Merchant not found or payment link is no longer active", 404);

      const numAmount = Number(amount);
      const ref = (reference || `PUB${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
      const txnId = crypto.randomUUID();
      const { key, secret, auth } = await getMarzCreds(supabase, merchantUserId);

      if (!key || !secret) {
        await supabase.from("transactions").insert({ id: txnId, user_id: merchantUserId, reference: ref, type: "collection", amount: numAmount, currency: currency || "UGX", status: "pending", customer_phone: phoneNumber });
        return apiError("Provider not configured", 503, { data: { reference: ref, transaction_id: txnId, status: "pending" } });
      }

      const lp = await marzCollect(auth!, { phoneNumber, amount: numAmount, currency: currency || "UGX", reference: ref, description: description || "Payment", network });
      if (lp.ok && lp.data) {
        const lpRef = lp.data.reference || "";
        const internalRef = lp.data.internal_reference || "";
        await supabase.from("transactions").insert({
          id: txnId, user_id: merchantUserId, reference: ref, type: "collection",
          amount: numAmount, currency: currency || "UGX", status: "pending",
          customer_phone: phoneNumber, customer_name: customerName || "",
          merchant_reference: lpRef,
          metadata: { lp_reference: lpRef, lp_internal_ref: internalRef, network: lp.data.network || mapNetwork(network) || "" },
        });
        dispatchMerchantWebhooks(supabase, merchantUserId, "payment.initiated", { transaction_id: txnId, reference: ref, status: "pending", amount: numAmount, currency: currency || "UGX" });
        schedulePostCollectSync(supabase, txnId, auth!);
        return apiSuccess({ reference: ref, transaction_id: txnId, lp_reference: lpRef, status: "pending", amount: numAmount, currency: currency || "UGX" });
      }

      await supabase.from("transactions").insert({ id: txnId, user_id: merchantUserId, reference: ref, type: "collection", amount: numAmount, currency: currency || "UGX", status: "failed", customer_phone: phoneNumber, metadata: { error: lp.error, httpStatus: lp.httpStatus } });
      return apiError(lp.error || "Provider declined", 502, { data: { reference: ref, status: "failed" } });
    }

    // ═══ Admin-only endpoints ═══
    if (["admin-adjust-balance", "reset-user-password", "impersonate-user", "set-withdrawal-limit"].includes(action)) {
      const authResult = await authenticateRequest(req, body, supabase);
      if (!authResult.userId) return apiError(authResult.error || "Auth required", 401);
      const { data: callerProfile } = await supabase.from("profiles").select("role, full_name").eq("id", authResult.userId).maybeSingle();
      if (!callerProfile || callerProfile.role !== "admin") return apiError("Admin only", 403);

      if (action === "set-withdrawal-limit") {
        const { target_user_id, daily_limit, withdrawals_enabled } = body;
        if (!target_user_id) return apiError("Missing target_user_id");
        const limitVal = (daily_limit === null || daily_limit === undefined || daily_limit === "") ? null : Number(daily_limit);
        const { data: targetProfile } = await supabase.from("profiles").select("full_name, email").eq("id", target_user_id).maybeSingle();
        if (!targetProfile) return apiError("Target user not found", 404);
        const updateFields: Record<string, any> = { daily_withdrawal_limit: limitVal, last_24h_withdrawal_total: 0, last_withdrawal_reset_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        if (withdrawals_enabled !== undefined && withdrawals_enabled !== null) updateFields.withdrawals_enabled = withdrawals_enabled === true || withdrawals_enabled === "true";
        const { data: existingWallet } = await supabase.from("merchant_wallets").select("id").eq("user_id", target_user_id).maybeSingle();
        if (existingWallet) { await supabase.from("merchant_wallets").update(updateFields).eq("user_id", target_user_id); }
        else { await supabase.from("merchant_wallets").insert({ user_id: target_user_id, available_balance: 0, currency: "UGX", ...updateFields, created_at: new Date().toISOString() }); }
        return apiSuccess({ target_user_id, daily_withdrawal_limit: limitVal, message: limitVal === null ? "Limit removed (unlimited)" : `Limit set to ${limitVal?.toLocaleString()} UGX/day` });
      }
      if (action === "admin-adjust-balance") {
        const { target_user_id, adjustment_type, amount: rawAmount, note } = body;
        if (!target_user_id || !adjustment_type || rawAmount == null) return apiError("Required: target_user_id, adjustment_type, amount");
        const adjAmount = Number(rawAmount);
        if (isNaN(adjAmount) || adjAmount <= 0) return apiError("Amount must be positive");
        if (adjustment_type !== "add" && adjustment_type !== "deduct") return apiError("adjustment_type must be add or deduct");
        const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance, total_collections, total_payouts, currency").eq("user_id", target_user_id).maybeSingle();
        const currentBal = Number(wallet?.available_balance || 0); const currentCol = Number(wallet?.total_collections || 0); const currentPay = Number(wallet?.total_payouts || 0); const currency = wallet?.currency || "UGX";
        if (adjustment_type === "deduct" && adjAmount > currentBal) return apiError(`Insufficient balance: ${currentBal} ${currency}`);
        const newBal = adjustment_type === "add" ? currentBal + adjAmount : currentBal - adjAmount;
        if (wallet) { await supabase.from("merchant_wallets").update({ available_balance: newBal, total_collections: adjustment_type === "add" ? currentCol + adjAmount : currentCol, total_payouts: adjustment_type === "deduct" ? currentPay + adjAmount : currentPay, updated_at: new Date().toISOString() }).eq("user_id", target_user_id); }
        else { await supabase.from("merchant_wallets").insert({ user_id: target_user_id, currency, available_balance: newBal, total_collections: adjustment_type === "add" ? adjAmount : 0, total_payouts: adjustment_type === "deduct" ? adjAmount : 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); }
        const ref = `ADMIN_${adjustment_type.toUpperCase()}_${Date.now()}`;
        await supabase.from("transactions").insert({ user_id: target_user_id, reference: ref, amount: adjAmount, currency, status: "success", type: adjustment_type === "add" ? "collection" : "payout", customer_name: adjustment_type === "add" ? "Admin Credit" : "Admin Debit", description: note || `Admin balance adjustment (${adjustment_type})`, fee_amount: 0, net_amount: adjAmount, completed_at: new Date().toISOString() });
        return apiSuccess({ target_user_id, adjustment_type, amount: adjAmount, previous_balance: currentBal, new_balance: newBal, currency });
      }
      if (action === "reset-user-password") {
        const { target_user_id, new_password } = body;
        if (!target_user_id) return apiError("Missing target_user_id");
        if (!new_password || new_password.length < 6) return apiError("Password must be 6+ chars");
        const { error: updateErr } = await supabase.auth.admin.updateUserById(target_user_id, { password: new_password });
        if (updateErr) return apiError(updateErr.message, 500);
        return apiSuccess({ message: "Password updated" });
      }
      if (action === "impersonate-user") {
        const { target_user_id } = body;
        if (!target_user_id) return apiError("Missing target_user_id");
        const { data: { user: targetUser }, error: userErr } = await supabase.auth.admin.getUserById(target_user_id);
        if (userErr || !targetUser?.email) return apiError("Target user not found", 404);
        const origin = req.headers.get("origin") || "";
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({ type: "magiclink", email: targetUser.email, options: { redirectTo: `${origin}/dashboard` } });
        if (linkErr) return apiError("Failed to generate magic link: " + linkErr.message, 500);
        return apiSuccess({ login_url: linkData.properties?.action_link || "", target_user: { id: target_user_id, email: targetUser.email, role: "unknown" } });
      }
    }

    // ═══ Authenticated merchant endpoints ═══
    const { userId, error: authError, authMethod } = await authenticateRequest(req, body, supabase);
    if (!userId) return apiError(authError || "Authentication required", 401, { auth_method: authMethod });

    // ─── COLLECT ──────────────────────────────────────────────────────
    if (action === "collect") {
      const { phoneNumber, amount, currency, reference, description, customerName, network } = body;
      if (!phoneNumber || !amount || !currency) return apiError("Required: phoneNumber, amount, currency");
      if (typeof amount !== "number" || amount <= 0) return apiError("Amount must be a positive number");
      const ref = (reference || `COL${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
      const { data: existing } = await supabase.from("transactions").select("id").eq("reference", ref).maybeSingle();
      if (existing) return apiError(`Reference "${ref}" already used`);
      const txnId = crypto.randomUUID();
      const { key, secret, auth } = await getMarzCreds(supabase, userId);
      if (!key || !secret) {
        await supabase.from("transactions").insert({ id: txnId, user_id: userId, reference: ref, type: "collection", amount, currency, status: "pending", customer_phone: phoneNumber, metadata: { note: "No provider key configured" } });
        return apiError("MarzPay API key and secret are not configured. Go to Settings → Payment Provider.", 503, { data: { reference: ref, transaction_id: txnId, status: "pending" } });
      }
      const lp = await marzCollect(auth!, { phoneNumber, amount, currency, reference: ref, description: description || "Collection via ObPay", network });
      if (lp.ok && lp.data) {
        const lpRef = lp.data.reference || "";
        const internalRef = lp.data.internal_reference || "";
        await supabase.from("transactions").insert({ id: txnId, user_id: userId, reference: ref, type: "collection", amount, currency, status: "pending", customer_phone: phoneNumber, customer_name: customerName || "", description: description || "", merchant_reference: lpRef, metadata: { lp_reference: lpRef, lp_internal_ref: internalRef, network: lp.data.network || mapNetwork(network) || "" }, created_at: new Date().toISOString() });
        dispatchMerchantWebhooks(supabase, userId, "payment.initiated", { transaction_id: txnId, reference: ref, status: "pending", amount, currency });
        schedulePostCollectSync(supabase, txnId, auth!);
        return apiSuccess({ transaction_id: txnId, reference: ref, lp_reference: lpRef, internal_reference: internalRef, status: "pending", amount, currency, network: lp.data.network || mapNetwork(network) || "", message: lp.data.message || "Collection request sent", redirect_url: lp.data.redirect_url || "", success: true });
      }
      await supabase.from("transactions").insert({ id: txnId, user_id: userId, reference: ref, type: "collection", amount, currency, status: "failed", customer_phone: phoneNumber, metadata: { error: lp.error, httpStatus: lp.httpStatus, providerResponse: lp.data } });
      return apiError(lp.error || "Provider declined", 502, { data: { reference: ref, transaction_id: txnId, status: "failed", providerResponse: lp.data, httpStatus: lp.httpStatus, usedKeyHint: redactKey(key) } });
    }

    // ─── PAYOUT ───────────────────────────────────────────────────────
    if (action === "payout") {
      const { phoneNumber, amount, currency, reference, description, payout_type, network } = body;
      if (!phoneNumber || !amount || !currency) return apiError("Required: phoneNumber, amount, currency");
      const { data: walletEnabledCheck } = await supabase.from("merchant_wallets").select("withdrawals_enabled").eq("user_id", userId).maybeSingle();
      if (walletEnabledCheck && walletEnabledCheck.withdrawals_enabled === false) return apiError("Withdrawals are currently disabled on your account. Please contact support.", 403, { withdrawals_disabled: true });
      if (payout_type === "withdraw") {
        const limitCheck = await checkWithdrawalLimit(supabase, userId, Number(amount));
        if (!limitCheck.allowed) return apiError(limitCheck.error!, 400, { daily_limit: limitCheck.limit, remaining: limitCheck.remaining });
      }
      const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance").eq("user_id", userId).maybeSingle();
      const { data: psData } = await supabase.from("platform_settings").select("payout_flat_fee, withdraw_fee_percent").limit(1).maybeSingle();
      const isWithdraw = payout_type === "withdraw";
      const estimatedFee = isWithdraw ? Math.round(Number(amount) * (Number(psData?.withdraw_fee_percent || 9) / 100)) : Number(psData?.payout_flat_fee || 1020);
      const totalDeduction = Number(amount) + estimatedFee;
      if (!wallet || (wallet.available_balance || 0) < totalDeduction) return apiError("Insufficient balance", 400);
      const ref = (reference || `PAY${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
      const txnId = crypto.randomUUID();
      const { key, secret, auth } = await getMarzCreds(supabase, userId);
      if (!key || !secret) {
        const prid = crypto.randomUUID();
        await supabase.from("payout_requests").insert({ id: prid, user_id: userId, amount, currency, phone_number: phoneNumber, network: mapNetwork(network) || "MTN", status: "pending", fee_amount: estimatedFee, requested_at: new Date().toISOString() });
        await supabase.from("transactions").insert({ id: txnId, user_id: userId, reference: ref, type: "payout", amount, currency, status: "pending", customer_phone: phoneNumber, fee_amount: estimatedFee, metadata: { note: "No provider key" } });
        return apiError("Provider not configured", 503, { data: { reference: ref, transaction_id: txnId, status: "pending" } });
      }
      const lp = await marzSend(auth!, { phoneNumber, amount: Number(amount), currency, reference: ref, description: description || (isWithdraw ? "Withdrawal" : "Payout"), network });
      if (lp.ok && lp.data) {
        const lpRef = lp.data.reference || "";
        const internalRef = lp.data.internal_reference || "";
        const now = new Date().toISOString();
        const prid = crypto.randomUUID();
        await supabase.from("payout_requests").insert({ id: prid, user_id: userId, amount, currency, phone_number: phoneNumber, network: mapNetwork(network) || "MTN", status: "completed", fee_amount: estimatedFee, provider_reference: lpRef, requested_at: now, processed_at: now, completed_at: now });
        await supabase.from("transactions").insert({ id: txnId, user_id: userId, reference: ref, type: "payout", amount, currency, status: "success", customer_phone: phoneNumber, provider_reference: lpRef, fee_amount: estimatedFee, net_amount: Number(amount), completed_at: now, metadata: { lp_reference: lpRef, lp_internal_ref: internalRef, payout_type } });
        await supabase.from("merchant_wallets").update({ available_balance: (wallet.available_balance || 0) - totalDeduction, total_payouts: Number(wallet?.total_payouts || 0) + Number(amount), updated_at: now }).eq("user_id", userId);
        if (payout_type === "withdraw") await recordWithdrawal(supabase, userId, Number(amount));
        dispatchMerchantWebhooks(supabase, userId, "payout.success", { transaction_id: txnId, reference: ref, status: "success", amount, currency, fee_amount: estimatedFee, total_deducted: totalDeduction, recipient_phone: phoneNumber, completed_at: now });
        return apiSuccess({ transaction_id: txnId, reference: ref, lp_reference: lpRef, status: "completed", amount, currency, fee_amount: estimatedFee, total_deducted: totalDeduction });
      }
      const prid = crypto.randomUUID();
      await supabase.from("payout_requests").insert({ id: prid, user_id: userId, amount, currency, phone_number: phoneNumber, network: mapNetwork(network) || "MTN", status: "failed", fee_amount: estimatedFee, rejection_reason: lp.error, requested_at: new Date().toISOString() });
      await supabase.from("transactions").insert({ id: txnId, user_id: userId, reference: ref, type: "payout", amount, currency, status: "failed", customer_phone: phoneNumber, fee_amount: estimatedFee, metadata: { error: lp.error, httpStatus: lp.httpStatus } });
      return apiError(lp.error || "Provider declined", 502, { data: { reference: ref, transaction_id: txnId, status: "failed" } });
    }

    // ─── BALANCE ──────────────────────────────────────────────────────
    if (action === "balance") {
      const { data: wallet } = await supabase.from("merchant_wallets").select("*").eq("user_id", userId).maybeSingle();
      let providerBalance: any = null;
      const { key, secret, auth } = await getMarzCreds(supabase, userId);
      if (key && secret) { const res = await marzBalance(auth!); if (res.ok) providerBalance = res.data; }
      const now = new Date();
      if (wallet?.daily_withdrawal_limit && Number(wallet.daily_withdrawal_limit) > 0) {
        const resetAt = wallet.last_withdrawal_reset_at ? new Date(wallet.last_withdrawal_reset_at) : new Date(0);
        if ((now.getTime() - resetAt.getTime()) / (1000 * 60 * 60) >= 24) await supabase.from("merchant_wallets").update({ last_24h_withdrawal_total: 0, last_withdrawal_reset_at: now.toISOString() }).eq("user_id", userId);
      }
      return apiSuccess({ available_balance: wallet?.available_balance || 0, pending_balance: wallet?.pending_balance || 0, total_collections: wallet?.total_collections || 0, total_payouts: wallet?.total_payouts || 0, currency: wallet?.currency || "UGX", provider_balance: providerBalance, withdrawals_enabled: wallet?.withdrawals_enabled !== false, withdrawal_limits: wallet?.daily_withdrawal_limit ? { daily_limit: Number(wallet.daily_withdrawal_limit), used_24h: Number(wallet.last_24h_withdrawal_total || 0), remaining: Math.max(0, Number(wallet.daily_withdrawal_limit) - Number(wallet.last_24h_withdrawal_total || 0)) } : null });
    }

    // ─── TEST CONNECTION / TEST WEBHOOK / TRANSACTION STATUS / SYNC / LIST ───
    if (action === "test-connection") {
      const { key, secret, source, auth } = await getMarzCreds(supabase, userId);
      if (!key) return apiSuccess({ status: "disconnected", error: "No MarzPay API key configured.", keySource: source });
      if (!secret) return apiSuccess({ status: "partial", error: "MarzPay API secret not configured.", keySource: source });
      const res = await marzBalance(auth!);
      if (!res.ok && isIpWhitelistError(res)) {
        // Balance is IP-restricted on MarzPay's side; prove the credentials with an
        // endpoint that is not IP-restricted so the merchant is not shown as offline.
        const probe = await marzVerifyPhone(auth!, "+256777123456");
        if (probe.ok) {
          return apiSuccess({
            status: "connected", provider: "marzpay", keySource: source, balance: null,
            error: null, balance_restricted: true,
            note: "Connected. MarzPay restricts the balance endpoint to whitelisted IPs, so live balance is hidden — collections, payouts and transaction status work normally.",
            timestamp: new Date().toISOString(),
          });
        }
      }
      return apiSuccess({ status: res.ok ? "connected" : "error", provider: "marzpay", keySource: source, balance: res.data || null, error: res.error || null, timestamp: new Date().toISOString() });
    }


    if (action === "test-webhook") {
      const testPayload = { transaction_id: `test_${crypto.randomUUID().slice(0, 8)}`, reference: `TEST_${Date.now().toString(36).toUpperCase()}`, status: "success", amount: 5000, currency: "UGX", type: "collection", fee_amount: 250, net_amount: 4750, customer_phone: "256700000001", customer_name: "Test Customer", description: "OBPay Webhook Test", completed_at: new Date().toISOString(), is_test: true };
      const { data: configs } = await supabase.from("webhook_configs").select("id, webhook_url, webhook_secret, is_active").eq("user_id", userId).eq("is_active", true);
      if (!configs || configs.length === 0) return apiSuccess({ message: "No active webhook endpoints configured.", tested: 0, results: [] });
      const results: any[] = [];
      for (const cfg of configs) {
        const wp = { event: "payment.success", data: testPayload, timestamp: new Date().toISOString() };
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json", "X-ObPay-Event": "payment.success", "User-Agent": "OBPay-Webhook-Test/5.6" };
          if (cfg.webhook_secret) {
            const encoder = new TextEncoder();
            const kd = await crypto.subtle.importKey("raw", encoder.encode(cfg.webhook_secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
            const sig = await crypto.subtle.sign("HMAC", kd, encoder.encode(JSON.stringify(wp)));
            headers["X-ObPay-Signature"] = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
          }
          const resp = await fetch(cfg.webhook_url, { method: "POST", headers, body: JSON.stringify(wp), signal: AbortSignal.timeout(10000) });
          const responseText = await resp.text();
          results.push({ webhook_id: cfg.id, webhook_url: cfg.webhook_url, status_code: resp.status, ok: resp.ok, response_body: responseText.slice(0, 500) });
          await supabase.from("webhook_logs").insert({ user_id: userId, event_type: "test.payment.success", status: resp.ok ? "delivered" : "failed", attempts: 1, response_code: resp.status, payload: wp });
        } catch (err: any) { results.push({ webhook_id: cfg.id, webhook_url: cfg.webhook_url, status_code: 0, ok: false, error: err.message }); }
      }
      const allOk = results.every((r: any) => r.ok);
      return apiSuccess({ message: allOk ? `All ${results.length} webhook(s) OK` : `${results.filter((r: any) => r.ok).length}/${results.length} OK`, tested: results.length, all_ok: allOk, results });
    }

    if (action === "transaction-status" || action === "check-transaction") {
      const ref = body.reference;
      if (!ref) return apiError("Missing reference");
      const { data: txn } = await supabase.from("transactions").select("*").eq("reference", ref).eq("user_id", userId).maybeSingle();
      if (!txn) return apiError(`Transaction "${ref}" not found`, 404);
      if (txn.status === "pending") {
        const { key, secret, auth } = await getMarzCreds(supabase, userId);
        if (key && secret) {
          const syncResult = await autoSyncTransaction(supabase, txn, auth!);
          if (syncResult.synced) {
            const { data: refreshed } = await supabase.from("transactions").select("*").eq("id", txn.id).maybeSingle();
            if (refreshed) return apiSuccess({ id: refreshed.id, reference: refreshed.reference, status: refreshed.status, amount: refreshed.amount, currency: refreshed.currency, fee_amount: refreshed.fee_amount || 0, net_amount: refreshed.net_amount || refreshed.amount, created_at: refreshed.created_at, completed_at: refreshed.completed_at, auto_synced: true, previous_status: "pending" });
          }
        }
      }
      return apiSuccess({ id: txn.id, reference: txn.reference, status: txn.status, amount: txn.amount, currency: txn.currency, fee_amount: txn.fee_amount || 0, net_amount: txn.net_amount || txn.amount, created_at: txn.created_at, completed_at: txn.completed_at, auto_synced: false });
    }

    if (action === "sync-all-pending") {
      const { data: pendingTxns } = await supabase.from("transactions").select("id, user_id, reference, merchant_reference, amount, currency, type, status, created_at, metadata, fee_amount").eq("user_id", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(100);
      if (!pendingTxns || pendingTxns.length === 0) return apiSuccess({ synced: 0, total_pending: 0, duration_ms: Date.now() - startTime });
      const { key, secret, auth } = await getMarzCreds(supabase, userId);
      if (!key || !secret) return apiError("Provider not configured", 503);
      const results = (await Promise.all(pendingTxns.map((txn: any) => autoSyncTransaction(supabase, txn, auth!)))).filter((r: any) => r.synced);
      return apiSuccess({ synced: results.length, total_pending: pendingTxns.length, duration_ms: Date.now() - startTime, updated: results });
    }

    if (action === "sync-all-pending-admin") {
      const { data: pendingTxns } = await supabase.from("transactions").select("id, user_id, reference, merchant_reference, amount, currency, type, status, created_at, metadata, fee_amount").eq("status", "pending").order("created_at", { ascending: false }).limit(200);
      if (!pendingTxns || pendingTxns.length === 0) return apiSuccess({ total_pending: 0, synced: 0, duration_ms: Date.now() - startTime });
      const { key, secret, auth } = await getMarzCreds(supabase);
      if (!key || !secret) return apiError("Provider not configured", 503);
      const results = (await Promise.all(pendingTxns.map((txn: any) => autoSyncTransaction(supabase, txn, auth!)))).filter((r: any) => r.synced);
      return apiSuccess({ total_pending: pendingTxns.length, synced: results.length, duration_ms: Date.now() - startTime });
    }

    if (action === "list-transactions") {
      const type = body.type || "all"; const limit = Math.min(body.limit || 50, 200);
      let q = supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
      if (type !== "all") q = q.eq("type", type);
      const { data: txns } = await q;
      return apiSuccess({ transactions: txns || [], count: (txns || []).length });
    }

    if (action === "list-payouts") {
      const limit = Math.min(body.limit || 50, 200);
      const { data: payouts } = await supabase.from("payout_requests").select("*").eq("user_id", userId).order("requested_at", { ascending: false }).limit(limit);
      return apiSuccess({ payouts: payouts || [], count: (payouts || []).length });
    }

    return apiError(`Unknown action: "${action}"`, 400);
  } catch (err: any) {
    console.error(`[ObPay v5.6][${requestId}] FATAL:`, err.message);
    return apiError(`Internal error: ${err.message}`, 500);
  }
});
