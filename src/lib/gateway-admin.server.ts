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
      server_ip: egress?.current || (await getEgressIp()),
      egress,
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
  const admin = await requireAdmin(accessToken, ["account", "withdraw", "merchant-payment-audit"].includes(action) ? "finance" : "settings");
  const rowId = String(body?.["id"] || "").trim();

  if (action === "status") return statusPayload();

  // Read-only reconciliation evidence: never settle records or change balances.
  if (action === "merchant-payment-audit") {
    const merchantId = String(body.merchantId || "");
    if (!/^[0-9a-f-]{36}$/i.test(merchantId)) return { success: false, error: "Choose a merchant." };
    const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
    const client = await db();
    const { data: records, error } = await client.from("payment_records")
      .select("id,reference,provider_reference,type,currency,amount,status,fee_amount,net_amount,metadata")
      .eq("merchant_id", merchantId).order("created_at").range(offset, offset + 14);
    if (error) return { success: false, error: "Could not read merchant payments." };
    const { getGatewayCreds, gatewayCollectionStatus, gatewayPayoutStatus } = await import("./gateway.server");
    const creds = await getGatewayCreds();
    if (!creds) return { success: false, error: "Payment verification is unavailable." };
    const result = [];
    for (const record of records || []) {
      const checked = record.type === "payout"
        ? await gatewayPayoutStatus(creds, { platformReference: record.provider_reference })
        : await gatewayCollectionStatus(creds, record.provider_reference || record.reference);
      const raw = checked.res?.raw;
      const partner = raw?.payout || (Array.isArray(raw?.payouts) ? raw.payouts[0] : null) || checked.res?.data;
      result.push({ record, verified: checked.ok, partner: partner ? {
        status: partner.status, amount: partner.amount, fee: partner.fee, net_amount: partner.net_amount,
        currency: partner.currency, reference: partner.reference, note: partner.note || partner.admin_note,
      } : null });
    }
    return { success: true, data: { records: result, nextOffset: (records || []).length === 15 ? offset + 15 : null } };
  }

  // Tracked account position: the partner exposes no live balance endpoint,
  // so we report what ObPay's own books say is sitting in the gateway float.
  if (action === "account") {
    const client = await db();
    const [{ data: balances }, { data: payouts }] = await Promise.all([
      client.from("merchant_balances").select("currency, available_balance, total_collections, total_payouts"),
      client
        .from("payment_records")
        .select("reference, amount, currency, status, phone_number, created_at")
        .eq("type", "payout")
        .eq("source", "admin")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    const byCurrency: Record<string, { collected: number; paid_out: number; merchant_available: number }> = {};
    for (const row of balances || []) {
      const c = String(row.currency || "UGX");
      byCurrency[c] = byCurrency[c] || { collected: 0, paid_out: 0, merchant_available: 0 };
      byCurrency[c].collected += Number(row.total_collections) || 0;
      byCurrency[c].paid_out += Number(row.total_payouts) || 0;
      byCurrency[c].merchant_available += Number(row.available_balance) || 0;
    }
    const tracked = Object.entries(byCurrency).map(([currency, v]) => ({
      currency,
      collected: v.collected,
      paid_out: v.paid_out,
      merchant_available: v.merchant_available,
      // Money held at the partner that is not owed to merchants (fees, float).
      platform_share: Math.max(v.collected - v.paid_out - v.merchant_available, 0),
    }));
    // Live partner balance + charges (read-only).
    let live: any = null;
    try {
      const creds = await getGatewayCreds();
      if (creds) {
        const { gatewayLiveBalances, gatewayCharges } = await import("./gateway.server");
        const [balancesLive, charges] = await Promise.all([gatewayLiveBalances(creds), gatewayCharges(creds)]);
        const { data: collFees } = await client
          .from("payment_records")
          .select("currency, fee_amount")
          .eq("type", "collection")
          .eq("status", "success");
        const collection_fees: Record<string, number> = {};
        for (const r of collFees || []) {
          const c = String(r.currency || "UGX");
          collection_fees[c] = (collection_fees[c] || 0) + (Number(r.fee_amount) || 0);
        }
        live = { balances: balancesLive, payout_charges: charges, collection_fees };
      }
    } catch (e) {
      console.error("[gateway-admin] live balance failed", e);
    }
    return { success: true, data: { tracked, recent_withdrawals: payouts || [], live } };
  }

  // Withdraw from the platform float straight to a mobile money number.
  if (action === "withdraw") {
    const amount = Number(body?.["amount"]);
    const currency = String(body?.["currency"] || "UGX").toUpperCase();
    const phoneRaw = String(body?.["phone"] || "").trim();
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      return { success: false, error: "Enter a whole-number amount greater than zero." };
    }
    const { SUPPORTED_MONEY_CURRENCIES } = await import("./countries");
    if (!SUPPORTED_MONEY_CURRENCIES.includes(currency) || currency === "USD") {
      return { success: false, error: `Currency must be one of ${SUPPORTED_MONEY_CURRENCIES.filter((c) => c !== "USD").join(", ")}.` };
    }
    const { walletNumber } = await import("./gateway.server");
    const { intlPhone } = await import("./countries");
    const phone = currency === "UGX" ? walletNumber(phoneRaw) : intlPhone(phoneRaw, currency);
    if (!phone) return { success: false, error: "Enter a valid mobile money number for that currency." };

    const creds = await getGatewayCreds();
    if (!creds) return { success: false, error: "No gateway credentials are configured." };

    const reference = `OBW-ADMIN-${Date.now().toString(36).toUpperCase()}`;
    const { gatewayPayout, friendlyError: friendly, callbackUrl: cbUrl } = await import("./gateway.server");
    const { merchantTag } = await import("./merchant-identity.server");
    const out = await gatewayPayout(creds, {
      merchant: await merchantTag("admin", "ObPay Admin"),
      channel: "admin_withdrawal",
      currency,
      network: String(body?.["network"] || ""),
      feeInclusive: true,
      reference,
      amount,
      typeTrans: 2,
      bankCode: "",
      accountNumber: phone,
      customerPhone: phone,
      customerName: String(body?.["name"] || "ObPay Admin").slice(0, 64),
      remark: String(body?.["note"] || "ObPay admin withdrawal"),
      notifyUrl: cbUrl(),
    });

    const client = await db();
    await client.from("payment_records").insert({
      merchant_id: "admin",
      reference,
      provider_reference: out.ok ? out.platformReference : null,
      type: "payout",
      source: "admin",
      amount,
      currency,
      status: out.ok ? "pending" : "failed",
      phone_number: phone,
      description: String(body?.["note"] || "Admin withdrawal from platform float"),
      metadata: { admin: admin.email || admin.userId, fee_inclusive: true, fee: out.ok ? out.partnerFee : null, recipient_gets: out.ok ? out.net : null },
    });

    if (!out.ok) return { success: false, error: friendly(out.res, "payout") };
    return {
      success: true,
      data: {
        reference,
        amount,
        fee: out.partnerFee,
        recipient_gets: out.net,
        currency,
        phone,
        status: "pending",
      },
    };
  }


  if (action === "egress-approve") {
    const { approveEgressIp } = await import("./egress-monitor.server");
    try {
      const state = await approveEgressIp(String(body?.["ip"] || ""), admin.email || admin.userId);
      return { success: true, data: state };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not save that address." };
    }
  }

  if (action === "egress-check") {
    const { checkEgressIp } = await import("./egress-monitor.server");
    return { success: true, data: await checkEgressIp("admin requested check") };
  }

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
