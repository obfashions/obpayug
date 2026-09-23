// Server-only payment gateway adapter.
//
// ObPay moves money through a single upstream banking partner. Everything about
// that partner is contained in this file: credentials, request signing, wallet
// and bank formats, and error translation. Nothing here is ever exposed to
// merchants or payers — the partner name only appears in the admin panel.
//
// Credentials come from the admin-managed store first (Admin → Gateway API) and
// fall back to this project's environment (GOPAY_APP_ID / GOPAY_APP_SECRET).

export const GATEWAY_CRED_ID = "gopay";

export const GATEWAY_BASE = () =>
  (process.env["GOPAY_BASE_URL"] || "https://api.liralinkpay.com").trim().replace(/\/+$/, "");

export interface GatewayCreds {
  key: string;
  secret: string;
  basic: string;
}

function buildCreds(key: string, secret: string): GatewayCreds {
  return { key, secret, basic: btoa(`${key}:${secret}`) };
}

/** Splits a base64 "appId:appSecret" Authorization value. */
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
  const key = (process.env["GOPAY_APP_ID"] || "").trim();
  const secret = (process.env["GOPAY_APP_SECRET"] || "").replace(/\s+/g, "").trim();
  if (key && secret) return buildCreds(key, secret);
  const basic = (process.env["GOPAY_APP_BASIC"] || "").trim();
  if (basic) return decodeBasic(basic);
  return null;
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
  const url = (process.env["EGRESS_PROXY_URL"] || "").trim().replace(/\/+$/, "");
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

/** One gateway HTTP call. `ok` means the partner accepted the request (code 200). */
export async function gatewayFetch(
  creds: GatewayCreds,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<GatewayResult> {
  const request = {
    method: init?.method || "GET",
    headers: {
      Authorization: `Basic ${creds.basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    } as Record<string, string>,
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  };

  const run = async (useProxy: boolean): Promise<GatewayResult> => {
    const target = `${GATEWAY_BASE()}${path}`;
    const resp = useProxy ? await proxiedFetch(target, request) : await fetch(target, request);
    const text = await resp.text();
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    const code = String(body?.code ?? (resp.ok ? "200" : resp.status));
    const ok = resp.ok && code === "200";
    return {
      ok,
      httpStatus: resp.status,
      code,
      data: body?.data ?? null,
      raw: body,
      error: ok ? undefined : String(body?.msg || body?.message || `HTTP ${resp.status}`),
    };
  };

  try {
    const usesFixedEgress = !!proxyConfig();
    // Fail closed: when the fixed-IP route is configured, never fall back to a
    // rotating address. An explicit IP rejection is safe to retry because the
    // partner rejects it before creating an order. Separate relay calls also
    // allow Fixie to select its other approved address.
    let res = await run(usesFixedEgress);
    if (usesFixedEgress && isIpBlocked(res)) {
      for (let attempt = 0; attempt < 3 && isIpBlocked(res); attempt += 1) {
        res = await run(true);
      }
    }
    if (!res.ok && isIpBlocked(res)) {
      void import("./egress-monitor.server").then((m) => m.noteIpBlocked()).catch(() => {});
    }
    return res;
  } catch (err: any) {
    return { ok: false, httpStatus: 0, code: "0", data: null, raw: null, error: err?.message || "Network error" };
  }
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
  if (["FAILED", "FAILURE", "REJECTED", "CANCELLED", "CANCELED", "EXPIRED", "REVERSED"].includes(s)) return "failed";
  if (["PROCESSING", "PENDING", "INITIATED", "IN_PROGRESS"].includes(s)) return "pending";
  return null;
}

/** True when the partner refused us because this server's IP is not approved. */
export function isIpBlocked(res: { code?: string; error?: string }): boolean {
  const code = String(res?.code || "");
  if (code === "700002" || code === "4000018") return true;
  return /ip .*not support|not whitelisted|ip is not supported/i.test(res?.error || "");
}

/**
 * Turns partner errors into something a merchant can act on, without ever
 * naming the partner.
 */
export function friendlyError(res: { code?: string; error?: string }, kind: "collection" | "payout" | "request" = "request"): string {
  const code = String(res?.code || "");
  const raw = String(res?.error || "");

  if (isIpBlocked(res)) {
    return `This ${kind} could not be sent because our banking partner has not yet approved this server's network address. ObPay support has been notified — please try again shortly.`;
  }
  if (["10003", "700001", "700003", "700004", "4000017", "4000020"].includes(code)) {
    return "Payments are temporarily unavailable on this account. Please contact ObPay support.";
  }
  if (["10004", "4000030"].includes(code)) {
    return "The payout float is currently too low to process this request. Please try again shortly.";
  }
  if (["4000050", "4000004"].includes(code)) {
    return "This reference has already been submitted. Use a new reference.";
  }
  if (code === "6000005") return "Enter a whole amount — decimals are not supported for Uganda.";
  if (["6000001", "6000002", "6000003", "6000004", "6000008"].includes(code)) {
    return "That mobile money number is not valid. Use the 07XXXXXXXX format.";
  }
  if (code === "6000006") return "The recipient name is required.";
  if (code === "4000015") return "That bank is not supported. Choose another bank from the list.";
  if (["5000001", "5000002"].includes(code)) return "The payment network timed out. Please try again in a moment.";
  if (code === "10002" || code === "4000001") return `Some details were rejected: ${raw || "check the values and try again."}`;
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
}

/** Opens a hosted checkout the payer completes on their phone. */
export async function gatewayCollect(creds: GatewayCreds, req: CollectionRequest) {
  const wallet = walletNumber(req.phone);
  const body: Record<string, unknown> = {
    merchantReference: req.reference,
    amount: Math.round(req.amount),
    customerEmail: req.customerEmail || "payments@obpay.online",
    customerName: (req.customerName || "ObPay customer").slice(0, 64),
    ...(wallet ? { customerAccountNumber: wallet } : {}),
    ...(req.bankCode ? { customerBankCode: req.bankCode } : {}),
    ...(req.description ? { paymentDescription: String(req.description).slice(0, 120) } : {}),
    ...(req.redirectUrl ? { redirectUrl: req.redirectUrl } : {}),
    notifyUrl: req.notifyUrl || callbackUrl(),
  };
  const res = await gatewayFetch(creds, "/api/merchant/checkout", { method: "POST", body });
  if (!res.ok) return { ok: false as const, res };
  return {
    ok: true as const,
    res,
    platformReference: String(res.data?.platformReference || ""),
    checkoutUrl: String(res.data?.checkoutUrl || ""),
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

/** Sends money to a mobile money wallet or bank account. */
export async function gatewayPayout(creds: GatewayCreds, req: PayoutRequest) {
  const body: Record<string, unknown> = {
    merchantReference: req.reference,
    typeTrans: req.typeTrans,
    bankCode: req.bankCode,
    accountNumber: req.accountNumber,
    customerName: (req.customerName || "ObPay recipient").slice(0, 64),
    amount: Math.round(req.amount),
    ...(req.customerPhone ? { customerPhone: req.customerPhone } : {}),
    ...(req.customerEmail ? { customerEmail: req.customerEmail } : {}),
    ...(req.remark ? { remark: String(req.remark).slice(0, 120) } : {}),
    notifyUrl: req.notifyUrl || callbackUrl(),
  };
  const res = await gatewayFetch(creds, "/api/disbursements/single", { method: "POST", body });
  if (!res.ok) return { ok: false as const, res };
  return { ok: true as const, res, platformReference: String(res.data?.platformReference || "") };
}

/** Current state of a payout, by our reference or the partner's. */
export async function gatewayPayoutStatus(
  creds: GatewayCreds,
  refs: { merchantReference?: string | null; platformReference?: string | null },
) {
  const params = new URLSearchParams();
  if (refs.platformReference) params.set("platformReference", String(refs.platformReference));
  else if (refs.merchantReference) params.set("merchantReference", String(refs.merchantReference));
  if (![...params.keys()].length) return { ok: false as const, res: null, status: null as null };

  const res = await gatewayFetch(creds, `/api/disbursements/single/summary?${params.toString()}`);
  if (!res.ok) return { ok: false as const, res, status: null as null };
  return {
    ok: true as const,
    res,
    status: mapStatus(String(res.data?.status || "")),
    amount: Number(res.data?.amount) || 0,
    transferredAt: res.data?.transferredAt || null,
    platformReference: res.data?.platformReference || null,
    reason: res.data?.reason || res.data?.errorMsg || null,
  };
}

/** Float available for payouts. */
export async function gatewayBalance(creds: GatewayCreds) {
  const res = await gatewayFetch(creds, "/api/disbursements/account-balance");
  if (!res.ok) return { ok: false as const, res, balance: null };
  return {
    ok: true as const,
    res,
    balance: {
      available: Number(res.data?.availableBalance) || 0,
      frozen: Number(res.data?.frozenAmount) || 0,
      in_transit: Number(res.data?.returnedMoneyBalance) || 0,
      currency: "UGX",
    },
  };
}

/* ── Callbacks ──────────────────────────────────────────────────────────── */

export function callbackUrl(): string {
  const base = (process.env["PUBLIC_SITE_URL"] || "https://obpay.online").trim().replace(/\/+$/, "");
  return `${base}/api/public/gateway-callback`;
}

/** HMAC-SHA512 of the RAW callback body, hex lowercase, compared to X-Sign. */
export async function verifyCallbackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  if (!rawBody || !signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const given = signature.trim().toLowerCase();
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
