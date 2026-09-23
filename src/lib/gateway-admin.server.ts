// Admin-only management of the MarzPay credential sets that power every
// collection, payout and service call on ObPay. Several sets can be stored;
// exactly one is selected as live.

import { requireAdmin } from "./identity.server";
import {
  MARZ_CRED_ID,
  decodeBasic,
  getMarzCreds,
  invalidateMarzCredsCache,
  isIpWhitelistError,
  listStoredMarzCreds,
  marzCredsSource,
  marzFetch,
  readMarzCreds,
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

async function statusPayload() {
  const rows = await listStoredMarzCreds();
  const env = readMarzCreds();
  const active = await getMarzCreds();
  return {
    success: true,
    data: {
      source: await marzCredsSource(),
      active: active ? { key: mask(active.key, 10), secretMasked: mask(active.secret, 4) } : null,
      credentials: rows.map((r) => ({
        id: r.id,
        label: r.label,
        key: r.key,
        secretMasked: mask(r.secret, 4),
        enabled: r.enabled,
        updatedAt: r.updatedAt,
        updatedBy: r.updatedBy,
      })),
      environment: env ? { key: mask(env.key, 10), secretMasked: mask(env.secret, 4) } : null,
    },
  };
}

export async function runMarzAdminAction(
  action: string,
  accessToken: string,
  body: Record<string, unknown> = {},
) {
  const admin = await requireAdmin(accessToken);
  const rowId = String(body?.["id"] || "").trim();

  if (action === "status") return statusPayload();

  if (action === "test") {
    const typed = credsFromInput(body);
    let creds: MarzCreds | null = typed;
    if (!creds && rowId) {
      const row = (await listStoredMarzCreds()).find((r) => r.id === rowId);
      if (row?.key && row.secret) creds = { key: row.key, secret: row.secret, basic: btoa(`${row.key}:${row.secret}`) };
    }
    if (!creds) creds = await getMarzCreds();
    if (!creds) return { success: false, error: "No MarzPay credentials to test." };
    return probe(creds);
  }

  if (action === "save") {
    const creds = credsFromInput(body);
    if (!creds) {
      return { success: false, error: "Enter both an API key and secret, or a valid base64 Authorization value." };
    }
    const label = String(body?.["label"] || "").trim() || "MarzPay keys";
    const makeActive = body?.["activate"] !== false;

    if (body?.["skipVerify"] !== true) {
      const check = await probe(creds);
      if (!check.success) return check;
    }

    const client = await db();
    const id = rowId || `${MARZ_CRED_ID}:${crypto.randomUUID().slice(0, 8)}`;
    const { error } = await client.from("platform_credentials").upsert(
      {
        id,
        label,
        api_key: creds.key,
        api_secret: creds.secret,
        enabled: makeActive,
        updated_by: admin.email || admin.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) return { success: false, error: error.message };

    if (makeActive) await deactivateOthers(client, id);
    invalidateMarzCredsCache();
    return { success: true, data: { saved: true, id } };
  }

  if (action === "activate") {
    if (!rowId) return { success: false, error: "Choose which credentials to use." };
    const client = await db();
    const { error } = await client
      .from("platform_credentials")
      .update({ enabled: true, updated_at: new Date().toISOString(), updated_by: admin.email || admin.userId })
      .eq("id", rowId);
    if (error) return { success: false, error: error.message };
    await deactivateOthers(client, rowId);
    invalidateMarzCredsCache();
    return { success: true, data: { active: rowId } };
  }

  if (action === "delete") {
    if (!rowId) return { success: false, error: "Choose which credentials to remove." };
    const client = await db();
    const { error } = await client.from("platform_credentials").delete().eq("id", rowId);
    if (error) return { success: false, error: error.message };
    invalidateMarzCredsCache();
    return { success: true, data: { removed: rowId, source: await marzCredsSource() } };
  }

  if (action === "disable" || action === "reset") {
    const client = await db();
    const { error } = await client
      .from("platform_credentials")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .or(`id.eq.${MARZ_CRED_ID},id.like.${MARZ_CRED_ID}:%`);
    if (error) return { success: false, error: error.message };
    invalidateMarzCredsCache();
    return { success: true, data: { reverted: true, source: await marzCredsSource() } };
  }

  return { success: false, error: `Unsupported action: ${action}` };
}

async function deactivateOthers(client: any, keepId: string) {
  await client
    .from("platform_credentials")
    .update({ enabled: false })
    .or(`id.eq.${MARZ_CRED_ID},id.like.${MARZ_CRED_ID}:%`)
    .neq("id", keepId);
}
