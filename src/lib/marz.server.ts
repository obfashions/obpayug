// Server-only MarzPay helpers. Credentials live in THIS project's environment
// (MARZ_API_KEY / MARZ_API_SECRET / MARZ_API_BASIC) and never reach the browser.

export const MARZ_BASE = "https://wallet.wearemarz.com/api/v1";

export interface MarzCreds {
  key: string;
  secret: string;
  basic: string;
}

export function readMarzCreds(): MarzCreds | null {
  const key = (process.env["MARZ_API_KEY"] || "").trim();
  const secret = (process.env["MARZ_API_SECRET"] || "").trim();
  if (key && secret) {
    return { key, secret, basic: btoa(`${key}:${secret}`) };
  }

  const basic = (process.env["MARZ_API_BASIC"] || "").trim();
  if (basic) {
    try {
      const decoded = atob(basic);
      const idx = decoded.indexOf(":");
      if (idx > 0) {
        return {
          key: decoded.slice(0, idx).trim(),
          secret: decoded.slice(idx + 1).trim(),
          basic,
        };
      }
    } catch {
      /* not base64 — ignore */
    }
  }
  return null;
}

export async function marzFetch(
  creds: MarzCreds,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: boolean; httpStatus: number; data: any; error?: string }> {
  try {
    const resp = await fetch(`${MARZ_BASE}${path}`, {
      method: init?.method || "GET",
      headers: {
        Authorization: `Basic ${creds.basic}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await resp.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    return {
      ok: resp.ok,
      httpStatus: resp.status,
      data,
      error: resp.ok ? undefined : data?.message || data?.error || `HTTP ${resp.status}`,
    };
  } catch (err: any) {
    return { ok: false, httpStatus: 0, data: null, error: err?.message || "Network error" };
  }
}

export function isIpWhitelistError(res: { error?: string; data?: any }): boolean {
  const code = (res?.data?.error_code || "").toString().toUpperCase();
  return code === "IP_WHITELIST_REQUIRED" || /ip whitelist/i.test(res?.error || "");
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

const SUPA_URL = () => (process.env["VITE_PUBLIC_SUPABASE_URL"] || import.meta.env.VITE_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPA_ANON = () => process.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] || import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";

async function supaRest(accessToken: string, path: string, init?: RequestInit) {
  const resp = await fetch(`${SUPA_URL()}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPA_ANON(),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });
  const text = await resp.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: resp.ok, status: resp.status, data };
}

/** Pushes the credentials stored in THIS project into the merchant Supabase
 *  `platform_settings` row, so the deployed edge functions can use them too.
 *  Requires an admin caller. */
export async function pushMarzCredentialsToDb(accessToken: string) {
  const creds = readMarzCreds();
  if (!creds) return { ok: false, message: "No MarzPay credentials configured on the server." };

  const userId = await verifySupabaseUser(accessToken);
  if (!userId) return { ok: false, message: "You must be signed in." };

  const prof = await supaRest(accessToken, `/profiles?id=eq.${userId}&select=role`);
  const role = Array.isArray(prof.data) ? prof.data[0]?.role : null;
  if (role !== "admin") return { ok: false, message: "Admin only." };

  const rows = await supaRest(accessToken, `/platform_settings?select=id&limit=1`);
  const rowId = Array.isArray(rows.data) ? rows.data[0]?.id : null;
  if (!rowId) return { ok: false, message: "No platform_settings row found." };

  const now = new Date().toISOString();
  // Preferred columns first, then the legacy slots the edge function also reads.
  const attempts: Record<string, unknown>[] = [
    { marz_api_key: creds.key, marz_api_secret: creds.secret, updated_at: now },
    { livepay_api_key: creds.key, livepay_account_number: creds.secret, updated_at: now },
  ];

  const applied: string[] = [];
  for (const payload of attempts) {
    const res = await supaRest(accessToken, `/platform_settings?id=eq.${rowId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (res.ok) applied.push(Object.keys(payload)[0]);
  }

  if (!applied.length) return { ok: false, message: "Could not write credentials to platform_settings." };
  return { ok: true, message: "MarzPay credentials synced to the backend.", applied };
}

/** Runs a MarzPay call server-side with the credentials held in this project. */
export async function runMarzAction(action: string, payload: any) {
  const creds = readMarzCreds();
  if (!creds) return { success: false, error: "MarzPay credentials are not configured." };

  const country = (c?: string) => ({ UGX: "UG", KES: "KE", GHS: "GH", XAF: "CM", TZS: "TZ" } as Record<string, string>)[(c || "UGX").toUpperCase()] || "UG";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ref = (r?: string) => (r && uuid.test(r.trim()) ? r.trim() : crypto.randomUUID());

  if (action === "balance") {
    const res = await marzFetch(creds, "/balance");
    if (!res.ok && isIpWhitelistError(res)) {
      return { success: true, data: { balance: null, ip_restricted: true, note: "Connected to MarzPay. Live balance is hidden because MarzPay limits that endpoint to whitelisted IPs." } };
    }
    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error, data: res.data };
  }

  if (action === "verify-phone") {
    const res = await marzFetch(creds, "/phone/verify", { method: "POST", body: { phone_number: payload?.phoneNumber } });
    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error, data: res.data };
  }

  if (action === "transaction-status") {
    const res = await marzFetch(creds, `/transactions/${encodeURIComponent(payload?.reference || "")}`);
    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error, data: res.data };
  }

  if (action === "collect") {
    const res = await marzFetch(creds, "/collect-money", {
      method: "POST",
      body: {
        amount: Number(payload?.amount),
        phone_number: payload?.phoneNumber,
        reference: ref(payload?.reference),
        description: payload?.description || "Collection via ObPay",
        country: country(payload?.currency),
      },
    });
    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error, data: res.data };
  }

  if (action === "send") {
    const res = await marzFetch(creds, "/send-money", {
      method: "POST",
      body: {
        amount: Number(payload?.amount),
        phone_number: payload?.phoneNumber,
        reference: ref(payload?.reference),
        description: payload?.description || "Payout via ObPay",
        country: country(payload?.currency),
      },
    });
    return res.ok ? { success: true, data: res.data } : { success: false, error: res.error, data: res.data };
  }

  if (action === "test-connection") {
    const bal = await marzFetch(creds, "/balance");
    if (bal.ok) return { success: true, data: { status: "connected", balance: bal.data } };
    if (isIpWhitelistError(bal)) {
      const probe = await marzFetch(creds, "/phone/verify", { method: "POST", body: { phone_number: "+256700000000" } });
      const credentialsValid = probe.httpStatus !== 401 && probe.httpStatus !== 403;
      return credentialsValid
        ? { success: true, data: { status: "connected", ip_restricted: true, note: "Connected to MarzPay. Live balance is hidden because MarzPay limits that endpoint to whitelisted IPs." } }
        : { success: false, error: probe.error || "MarzPay rejected the credentials." };
    }
    return { success: false, error: bal.error, data: bal.data };
  }

  return { success: false, error: `Unsupported MarzPay action: ${action}` };
}
