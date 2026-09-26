// Server-only payment gateway adapter.
//
// ObPay moves money through a single upstream payment partner. Everything about
// that partner is contained in this file: credentials, request format, wallet
// formats, and error translation. Nothing here is ever exposed to merchants or
// payers — the partner name only appears in the admin panel.
//
// Credentials come from the admin-managed store first (Admin → Gateway API) and
// fall back to this project's environment (PAYZA_PUBLIC_KEY / PAYZA_SECRET_KEY).

export const GATEWAY_CRED_ID = "payza";

export const GATEWAY_BASE = () =>
  (process.env["PAYZA_BASE_URL"] || "https://payzaapi.co.ke").trim().replace(/\/+$/, "");

/** `key` = public key (pk_...), `secret` = secret key (sk_...). */
export interface GatewayCreds {
  key: string;
  secret: string;
  basic: string;
}

function buildCreds(key: string, secret: string): GatewayCreds {
  return { key, secret, basic: btoa(`${key}:${secret}`) };
}

/** Splits a base64 "publicKey:secretKey" value. */
export function decodeBasic(basic: string): GatewayCreds | null {
  try {
    const decoded = atob(basic.trim());
    const idx = decoded.indexOf(":");
    if (idx > 0) {
      return { key: decoded.slice(0, idx).trim(), secret: decoded.slice(idx + 1).trim(), basic: basic.trim() };
    }
  } catch {
    /* not base64 */
  }
  return null;
}

/** Environment-only credentials (the built-in fallback). */
export function readEnvCreds(): GatewayCreds | null {
  const key = (process.env["PAYZA_PUBLIC_KEY"] || "").trim();
  const secret = (process.env["PAYZA_SECRET_KEY"] || "").replace(/\s+/g, "").trim();
  if (key && secret) return buildCreds(key, secret);
  return null;
}

/** Secret used to sign result notifications (separate from the API keys). */
export function webhookSecret(): string {
  return (process.env["PAYZA_WEBHOOK_SECRET"] || "").trim();
}

/* ── Admin-managed credential sets ──────────────────────────────────────── */

export interface StoredGatewayCred {
  id: string;
  label: string;
  key: string;
  secret: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

let credCache: { creds: GatewayCreds | null; source: "database" | "environment" | "none"; at: number } | null = null;
const CRED_TTL_MS = 15_000;

export function invalidateGatewayCredsCache() {
  credCache = null;
}

async function adminDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function listStoredGatewayCreds(): Promise<StoredGatewayCred[]> {
  try {
    const client = await adminDb();
    const { data } = await client
      .from("platform_credentials")
      .select("id, label, api_key, api_secret, enabled, updated_at, updated_by")
      .or(`id.eq.${GATEWAY_CRED_ID},id.like.${GATEWAY_CRED_ID}:%`)
      .order("created_at", { ascending: true });
    return ((data || []) as any[]).map((row) => ({
      id: String(row.id),
      label: String(row.label || "Gateway keys"),
      key: String(row.api_key || "").trim(),
      secret: String(row.api_secret || "").replace(/\s+/g, "").trim(),
      enabled: row.enabled === true,
      updatedAt: row.updated_at || null,
      updatedBy: row.updated_by || null,
    }));
  } catch {
    return [];
  }
}

export async function readStoredGatewayCreds(): Promise<{
  creds: GatewayCreds | null;
  enabled: boolean;
  id: string | null;
  label: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}> {
  const rows = await listStoredGatewayCreds();
  const active = rows.find((r) => r.enabled && r.key && r.secret);
  if (!active) return { creds: null, enabled: false, id: null, label: null, updatedAt: null, updatedBy: null };
  return {
    creds: buildCreds(active.key, active.secret),
    enabled: true,
    id: active.id,
    label: active.label,
    updatedAt: active.updatedAt,
    updatedBy: active.updatedBy,
  };
}

/** The credentials every gateway call must use: selected admin set first, env second. */
export async function getGatewayCreds(): Promise<GatewayCreds | null> {
  const now = Date.now();
  if (credCache && now - credCache.at < CRED_TTL_MS) return credCache.creds;

  const stored = await readStoredGatewayCreds();
  if (stored.creds) {
    credCache = { creds: stored.creds, source: "database", at: now };
    return stored.creds;
  }
  const env = readEnvCreds();
  credCache = { creds: env, source: env ? "environment" : "none", at: now };
  return env;
}

export async function gatewayCredsSource(): Promise<"database" | "environment" | "none"> {
  await getGatewayCreds();
  return credCache?.source || "none";
}

/* ── Static egress ──────────────────────────────────────────────────────────
 * The app runs on a serverless edge runtime whose outbound IP rotates, so a
 * partner IP allow-list can never be satisfied directly. When EGRESS_PROXY_URL
 * is configured every gateway call is tunnelled through that fixed-IP relay.
 * ------------------------------------------------------------------------- */

export function proxyConfig(): { url: string; token: string } | null {
  // The partner's IP allow-list is off, so calls go out directly. A relay can
  // still be forced with PAYZA_EGRESS_PROXY_URL if the allow-list is enabled.
  const url = (process.env["PAYZA_EGRESS_PROXY_URL"] || "").trim().replace(/\/+$/, "");
  if (!url) return null;
  return { url, token: (process.env["EGRESS_PROXY_TOKEN"] || "").trim() };
}

async function proxiedFetch(
  target: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<Response> {
  const proxy = proxyConfig();
  if (!proxy) return fetch(target, init);
  return fetch(proxy.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(proxy.token ? { "x-relay-token": proxy.token } : {}),
    },
    body: JSON.stringify({ url: target, method: init.method, headers: init.headers, body: init.body ?? null }),
  });
}

export interface GatewayResult {
  ok: boolean;
  httpStatus: number;
  code: string;
  data: any;
  raw: any;
  error?: string;
}

/** One gateway HTTP call. `ok` means the partner accepted the request. */
export async function gatewayFetch(
  creds: GatewayCreds,
  path: string,
  init?: { method?: string; body?: unknown; auth?: boolean },
): Promise<GatewayResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (init?.auth !== false) {
    headers["X-Public-Key"] = creds.key;
    headers["X-Secret-Key"] = creds.secret;
  }
  const request = {
    method: init?.method || "GET",
    headers,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  };

  const run = async (): Promise<GatewayResult> => {
    const target = `${GATEWAY_BASE()}${path}`;
    const resp = proxyConfig() ? await proxiedFetch(target, request) : await fetch(target, request);
    const text = await resp.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 300) };
    }
    const ok = resp.ok && body?.success !== false && !body?.raw;
    return {
      ok,
      httpStatus: resp.status,
      code: String(body?.error_code || (ok ? "200" : resp.status)),
      data: body?.data ?? body ?? null,
      raw: body,
      error: ok ? undefined : scrub(String(body?.message || body?.error || `HTTP ${resp.status}`)),
    };
  };

  try {
    let res = await run();
    // Temporary network / rate problems are safe to retry once before any money moves.
    if (!res.ok && [0, 429, 502, 503, 504].includes(res.httpStatus)) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await run();
    }
    if (!res.ok && isIpBlocked(res)) {
      void import("./egress-monitor.server").then((m) => m.noteIpBlocked()).catch(() => {});
    }
    return res;
  } catch (err: any) {
    return { ok: false, httpStatus: 0, code: "0", data: null, raw: null, error: err?.message || "Network error" };
  }
}

/** Removes the partner's name from any message that could reach a merchant. */
function scrub(msg: string): string {
  return msg
    .replace(/payza\s*api|payzaapi|payza/gi, "ObPay")
    .replace(/https?:\/\/\S+/g, "")
    .trim();
}

/** Ugandan number in international format (2567XXXXXXXX) for the partner. */
export function intlNumber(raw: unknown): string {
  const w = walletNumber(raw);
  return w ? `256${w.slice(1)}` : "";
}

/* ── Formats ────────────────────────────────────────────────────────────── */

/**
 * Uganda wallet number format: `0` + 9-digit local number (10 characters,
 * digits only). Accepts +256…, 256…, 07…, 7… and normalises all of them.
 */
export function walletNumber(raw: unknown): string {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("256")) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  if (digits.length !== 9) return "";
  return `0${digits}`;
}

/** Mobile money / bank codes used by the gateway. */
export const MTN_CODE = "UG0030";
export const AIRTEL_CODE = "UG0031";

export const UG_BANKS: { code: string; name: string }[] = [
  { code: "UG0001", name: "Absa Bank Uganda Limited" },
  { code: "UG0002", name: "Bank of Africa Uganda Limited" },
  { code: "UG0003", name: "BRAC Uganda Bank Limited" },
  { code: "UG0004", name: "Centenary Bank" },
  { code: "UG0005", name: "Cairo Bank Uganda" },
  { code: "UG0006", name: "DFCU Bank" },
  { code: "UG0007", name: "Diamond Trust Bank" },
  { code: "UG0008", name: "Equity Bank Uganda Limited" },
  { code: "UG0009", name: "Ecobank Uganda" },
  { code: "UG0010", name: "Exim Bank (Uganda)" },
  { code: "UG0011", name: "EFC Uganda Limited" },
  { code: "UG0012", name: "Finance Trust Bank" },
  { code: "UG0013", name: "FINCA Uganda" },
  { code: "UG0014", name: "Guaranty Trust Bank Uganda" },
  { code: "UG0015", name: "Housing Finance Bank" },
  { code: "UG0016", name: "I&M Bank Uganda" },
  { code: "UG0017", name: "KCB Bank Uganda Limited" },
  { code: "UG0018", name: "Mercantile Credit Bank" },
  { code: "UG0019", name: "NCBA Bank Uganda" },
  { code: "UG0020", name: "Opportunity Bank Uganda Limited" },
  { code: "UG0021", name: "Pride Microfinance Ltd" },
  { code: "UG0022", name: "PostBank Uganda" },
  { code: "UG0023", name: "Stanbic Bank Uganda Limited" },
  { code: "UG0024", name: "Standard Chartered Uganda" },
  { code: "UG0025", name: "Tropical Bank" },
  { code: "UG0026", name: "Salaam Bank Uganda" },
  { code: "UG0027", name: "UGAFODE Microfinance Limited" },
  { code: "UG0028", name: "United Bank for Africa" },
  { code: "UG0029", name: "Wazalendo SACCO" },
];

export const MOBILE_NETWORKS: { code: string; name: string }[] = [
  { code: MTN_CODE, name: "MTN Mobile Money" },
  { code: AIRTEL_CODE, name: "Airtel Money" },
];

/** Guesses the mobile money network from a Ugandan number, MTN by default. */
export function networkCode(network?: string, phone?: string): string {
  const n = (network || "").toLowerCase();
  if (n.includes("airtel")) return AIRTEL_CODE;
  if (n.includes("mtn")) return MTN_CODE;
  if (/^ug00\d\d$/i.test(network || "")) return (network as string).toUpperCase();

  const w = walletNumber(phone);
  const prefix = w.slice(0, 4); // 07xx
  if (["0700", "0701", "0702", "0703", "0704", "0705", "0740", "0741", "0742", "0743", "0744", "0745", "0746", "0747", "0748", "0749", "0750", "0751", "0752", "0753", "0754", "0755", "0756", "0757", "0758"].includes(prefix)) {
    return AIRTEL_CODE;
  }
  return MTN_CODE;
}

export function bankName(code: string): string {
  const all = [...UG_BANKS, ...MOBILE_NETWORKS];
  return all.find((b) => b.code === String(code || "").toUpperCase())?.name || String(code || "");
}

/** Gateway statuses → ObPay statuses. */
export function mapStatus(raw: string): "pending" | "success" | "failed" | null {
  const s = String(raw || "").toUpperCase().trim();
  if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(s)) return "success";
  if (["FAILED", "FAILURE", "REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "REVERSED", "DECLINED"].includes(s)) return "failed";
  if (["PROCESSING", "PENDING", "INITIATED", "IN_PROGRESS", "APPROVED"].includes(s)) return "pending";
  return null;
}

/** True when the partner refused us because this server's IP is not approved. */
export function isIpBlocked(res: { code?: string; error?: string }): boolean {
  if (String(res?.code || "") === "ip_not_allowed") return true;
  return /isn't on your ip whitelist|ip whitelist|not whitelisted/i.test(res?.error || "");
}

/**
 * Turns partner errors into something a merchant can act on, without ever
 * naming the partner.
 */
export function friendlyError(
  res: { code?: string; error?: string; httpStatus?: number },
  kind: "collection" | "payout" | "request" = "request",
): string {
  const code = String(res?.code || "");
  const raw = String(res?.error || "");
  const http = Number((res as any)?.httpStatus || 0);

  if (isIpBlocked(res)) {
    return `This ${kind} could not be sent because this server's network address is not approved. ObPay support has been notified — please try again shortly.`;
  }
  if (code === "limit_exceeded") return "This amount is above the allowed limit. Try a smaller amount.";
  if (http === 401) return "Payments are temporarily unavailable. Please contact ObPay support.";
  if (http === 409) return "This reference has already been used. Use a new reference.";
  if (http === 429) return "Too many requests right now. Please wait a minute and try again.";
  if (http >= 500 || http === 0) return "The payment network is busy. Please try again in a moment.";
  return raw || `The ${kind} could not be processed. Please try again.`;
}

/* ── Money movement ─────────────────────────────────────────────────────── */

export interface CollectionRequest {
  reference: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  phone?: string;
  bankCode?: string;
  description?: string;
  redirectUrl?: string;
  notifyUrl?: string;
  merchant?: import("./merchant-identity.server").MerchantTag;
  channel?: string;
}

/**
 * Creates the payment and immediately sends the PIN prompt to the payer's
 * phone. `checkoutUrl` is only returned as a fallback when the prompt could
 * not be sent, so the payer normally never leaves ObPay.
 */
export async function gatewayCollect(creds: GatewayCreds, req: CollectionRequest) {
  const { tagDescription, tagMetadata } = await import("./merchant-identity.server");
  const phone = intlNumber(req.phone);
  const body: Record<string, unknown> = {
    amount: Math.round(req.amount),
    currency: "UGX",
    reference: req.reference,
    description: tagDescription(req.merchant, String(req.description || req.reference)),
    customer: {
      email: req.customerEmail || "payments@obpay.online",
      name: (req.customerName || "ObPay customer").slice(0, 64),
      ...(phone ? { phone } : {}),
    },
    callback_url: req.notifyUrl || callbackUrl(),
    ...(req.redirectUrl ? { redirect_url: req.redirectUrl, cancel_url: req.redirectUrl } : {}),
    metadata: { ...tagMetadata(req.merchant, req.channel || "dashboard"), obpay_reference: req.reference },
  };
  const res = await gatewayFetch(creds, "/api/v1/pay", { method: "POST", body });
  if (!res.ok) return { ok: false as const, res };

  const reference = String(res.data?.reference || req.reference);
  let promptSent = false;
  if (phone) {
    const push = await gatewayFetch(creds, "/payment/pawapay-process", {
      method: "POST",
      auth: false,
      body: { reference, currency: "UGX", phone },
    });
    promptSent = push.ok && (push.raw?.pending === true || push.raw?.success === true);
    if (!promptSent) console.warn("[gateway] phone prompt not sent", push.httpStatus, push.error);
  }

  return {
    ok: true as const,
    res,
    promptSent,
    platformReference: reference,
    checkoutUrl: promptSent ? "" : String(res.data?.payment_url || ""),
  };
}

/** Status of a collection, straight from the partner (checks the network live). */
export async function gatewayCollectionStatus(creds: GatewayCreds, reference: string) {
  const res = await gatewayFetch(creds, `/api/v1/verify/${encodeURIComponent(reference)}`);
  if (!res.ok) return { ok: false as const, res, status: null as null };
  return {
    ok: true as const,
    res,
    status: mapStatus(String(res.data?.status || "")),
    amount: Number(res.data?.amount) || 0,
    currency: String(res.data?.currency || ""),
  };
}

export interface PayoutRequest {
  reference: string;
  amount: number;
  /** 2 = mobile money wallet, 3 = bank account. */
  typeTrans: 2 | 3;
  bankCode: string;
  accountNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  remark?: string;
  notifyUrl?: string;
}

let payoutRuleCache: { at: number; min: number; percent: number; floor: number; flat: number } | null = null;
async function payoutRules(creds: GatewayCreds) {
  if (payoutRuleCache && Date.now() - payoutRuleCache.at < 10 * 60_000) return payoutRuleCache;
  const res = await gatewayFetch(creds, "/api/v1/payout-methods?currency=UGX");
  const pm = res.raw?.payout_methods || {};
  const fee = pm.fee || {};
  payoutRuleCache = {
    at: Date.now(),
    min: Number(pm.minimum_withdrawal) || 10000,
    percent: fee.type === "percent" ? Number(fee.percent) || 0 : 0,
    floor: Number(fee.floor) || 0,
    flat: fee.type === "flat" ? Number(fee.amount ?? fee.value) || 0 : 0,
  };
  return payoutRuleCache;
}

/** Sends money to a mobile money wallet. The recipient receives the full amount. */
export async function gatewayPayout(creds: GatewayCreds, req: PayoutRequest) {
  if (req.typeTrans === 3) {
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 400, code: "bank_unsupported", data: null, raw: null, error: "Bank payouts are not available in Uganda yet. Send to MTN or Airtel mobile money instead." } as GatewayResult,
    };
  }
  const phone = intlNumber(req.accountNumber);
  if (!phone) {
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 400, code: "bad_number", data: null, raw: null, error: "That mobile money number is not valid. Use the 07XXXXXXXX format." } as GatewayResult,
    };
  }
  const net = Math.round(req.amount);
  const rules = await payoutRules(creds);
  // Gross the request up so the partner's fee does not reduce what the recipient gets.
  let gross = net;
  if (rules.flat) gross = net + rules.flat;
  else if (rules.percent) gross = Math.max(Math.ceil(net / (1 - rules.percent / 100)), net + rules.floor);
  if (gross < rules.min) {
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 400, code: "below_minimum", data: null, raw: null, error: `The minimum payout is UGX ${Math.max(rules.min - (gross - net), 1).toLocaleString("en")}.` } as GatewayResult,
    };
  }
  const body = {
    amount: gross,
    currency: "UGX",
    method: "mobile_money",
    account_number: phone,
    account_name: (req.customerName || "ObPay recipient").slice(0, 64),
  };
  const res = await gatewayFetch(creds, "/api/v1/payout", { method: "POST", body });
  if (!res.ok) return { ok: false as const, res };
  const payout = res.raw?.payout || res.data?.payout || {};
  return { ok: true as const, res, platformReference: String(payout.reference || "") };
}

/** Current state of a payout, by the partner's reference. */
export async function gatewayPayoutStatus(
  creds: GatewayCreds,
  refs: { merchantReference?: string | null; platformReference?: string | null },
) {
  const ref = refs.platformReference || "";
  if (!ref) return { ok: false as const, res: null, status: null as null };
  const res = await gatewayFetch(creds, `/api/v1/payouts?reference=${encodeURIComponent(ref)}`);
  if (!res.ok) return { ok: false as const, res, status: null as null };
  const raw = res.raw || {};
  const p = raw.payout || (Array.isArray(raw.payouts) ? raw.payouts[0] : null) || raw.data || {};
  return {
    ok: true as const,
    res,
    status: mapStatus(String(p.status || "")),
    amount: Number(p.net_amount ?? p.amount) || 0,
    transferredAt: p.completed_at || p.updated_at || null,
    platformReference: p.reference || ref,
    reason: p.note || p.admin_note || p.reason || null,
  };
}

/**
 * Connectivity check. The partner exposes no balance endpoint, so this
 * confirms the keys work and reports payout rules instead of a float.
 */
export async function gatewayBalance(creds: GatewayCreds) {
  const res = await gatewayFetch(creds, "/api/v1/payout-methods?currency=UGX");
  if (!res.ok) return { ok: false as const, res, balance: null };
  const pm = res.raw?.payout_methods || {};
  return {
    ok: true as const,
    res,
    balance: {
      available: null as number | null,
      frozen: 0,
      in_transit: 0,
      currency: "UGX",
      payouts_available: pm.available !== false,
      minimum_payout: Number(pm.minimum_withdrawal) || null,
    },
  };
}

/* ── Callbacks ──────────────────────────────────────────────────────────── */

export function callbackUrl(): string {
  const base = (process.env["PUBLIC_SITE_URL"] || "https://obpay.online").trim().replace(/\/+$/, "");
  return `${base}/api/public/gateway-callback`;
}

/** HMAC-SHA256 of the RAW callback body, hex, compared to X-Payza-Signature. */
export async function verifyCallbackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!rawBody || !signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const given = signature.trim().toLowerCase().replace(/^sha256=/, "");
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/* ── Diagnostics ────────────────────────────────────────────────────────── */

let cachedIp: string | null = null;
export async function getEgressIp(): Promise<string | null> {
  if (cachedIp) return cachedIp;
  const ip = await probeEgressIp(!!proxyConfig());
  if (ip) cachedIp = ip;
  return cachedIp;
}

export async function probeEgressIp(useProxy: boolean): Promise<string | null> {
  try {
    const target = "https://api.ipify.org?format=json";
    const resp = useProxy
      ? await proxiedFetch(target, { method: "GET", headers: { Accept: "application/json" } })
      : await fetch(target);
    if (!resp.ok) return null;
    const text = await resp.text();
    const match = text.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

/** Verifies a Supabase access token and returns the user id (or null). */
export async function verifySupabaseUser(accessToken: string): Promise<string | null> {
  const url = (process.env["VITE_PUBLIC_SUPABASE_URL"] || import.meta.env.VITE_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = process.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] || import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!url || !anon || !accessToken) return null;
  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}`, apikey: anon },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return user?.id || null;
  } catch {
    return null;
  }
}
