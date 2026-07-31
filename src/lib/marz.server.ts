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
