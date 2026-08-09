// Admin-only management of the MarzPay credentials that power every
// collection, payout and service call on ObPay.

import { requireAdmin } from "./identity.server";
import {
  MARZ_CRED_ID,
  decodeBasic,
  getMarzCreds,
  invalidateMarzCredsCache,
  isIpWhitelistError,
  marzCredsSource,
  marzFetch,
  readMarzCreds,
  readStoredMarzCreds,
  type MarzCreds,
} from "./marz.server";

const db = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
};

function mask(value: string, keep = 4): string {
  const v = String(value || "");
  if (!v) return "";
  if (v.length <= keep + 3) return "•".repeat(v.length);
  return `${v.slice(0, keep)}${"•".repeat(Math.max(4, v.length - keep - 4))}${v.slice(-4)}`;
}

function credsFromInput(body: Record<string, unknown>): MarzCreds | null {
  const key = String(body?.["apiKey"] || "").trim();
  const secret = String(body?.["apiSecret"] || "").trim();
  if (key && secret) return { key, secret, basic: btoa(`${key}:${secret}`) };

  const basic = String(body?.["apiBasic"] || "").trim();
  if (basic) return decodeBasic(basic);
  return null;
}

async function probe(creds: MarzCreds) {
  const res = await marzFetch(creds, "/transactions?per_page=1");
  if (res.ok) {
    const account = res.data?.data?.account || null;
    return {
      success: true,
      data: {
        status: "connected",
        balance: account?.current_balance ?? null,
        account,
      },
    };
  }
  if (isIpWhitelistError(res)) {
    return {
      success: true,
      data: {
        status: "connected",
        ip_restricted: true,
        note: "Credentials accepted. MarzPay hides the balance endpoint from non-whitelisted IPs, collections and payouts still work.",
      },
    };
  }
  return { success: false, error: res.error || "MarzPay rejected these credentials.", data: res.data };
}

export async function runMarzAdminAction(
  action: string,
  accessToken: string,
  body: Record<string, unknown> = {},
) {
  const admin = await requireAdmin(accessToken);

  if (action === "status") {
    const stored = await readStoredMarzCreds();
    const env = readMarzCreds();
    const active = await getMarzCreds();
    return {
      success: true,
      data: {
        source: await marzCredsSource(),
        active: active ? { key: mask(active.key, 10), secretMasked: mask(active.secret, 4) } : null,
        stored: stored.creds
          ? {
              key: stored.creds.key,
              secretMasked: mask(stored.creds.secret, 4),
              enabled: stored.enabled,
              updatedAt: stored.updatedAt,
              updatedBy: stored.updatedBy,
            }
          : null,
        environment: env ? { key: mask(env.key, 10), secretMasked: mask(env.secret, 4) } : null,
      },
    };
  }

  if (action === "test") {
    // Test either the credentials typed into the form, or the live ones.
    const typed = credsFromInput(body);
    const creds = typed || (await getMarzCreds());
    if (!creds) return { success: false, error: "No MarzPay credentials to test." };
    return probe(creds);
  }

  if (action === "save") {
    const creds = credsFromInput(body);
    if (!creds) {
      return { success: false, error: "Enter both an API key and secret, or a valid base64 Authorization value." };
    }

    if (body?.["skipVerify"] !== true) {
      const check = await probe(creds);
      if (!check.success) return check;
    }

    const client = await db();
    const { error } = await client.from("platform_credentials").upsert(
      {
        id: MARZ_CRED_ID,
        api_key: creds.key,
        api_secret: creds.secret,
        enabled: true,
        updated_by: admin.email || admin.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) return { success: false, error: error.message };

    invalidateMarzCredsCache();
    const verify = await probe((await getMarzCreds())!);
    return {
      success: true,
      data: { saved: true, verified: verify.success, note: (verify as any).data?.note || null },
    };
  }

  if (action === "disable" || action === "reset") {
    const client = await db();
    const { error } = await client.from("platform_credentials").delete().eq("id", MARZ_CRED_ID);
    if (error) return { success: false, error: error.message };
    invalidateMarzCredsCache();
    return { success: true, data: { reverted: true, source: await marzCredsSource() } };
  }

  return { success: false, error: `Unsupported action: ${action}` };
}
