// Admin-only management of the banking-partner credential sets that power every
// collection, payout and transfer on ObPay. Several sets can be stored; exactly
// one is selected as live.

import { requireAdmin } from "./identity.server";
import {
  GATEWAY_CRED_ID,
  GATEWAY_BASE,
  callbackUrl,
  decodeBasic,
  friendlyError,
  gatewayBalance,
  gatewayCredsSource,
  getEgressIp,
  getGatewayCreds,
  invalidateGatewayCredsCache,
  isIpBlocked,
  listStoredGatewayCreds,
  proxyConfig,
  readEnvCreds,
  type GatewayCreds,
} from "./gateway.server";

const db = async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
};

function mask(value: string, keep = 4): string {
  const v = String(value || "");
  if (!v) return "";
  if (v.length <= keep + 3) return "•".repeat(v.length);
  return `${v.slice(0, keep)}${"•".repeat(Math.max(4, Math.min(24, v.length - keep - 4)))}${v.slice(-4)}`;
}

function credsFromInput(body: Record<string, unknown>): GatewayCreds | null {
  const key = String(body?.["apiKey"] || "").replace(/\s+/g, "").trim();
  const secret = String(body?.["apiSecret"] || "").replace(/\s+/g, "").trim();
  if (key && secret) return { key, secret, basic: btoa(`${key}:${secret}`) };

  const basic = String(body?.["apiBasic"] || "").replace(/\s+/g, "").trim();
  if (basic) return decodeBasic(basic);
  return null;
}

async function probe(creds: GatewayCreds) {
  const bal = await gatewayBalance(creds);
  if (bal.ok) {
    return { success: true, data: { status: "connected", balance: bal.balance?.available ?? null, float: bal.balance } };
  }
  if (isIpBlocked(bal.res)) {
    const ip = await getEgressIp();
    return {
      success: true,
      data: {
        status: "ip_blocked",
        ip_restricted: true,
        ip,
        note: `The application ID was recognised, but the partner refused the request because this server's address is not approved (they saw ${ip}). Ask them to approve it, or run the static-egress relay so every call leaves from one fixed address.`,
      },
    };
  }
  return { success: false, error: friendlyError(bal.res, "request"), data: bal.res.raw };
}

async function statusPayload() {
  const rows = await listStoredGatewayCreds();
  const env = readEnvCreds();
  const active = await getGatewayCreds();
  const { egressState } = await import("./egress-monitor.server");
  let egress: any = null;
  try {
    egress = await egressState();
  } catch {
    egress = null;
  }
  return {
    success: true,
    data: {
      source: await gatewayCredsSource(),
      base_url: GATEWAY_BASE(),
      callback_url: callbackUrl(),
      static_egress: !!proxyConfig(),
      server_ip: await getEgressIp(),
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

export async function runGatewayAdminAction(
  action: string,
  accessToken: string,
  body: Record<string, unknown> = {},
) {
  const admin = await requireAdmin(accessToken);
  const rowId = String(body?.["id"] || "").trim();

  if (action === "status") return statusPayload();

  if (action === "test") {
    const typed = credsFromInput(body);
    let creds: GatewayCreds | null = typed;
    if (!creds && rowId) {
      const row = (await listStoredGatewayCreds()).find((r) => r.id === rowId);
      if (row?.key && row.secret) creds = { key: row.key, secret: row.secret, basic: btoa(`${row.key}:${row.secret}`) };
    }
    if (!creds) creds = await getGatewayCreds();
    if (!creds) return { success: false, error: "No gateway credentials to test." };
    return probe(creds);
  }

  if (action === "save") {
    const creds = credsFromInput(body);
    if (!creds) {
      return { success: false, error: "Enter both an application ID and application key, or a valid base64 Authorization value." };
    }
    const label = String(body?.["label"] || "").trim() || "Gateway keys";
    const makeActive = body?.["activate"] !== false;

    if (body?.["skipVerify"] !== true) {
      const check = await probe(creds);
      if (!check.success) return check;
    }

    const client = await db();
    const id = rowId || `${GATEWAY_CRED_ID}:${crypto.randomUUID().slice(0, 8)}`;
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
    invalidateGatewayCredsCache();
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
    invalidateGatewayCredsCache();
    return { success: true, data: { active: rowId } };
  }

  if (action === "delete") {
    if (!rowId) return { success: false, error: "Choose which credentials to remove." };
    const client = await db();
    const { error } = await client.from("platform_credentials").delete().eq("id", rowId);
    if (error) return { success: false, error: error.message };
    invalidateGatewayCredsCache();
    return { success: true, data: { removed: rowId, source: await gatewayCredsSource() } };
  }

  if (action === "disable" || action === "reset") {
    const client = await db();
    const { error } = await client
      .from("platform_credentials")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .or(`id.eq.${GATEWAY_CRED_ID},id.like.${GATEWAY_CRED_ID}:%`);
    if (error) return { success: false, error: error.message };
    invalidateGatewayCredsCache();
    return { success: true, data: { reverted: true, source: await gatewayCredsSource() } };
  }

  return { success: false, error: `Unsupported action: ${action}` };
}

async function deactivateOthers(client: any, keepId: string) {
  await client
    .from("platform_credentials")
    .update({ enabled: false })
    .or(`id.eq.${GATEWAY_CRED_ID},id.like.${GATEWAY_CRED_ID}:%`)
    .neq("id", keepId);
}
