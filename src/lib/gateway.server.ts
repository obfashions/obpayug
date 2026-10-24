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
    // A POST can reach the partner even if its response is lost. Never repeat
    // money-moving requests automatically; only read-only lookups may retry.
    if (request.method === "GET" && !res.ok && [0, 429, 502, 503, 504].includes(res.httpStatus)) {
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
  if (/^07[045]/.test(prefix)) {
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

  if (["whole_amount_required", "below_minimum", "fee_unavailable"].includes(code)) return raw;
  if (isIpBlocked(res)) {
    return `This ${kind} could not be sent because this server's network address is not approved. ObPay support has been notified — please try again shortly.`;
  }
  if (code === "limit_exceeded") return "This amount is above the allowed limit. Try a smaller amount.";
  if (http === 401) return "Payments are temporarily unavailable. Please contact ObPay support.";
  if (http === 409) return "This reference has already been used. Use a new reference.";
  if (http === 429) return "Too many requests right now. Please wait a minute and try again.";
  // The partner's own float is too low for this payout — this is not the
  // merchant's balance. Give a message that does not blame the merchant.
  if (kind === "payout" && /amount exceeds your available/i.test(raw)) {
    return "This withdrawal is temporarily above what the payment network can pay out right now. Please try a smaller amount or try again later — ObPay support has been notified.";
  }
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
  /** UGX (default), KES, RWF or USD. */
  currency?: string;
  /** KES only: "airtel_money" skips the M-Pesa prompt. */
  network?: string;
  /** Send the payer to the crypto checkout. */
  crypto?: boolean;
}

/**
 * Creates the payment and immediately sends the PIN prompt to the payer's
 * phone. `checkoutUrl` is only returned as a fallback when the prompt could
 * not be sent, so the payer normally never leaves ObPay.
 */
export async function gatewayCollect(creds: GatewayCreds, req: CollectionRequest) {
  const { tagDescription, tagMetadata } = await import("./merchant-identity.server");
  const { intlPhone } = await import("./countries");
  const currency = String(req.currency || "UGX").toUpperCase();
  const phone = currency === "USD" ? "" : intlPhone(req.phone, currency);
  const body: Record<string, unknown> = {
    amount: currency === "USD" ? Math.round(req.amount * 100) / 100 : Math.round(req.amount),
    currency,
    reference: req.reference,
    description: tagDescription(req.merchant, String(req.description || req.reference)),
    customer: {
      email: req.customerEmail || "payments@obpay.online",
      name: (req.customerName || "ObPay customer").slice(0, 64),
      ...(phone ? { phone } : {}),
    },
    callback_url: req.notifyUrl || callbackUrl(),
    ...(currency === "KES" ? { stk_push: req.network !== "airtel_money" } : {}),
    ...(req.redirectUrl ? { redirect_url: req.redirectUrl, cancel_url: req.redirectUrl } : {}),
    metadata: { ...tagMetadata(req.merchant, req.channel || "dashboard"), obpay_reference: req.reference },
  };
  const res = await gatewayFetch(creds, "/api/v1/pay", { method: "POST", body });
  if (!res.ok) return { ok: false as const, res };

  const reference = String(res.data?.reference || req.reference);
  const cryptoUrl = String(res.data?.crypto_payment_url || "");
  let promptSent = false;
  let promptMessage = "";
  if (currency === "KES") {
    promptSent = res.data?.stk_sent === true;
  } else if (phone && !req.crypto) {
    // Same request the partner's own checkout page makes (number in
    // international format plus the two-letter country code).
    const country = currency === "UGX" ? "UG" : currency === "RWF" ? "RW" : undefined;
    const push = await gatewayFetch(creds, "/payment/pawapay-process", {
      method: "POST",
      auth: false,
      body: { reference, currency, phone, ...(country ? { country } : {}) },
    });
    promptSent = push.ok && (push.raw?.pending === true || push.raw?.success === true);
    promptMessage = scrub(String(push.raw?.message || push.error || ""));
    if (!promptSent) console.warn("[gateway] phone prompt not sent", reference, push.httpStatus, promptMessage);
  }

  return {
    ok: true as const,
    res,
    promptSent,
    promptMessage,
    platformReference: reference,
    cryptoUrl,
    checkoutUrl: req.crypto ? cryptoUrl : promptSent ? "" : String(res.data?.payment_url || ""),
  };
}

/** Records a refund with the partner (bookkeeping only — it moves no money). */
export async function gatewayRefund(creds: GatewayCreds, reference: string, amount?: number, reason?: string) {
  return gatewayFetch(creds, "/api/v1/refund", {
    method: "POST",
    body: { reference, ...(amount ? { amount } : {}), ...(reason ? { reason } : {}) },
  });
}

/** Payout rules (minimum, fee, methods) for one currency, live from the partner. */
export async function gatewayPayoutMethods(creds: GatewayCreds, currency: string) {
  const res = await gatewayFetch(creds, `/api/v1/payout-methods?currency=${encodeURIComponent(currency)}`);
  const pm = res.raw?.payout_methods || {};
  return {
    ok: res.ok,
    currency,
    available: res.ok && pm.available !== false && Array.isArray(pm.methods) && pm.methods.length > 0,
    minimum: Number(pm.minimum_withdrawal) || 0,
    fee: pm.fee || null,
    methods: (pm.methods || []).map((m: any) => ({ value: String(m.value), label: String(m.label) })),
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
  merchant?: import("./merchant-identity.server").MerchantTag;
  channel?: string;
  /** When true the partner fee is taken from `amount` instead of added on top. */
  feeInclusive?: boolean;
  /** ObPay's own fee, kept back from `amount` before the rest is sent to the partner. */
  platformFee?: number;
  /** Used to explain the minimum entered amount after ObPay's rounded fee. */
  platformFeePercent?: number;
  /** UGX (default), KES or RWF. */
  currency?: string;
  /** KES: mpesa / airtel_money. */
  network?: string;
}

const payoutRuleCache = new Map<string, { at: number; min: number; percent: number; floor: number; flat: number }>();
async function payoutRules(creds: GatewayCreds, currency = "UGX") {
  const cacheKey = `${creds.key}:${currency}`;
  const hit = payoutRuleCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
  const res = await gatewayFetch(creds, `/api/v1/payout-methods?currency=${currency}`);
  if (!res.ok || !res.raw?.payout_methods?.fee) return null;
  const pm = res.raw?.payout_methods || {};
  const fee = pm.fee || {};
  if (pm.available === false || !["percent", "flat"].includes(fee.type) ||
      (fee.type === "percent" && (!Number.isFinite(Number(fee.percent)) || Number(fee.percent) < 0 || Number(fee.percent) >= 100)) ||
      (fee.type === "flat" && (!Number.isFinite(Number(fee.amount ?? fee.value)) || Number(fee.amount ?? fee.value) < 0)) ||
      (fee.floor != null && (!Number.isFinite(Number(fee.floor)) || Number(fee.floor) < 0))) return null;
  const rules = {
    at: Date.now(),
    min: Number(pm.minimum_withdrawal) || (currency === "UGX" ? 10000 : 1),
    percent: fee.type === "percent" ? Number(fee.percent) || 0 : 0,
    floor: Number(fee.floor) || 0,
    flat: fee.type === "flat" ? Number(fee.amount ?? fee.value) || 0 : 0,
  };
  payoutRuleCache.set(cacheKey, rules);
  return rules;
}

/** Sends money to a mobile money wallet. */
export async function gatewayPayout(creds: GatewayCreds, req: PayoutRequest) {
  const currency = String(req.currency || "UGX").toUpperCase();
  if (req.typeTrans === 3) {
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 400, code: "bank_unsupported", data: null, raw: null, error: "Bank payouts are not available yet. Send to a mobile money number instead." } as GatewayResult,
    };
  }
  const { intlPhone, countryFor } = await import("./countries");
  const phone = intlPhone(req.accountNumber, currency);
  if (!phone) {
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 400, code: "bad_number", data: null, raw: null, error: `That mobile money number is not valid. Use the ${countryFor(currency)?.example || "07XXXXXXXX"} format.` } as GatewayResult,
    };
  }
  const rules = await payoutRules(creds, currency);
  if (!rules) {
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 503, code: "fee_unavailable", data: null, raw: null, error: "Withdrawal fees are temporarily unavailable. Please try again shortly." } as GatewayResult,
    };
  }
  let gross: number;
  let net: number;
  const platformFee = Math.max(Number(req.platformFee) || 0, 0);
  if (req.feeInclusive) {
    gross = req.amount - platformFee;
    const f = rules.flat ? rules.flat : rules.percent ? Math.max(gross * rules.percent / 100, rules.floor) : 0;
    net = gross - f;
    if (gross < rules.min || net <= 0) {
      const { minimumFeeInclusivePayout } = await import("./platform-fees");
      const enteredMinimum = req.platformFeePercent == null
        ? rules.min + platformFee
        : minimumFeeInclusivePayout(rules.min, currency, req.platformFeePercent);
      const minimumMessage = enteredMinimum == null
        ? "The configured withdrawal fee leaves no money to send. Contact ObPay support."
        : `Enter at least ${currency} ${enteredMinimum.toLocaleString("en")}. The payment network requires ${currency} ${rules.min.toLocaleString("en")} after ObPay's withdrawal fee; its own fee is then deducted. No money was sent.`;
      return {
        ok: false as const,
        res: { ok: false, httpStatus: 400, code: "below_minimum", data: null, raw: null, error: minimumMessage } as GatewayResult,
      };
    }
  } else {
    net = req.amount;
    gross = net;
    if (rules.flat) gross = net + rules.flat;
    else if (rules.percent) gross = Math.max(net / (1 - rules.percent / 100), net + rules.floor);
    if (gross < rules.min) {
      return {
        ok: false as const,
        res: { ok: false, httpStatus: 400, code: "below_minimum", data: null, raw: null, error: `The minimum payout is ${currency} ${Math.max(rules.min - (gross - net), 1).toLocaleString("en")}.` } as GatewayResult,
      };
    }
  }
  // The partner deducts its own percentage fee from the gross. Rounding the
  // fee locally does not change what its zero-decimal mobile-money rail sees.
  // Refuse incompatible amounts *before* making a money-moving request.
  if (!Number.isFinite(gross) || !Number.isFinite(net) || (currency === "UGX" || currency === "RWF") &&
      (!Number.isInteger(gross) || !Number.isInteger(net))) {
    const step = rules.percent ? (() => {
      const scaled = Math.round(rules.percent * 100);
      const denominator = 10000;
      let a = scaled, b = denominator;
      while (b) [a, b] = [b, a % b];
      return denominator / a;
    })() : 1;
    const next = Math.ceil((Math.floor(gross) + 1) / step) * step;
    const advice = `Enter a whole ${currency} amount. Once the percentage fee applies, use increments of ${step.toLocaleString("en")} (for example ${currency} ${next.toLocaleString("en")}).`;
    return {
      ok: false as const,
      res: { ok: false, httpStatus: 400, code: "whole_amount_required", data: null, raw: null,
        error: `This mobile-money withdrawal would result in a fractional ${currency} amount after the fee. ${advice} No money was sent.` } as GatewayResult,
    };
  }
  const method = currency === "KES" ? (req.network === "airtel_money" ? "airtel_money" : "mpesa") : "mobile_money";
  const { tagDescription, tagMetadata } = await import("./merchant-identity.server");
  const body = {
    amount: gross,
    currency,
    method,
    account_number: phone,
    account_name: (req.customerName || "ObPay recipient").slice(0, 64),
    reference: req.reference,
    description: tagDescription(req.merchant, String(req.remark || req.reference)),
    metadata: { ...tagMetadata(req.merchant, req.channel || "dashboard"), obpay_reference: req.reference },
  };
  const res = await gatewayFetch(creds, "/api/v1/payout", { method: "POST", body });
  if (!res.ok) return { ok: false as const, res };
  const payout = res.raw?.payout || res.data?.payout || {};
  return { ok: true as const, res, platformReference: String(payout.reference || ""), gross, net, partnerFee: gross - net, platformFee };
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
 * Exact live wallet balance per currency. The partner has no balance endpoint,
 * but an impossible payout amount is refused with "Amount exceeds your
 * available X balance of N" — no payout is created, so this is read-only.
 */
export async function gatewayLiveBalances(creds: GatewayCreds) {
  const out: Array<{ currency: string; available: number | null; note?: string }> = [];
  for (const currency of ["UGX", "KES", "RWF", "USD"]) {
    const res = await gatewayFetch(creds, "/api/v1/payout", {
      method: "POST",
      body: { amount: 999999999999, currency, method: "mobile_money", account_number: "0000", account_name: "Balance check" },
    });
    const msg = String(res.raw?.message || res.raw?.error || "");
    const m = msg.match(/balance of\s*([\d.,]+)/i);
    if (m) out.push({ currency, available: Number(m[1]!.replace(/,/g, "")) });
    else if (!res.ok) out.push({ currency, available: null, note: msg.slice(0, 120) || "Unavailable" });
  }
  return out;
}

/** Totals of the partner's payout fees, from its payout list. */
export async function gatewayCharges(creds: GatewayCreds) {
  const res = await gatewayFetch(creds, "/api/v1/payouts?limit=500");
  const list: any[] = Array.isArray(res.raw?.payouts) ? res.raw.payouts : [];
  const byCurrency: Record<string, { fees: number; count: number; paid: number }> = {};
  for (const p of list) {
    if (!["success", "completed", "paid", "pending", "processing"].includes(String(p.status))) continue;
    const c = String(p.currency || "UGX");
    const row = (byCurrency[c] ||= { fees: 0, count: 0, paid: 0 });
    row.fees += Number(p.fee) || 0;
    row.paid += Number(p.net_amount) || 0;
    row.count += 1;
  }
  return byCurrency;
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
  const url = (process.env["SUPABASE_URL"] || import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const anon = process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
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
