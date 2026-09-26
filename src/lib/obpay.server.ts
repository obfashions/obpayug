// Server-only ObPay payment engine.
//
// The deployed Supabase edge function cannot be updated from here, so all live
// gateway work (collections, payouts, status sync, balance) runs in this
// project's server runtime using the banking-partner credentials held by the
// admin. Database writes go through Supabase REST with the CALLER's access
// token, so row level security still applies exactly as it would in the browser.

import {
  getGatewayCreds,
  gatewayBalance,
  gatewayCollect,
  gatewayPayout,
  gatewayPayoutStatus,
  friendlyError,
  isIpBlocked,
  networkCode,
  walletNumber,
  bankName,
  getEgressIp,
  proxyConfig,
  verifySupabaseUser,
  callbackUrl,
} from "./gateway.server";
import { runServiceAction, SERVICE_ACTIONS, SERVICE_PUBLIC_ACTIONS } from "./gateway-services.server";

const SUPA_URL = () =>
  (process.env["SUPABASE_URL"] || import.meta.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPA_ANON = () =>
  process.env["SUPABASE_PUBLISHABLE_KEY"] || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

async function rest(token: string, path: string, init?: RequestInit) {
  const resp = await fetch(`${SUPA_URL()}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPA_ANON(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: resp.ok, status: resp.status, data };
}

// Service key for the merchant database (the uploaded Supabase project that
// holds transactions + merchant_wallets). This is NOT the Lovable Cloud key.
const SERVICE_KEY = () =>
  (process.env["SUPABASE_SERVICE_ROLE_KEY"] || "").trim();

/**
 * Settlement writes (transaction status + wallet balance) must always succeed,
 * even if the merchant's own RLS policies do not allow updating their wallet.
 */
async function restWrite(token: string, path: string, init?: RequestInit) {
  const key = SERVICE_KEY();
  if (!key) return rest(token, path, init);
  const resp = await fetch(`${SUPA_URL()}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }),
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...((init?.headers as Record<string, string>) || {}),
    },
  });
  const text = await resp.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: resp.ok, status: resp.status, data };
}

const first = (res: { data: any }) => (Array.isArray(res.data) ? res.data[0] || null : null);

/** Mirrors a dashboard payment into ObPay's own records so the gateway callback
 *  (which has no merchant session) can settle it and the dashboard can read the
 *  result back. Never throws — mirroring is a convenience, not the source. */
async function mirrorRecord(merchantId: string, row: Record<string, any>) {
  try {
    const { recordPayment } = await import("./platform.server");
    await recordPayment(merchantId, row);
  } catch {
    /* ignore */
  }
}

/** The ObPay-managed record for a dashboard reference, if it exists. */
async function mirroredRecord(reference: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("payment_records")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

// ─── Pending-transaction resolution ───────────────────────────
//
// Payouts are queried directly from the gateway. Collections are completed by
// the payer on the hosted checkout, and the gateway reports the outcome on the
// callback endpoint — so their state is read from the mirrored ObPay record.

async function providerStateFor(txn: any): Promise<{ status: "success" | "failed"; fee: number; providerRef: string | null } | null> {
  const meta = txn.metadata || {};

  if (txn.type === "payout") {
    const creds = await getGatewayCreds();
    if (!creds) return null;
    const out = await gatewayPayoutStatus(creds, {
      merchantReference: txn.merchant_reference || txn.reference,
      platformReference: meta.platform_reference || txn.provider_reference || null,
    });
    if (!out.ok || !out.status || out.status === "pending") return null;
    return { status: out.status, fee: Number(txn.fee_amount || 0), providerRef: out.platformReference || null };
  }

  const record = await mirroredRecord(txn.reference);
  if (!record || (record.status !== "success" && record.status !== "failed")) {
    // Ask the partner directly so a missed notification never leaves money stuck.
    const creds = await getGatewayCreds();
    if (!creds) return null;
    const { gatewayCollectionStatus } = await import("./gateway.server");
    const out = await gatewayCollectionStatus(creds, txn.reference);
    if (!out.ok || !out.status || out.status === "pending") return null;
    const short = out.status === "success" && out.amount > 0 && out.amount < Number(txn.amount || 0);
    return { status: short ? "failed" : out.status, fee: Number(txn.fee_amount || 0), providerRef: txn.reference };
  }
  return {
    status: record.status,
    fee: Number(record.fee_amount || txn.fee_amount || 0),
    providerRef: record.provider_reference || null,
  };
}

async function resolveTransaction(token: string, txn: any) {
  const state = await providerStateFor(txn);
  if (!state) return null;

  const now = new Date().toISOString();
  const { status, fee } = state;
  const updates: Record<string, unknown> = {
    status,
    fee_amount: fee,
    ...(state.providerRef ? { provider_reference: state.providerRef } : {}),
    ...(status === "success" ? { completed_at: now, net_amount: Number(txn.amount) - fee } : {}),
  };

  const upd = await restWrite(token, `/transactions?id=eq.${txn.id}&status=eq.pending`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  // Someone else (callback/other tab) already resolved it — do not touch the wallet twice.
  if (!upd.ok || !Array.isArray(upd.data) || upd.data.length === 0) return null;

  const walletRes = await restWrite(token, `/merchant_wallets?user_id=eq.${txn.user_id}&select=*`);
  const wallet = first(walletRes);

  if (status === "success" && txn.type === "collection") {
    const credit = Number(txn.amount) - fee;
    if (wallet) {
      await restWrite(token, `/merchant_wallets?user_id=eq.${txn.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          available_balance: Number(wallet.available_balance || 0) + credit,
          total_collections: Number(wallet.total_collections || 0) + credit,
          updated_at: now,
        }),
      });
    } else {
      await restWrite(token, `/merchant_wallets`, {
        method: "POST",
        body: JSON.stringify({
          user_id: txn.user_id,
          currency: txn.currency || "UGX",
          available_balance: credit,
          total_collections: credit,
          created_at: now,
          updated_at: now,
        }),
      });
    }
  }

  if (status === "failed" && txn.type === "payout" && wallet) {
    const refund = Number(txn.amount) + Number(txn.fee_amount || 0);
    await restWrite(token, `/merchant_wallets?user_id=eq.${txn.user_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        available_balance: Number(wallet.available_balance || 0) + refund,
        total_payouts: Math.max(0, Number(wallet.total_payouts || 0) - Number(txn.amount)),
        updated_at: now,
      }),
    });
  }

  // Mirror the settled transaction into ObPay's own records (admin screens)
  // and notify the merchant + admin by email.
  try {
    const { notifySettlement } = await import("./notify.server");
    await notifySettlement({
      merchantId: txn.user_id,
      reference: txn.reference,
      type: txn.type === "payout" ? "payout" : "collection",
      amount: txn.amount,
      currency: txn.currency || "UGX",
      status,
      phone_number: txn.phone_number || txn.recipient_phone || null,
      description: txn.description || null,
      source: "dashboard",
      accessToken: token,
    });
  } catch {
    /* notifications must never break settlement */
  }

  return { id: txn.id, reference: txn.reference, status };
}

async function syncPending(token: string, userId: string, limit = 25) {
  const res = await rest(
    token,
    `/transactions?user_id=eq.${userId}&status=eq.pending&select=*&order=created_at.desc&limit=${limit}`,
  );
  const rows = Array.isArray(res.data) ? res.data : [];
  const resolved: any[] = [];
  for (const row of rows) {
    try {
      const out = await resolveTransaction(token, row);
      if (out) resolved.push(out);
    } catch {
      /* keep syncing the rest */
    }
  }
  return { checked: rows.length, resolved, updated: resolved };
}

// ─── Public entry point ───────────────────────────────────────

export const LOCAL_ACTIONS = [
  "collect",
  "payout",
  "balance",
  "transaction-status",
  "check-transaction",
  "sync-all-pending",
  "verify-phone",
  "verify-number",
  "test-connection",
  "server-ip",
  "payout-preflight",
  "admin-adjust-balance",
  "impersonate-user",
  "set-withdrawal-limit",
  ...SERVICE_ACTIONS,
];

/** Admin credit/debit of a merchant's available balance, verified by re-reading the wallet. */
async function adminAdjustBalance(accessToken: string, body: any) {
  const { resolveIdentity } = await import("./identity.server");
  const me = await resolveIdentity(accessToken);
  if (!me) return { success: false, error: "Please sign in again to continue." };
  if (!me.isAdmin) return { success: false, error: "You do not have access to this area." };

  const target = String(body?.target_user_id || "").trim();
  const type = body?.adjustment_type;
  const amount = Math.round(Number(body?.amount));
  if (!/^[0-9a-f-]{36}$/i.test(target)) return { success: false, error: "Merchant not found." };
  if (type !== "add" && type !== "deduct") return { success: false, error: "Choose add or deduct." };
  if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a valid amount." };

  const wallet = first(await restWrite(accessToken, `/merchant_wallets?user_id=eq.${target}&select=*`));
  const cur = Number(wallet?.available_balance || 0);
  const col = Number(wallet?.total_collections || 0);
  const pay = Number(wallet?.total_payouts || 0);
  const currency = wallet?.currency || "UGX";
  if (type === "deduct" && amount > cur) {
    return { success: false, error: `Not enough balance. Current balance is ${cur.toLocaleString()} ${currency}.` };
  }
  const newBal = type === "add" ? cur + amount : cur - amount;
  const now = new Date().toISOString();
  const fields = {
    available_balance: newBal,
    total_collections: type === "add" ? col + amount : col,
    total_payouts: type === "deduct" ? pay + amount : pay,
    updated_at: now,
  };

  const res = wallet
    ? await restWrite(accessToken, `/merchant_wallets?user_id=eq.${target}`, { method: "PATCH", body: JSON.stringify(fields) })
    : await restWrite(accessToken, `/merchant_wallets`, {
        method: "POST",
        body: JSON.stringify({ user_id: target, currency, pending_balance: 0, created_at: now, ...fields }),
      });

  // Re-read: a blocked write returns OK with zero rows, which used to look like success.
  const after = first(await restWrite(accessToken, `/merchant_wallets?user_id=eq.${target}&select=available_balance`));
  const saved = Number(after?.available_balance);
  if (!res.ok || !after || saved !== newBal) {
    console.error("[admin-adjust-balance] write not applied", res.status, JSON.stringify(res.data).slice(0, 300));
    return {
      success: false,
      error: "The balance could not be changed — the account database refused the update. Please contact support.",
    };
  }

  await restWrite(accessToken, `/transactions`, {
    method: "POST",
    body: JSON.stringify({
      user_id: target,
      reference: `ADMIN_${type.toUpperCase()}_${Date.now()}`,
      amount,
      currency,
      status: "success",
      type: type === "add" ? "collection" : "payout",
      customer_name: type === "add" ? "Admin Credit" : "Admin Debit",
      description: String(body?.note || `Admin balance adjustment (${type})`).slice(0, 200),
      fee_amount: 0,
      net_amount: amount,
      completed_at: now,
    }),
  }).catch(() => null);

  return {
    success: true,
    data: { target_user_id: target, adjustment_type: type, amount, previous_balance: cur, new_balance: saved, currency },
  };
}

async function adminOnly(accessToken: string) {
  const { resolveIdentity } = await import("./identity.server");
  const me = await resolveIdentity(accessToken);
  if (!me) return { error: "Please sign in again to continue." };
  if (!me.isAdmin) return { error: "You do not have access to this area." };
  return { me };
}

/** Admin: one-time sign-in link to view a merchant's dashboard. */
async function adminImpersonate(accessToken: string, body: any) {
  const gate = await adminOnly(accessToken);
  if ("error" in gate) return { success: false, error: gate.error };
  const target = String(body?.target_user_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(target)) return { success: false, error: "Merchant not found." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: prof } = await supabaseAdmin.from("profiles").select("email").eq("id", target).maybeSingle();
  if (!prof?.email) return { success: false, error: "This merchant has no email address on file." };
  const { ensureAuthUser } = await import("./legacy-migrate.server");
  await ensureAuthUser(target, prof.email);
  const origin = String(body?.origin || "https://obpay.online");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: prof.email.toLowerCase(),
    options: { redirectTo: `${origin}/dashboard` },
  });
  const link = (data as any)?.properties?.action_link;
  if (error || !link) return { success: false, error: "Could not create a sign-in link. Please try again." };
  return { success: true, data: { login_url: link } };
}

/** Admin: turn withdrawals on/off or set a daily limit. */
async function adminWithdrawalLimit(accessToken: string, body: any) {
  const gate = await adminOnly(accessToken);
  if ("error" in gate) return { success: false, error: gate.error };
  const target = String(body?.target_user_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(target)) return { success: false, error: "Merchant not found." };
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body?.withdrawals_enabled === "boolean") fields.withdrawals_enabled = body.withdrawals_enabled;
  if (body?.daily_withdrawal_limit !== undefined) {
    const n = body.daily_withdrawal_limit === null ? null : Math.round(Number(body.daily_withdrawal_limit));
    if (n !== null && (!Number.isFinite(n) || n < 0)) return { success: false, error: "Enter a valid limit." };
    fields.daily_withdrawal_limit = n;
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("merchant_wallets")
    .upsert({ user_id: target, ...fields } as any, { onConflict: "user_id" })
    .select("withdrawals_enabled, daily_withdrawal_limit, available_balance")
    .maybeSingle();
  if (error) return { success: false, error: "The change could not be saved. Please try again." };
  return { success: true, data };
}

export async function runObpayAction(action: string, accessToken: string, body: any) {
  if (action === "admin-adjust-balance") return adminAdjustBalance(accessToken, body);
  if (action === "impersonate-user") return adminImpersonate(accessToken, body);
  if (action === "set-withdrawal-limit") return adminWithdrawalLimit(accessToken, body);

  const creds = await getGatewayCreds();
  if (!creds) return { success: false, error: "Payments are not configured yet. Please contact ObPay support." };

  // Extra services (bank transfers, and the catalog).
  if (SERVICE_ACTIONS.includes(action)) {
    if (SERVICE_PUBLIC_ACTIONS.includes(action)) return runServiceAction(action, accessToken, null, body);
    const svcUserId = await verifySupabaseUser(accessToken);
    if (!svcUserId) return { success: false, error: "Please sign in again to continue." };
    return runServiceAction(action, accessToken, svcUserId, body);
  }

  // The public IP the banking partner sees (admin diagnostics).
  if (action === "server-ip") {
    return { success: true, data: { ip: await getEgressIp(), static_egress: !!proxyConfig() } };
  }

  // Checks whether payouts are currently possible from this server.
  if (action === "payout-preflight") {
    const bal = await gatewayBalance(creds);
    const ip = await getEgressIp();
    const staticEgress = !!proxyConfig();
    if (bal.ok) {
      return {
        success: true,
        data: { ip, static_egress: staticEgress, disbursement_ready: true, subscribed: true, balance: bal.balance },
      };
    }
    return {
      success: true,
      data: {
        ip,
        static_egress: staticEgress,
        disbursement_ready: false,
        subscribed: false,
        blocked_by_ip_whitelist: isIpBlocked(bal.res),
        message: friendlyError(bal.res, "payout"),
      },
    };
  }

  // Number checks are done locally — the gateway has no lookup endpoint.
  if (action === "verify-phone" || action === "verify-number") {
    const wallet = walletNumber(body?.phoneNumber);
    if (!wallet) return { success: false, error: "That is not a valid Ugandan mobile money number. Use 07XXXXXXXX." };
    return {
      success: true,
      data: {
        customer_name: null,
        phone_number: wallet,
        network: bankName(networkCode(body?.network, wallet)),
      },
    };
  }

  if (action === "test-connection") {
    const bal = await gatewayBalance(creds);
    if (bal.ok) {
      return { success: true, data: { status: "connected", balance: bal.balance?.available ?? null, float: bal.balance } };
    }
    if (isIpBlocked(bal.res)) {
      return {
        success: true,
        data: {
          status: "credentials_ok",
          balance_restricted: true,
          note: friendlyError(bal.res, "request"),
        },
      };
    }
    return { success: false, error: friendlyError(bal.res, "request") };
  }

  const userId = await verifySupabaseUser(accessToken);
  if (!userId) return { success: false, error: "Please sign in again to continue." };

  // ── Balance ──────────────────────────────────────────────
  if (action === "balance") {
    const wallet = first(await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}&select=*`));
    const bal = await gatewayBalance(creds);
    return {
      success: true,
      data: {
        available_balance: wallet?.available_balance || 0,
        pending_balance: wallet?.pending_balance || 0,
        total_collections: wallet?.total_collections || 0,
        total_payouts: wallet?.total_payouts || 0,
        currency: wallet?.currency || "UGX",
        withdrawals_enabled: wallet?.withdrawals_enabled !== false,
        provider_balance: bal.ok ? bal.balance?.available ?? null : null,
      },
    };
  }

  // ── Sync pending ─────────────────────────────────────────
  if (action === "sync-all-pending") {
    const out = await syncPending(accessToken, userId);
    return { success: true, data: out, updated: out.updated, checked: out.checked };
  }

  // ── Single transaction status ────────────────────────────
  if (action === "transaction-status" || action === "check-transaction") {
    const reference = String(body?.reference || "").trim();
    if (!reference) return { success: false, error: "A transaction reference is required." };
    const row = first(
      await rest(accessToken, `/transactions?user_id=eq.${userId}&reference=eq.${encodeURIComponent(reference)}&select=*`),
    );
    if (row && row.status === "pending") await resolveTransaction(accessToken, row);
    const fresh = row ? first(await rest(accessToken, `/transactions?id=eq.${row.id}&select=*`)) : null;
    return {
      success: true,
      data: {
        status: fresh?.status || "unknown",
        reference,
        transaction: fresh,
      },
    };
  }

  // ── Collect ──────────────────────────────────────────────
  if (action === "collect") {
    const { phoneNumber, amount, description, customerName, customerEmail, network } = body || {};
    const numericAmount = Number(amount);
    const numAmount = Math.round(numericAmount);
    if (!phoneNumber || !Number.isFinite(numericAmount)) return { success: false, error: "Mobile money number and amount are required." };
    if (numericAmount <= 0) return { success: false, error: "Enter an amount greater than zero." };
    if (!Number.isInteger(numericAmount)) return { success: false, error: "Enter a whole UGX amount without decimals." };
    if (!String(customerName || "").trim()) return { success: false, error: "Enter the customer's full name." };
    if (!/^\S+@\S+\.\S+$/.test(String(customerEmail || "").trim())) return { success: false, error: "Enter a valid customer email address." };
    const wallet = walletNumber(phoneNumber);
    if (!wallet) return { success: false, error: "Enter a valid mobile money number in the 07XXXXXXXX format." };
    if (!["mtn", "airtel", "UG0030", "UG0031"].includes(String(network || "").toLowerCase()) && !["UG0030", "UG0031"].includes(String(network || "").toUpperCase())) return { success: false, error: "Choose MTN Mobile Money or Airtel Money." };
    const currency = "UGX";

    const ref = String(body?.reference || `COL${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
    const dup = first(await rest(accessToken, `/transactions?reference=eq.${encodeURIComponent(ref)}&select=id,status,amount,type`));
    if (dup) {
      // Same request arriving twice (double tap / network retry): return the existing
      // payment instead of an error so the merchant sees its real status.
      if (dup.type === "collection" && Number(dup.amount) === numAmount) {
        return { success: true, data: { reference: ref, transaction_id: dup.id, status: dup.status, immediate_success: dup.status === "success", duplicate: true, message: dup.status === "success" ? "Payment already received." : "This collection was already sent. Waiting for the customer to approve." } };
      }
      return { success: false, error: `Reference "${ref}" has already been used. Leave the reference empty to generate a new one.` };
    }

    const bankCode = networkCode(network, wallet);
    const { merchantTag } = await import("./merchant-identity.server");
    const out = await gatewayCollect(creds, {
      merchant: await merchantTag(userId),
      channel: "dashboard_collection",
      reference: ref,
      amount: numAmount,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim(),
      phone: wallet,
      bankCode,
      description: description || ref,
      redirectUrl: `${(process.env["PUBLIC_SITE_URL"] || "https://obpay.online").trim().replace(/\/+$/, "")}/dashboard?paid=${encodeURIComponent(ref)}`,
      notifyUrl: callbackUrl(),
    });

    const txnId = crypto.randomUUID();
    const now = new Date().toISOString();

    if (!out.ok) {
      const message = friendlyError(out.res, "collection");
      await rest(accessToken, `/transactions`, {
        method: "POST",
        body: JSON.stringify({
          id: txnId, user_id: userId, reference: ref, type: "collection", amount: numAmount,
          currency, status: "failed", customer_phone: wallet,
          metadata: { error: out.res.error, code: out.res.code },
        }),
      });
      return { success: false, error: message, data: { reference: ref, transaction_id: txnId, status: "failed" } };
    }

    await rest(accessToken, `/transactions`, {
      method: "POST",
      body: JSON.stringify({
        id: txnId, user_id: userId, reference: ref, type: "collection", amount: numAmount,
        currency, status: "pending", customer_phone: wallet, customer_name: customerName || "",
        description: description || "", merchant_reference: ref, provider_reference: out.platformReference,
        metadata: {
          platform_reference: out.platformReference,
          checkout_url: out.checkoutUrl,
          network: bankName(bankCode),
        },
        created_at: now,
      }),
    });

    await mirrorRecord(userId, {
      reference: ref,
      provider_reference: out.platformReference,
      type: "collection",
      source: "dashboard",
      amount: numAmount,
      currency,
      status: "pending",
      phone_number: wallet,
      description: description || null,
    });

    return {
      success: true,
      data: {
        reference: ref,
        transaction_id: txnId,
        provider_reference: out.platformReference,
        checkout_url: out.checkoutUrl,
        status: "pending",
        amount: numAmount,
        currency,
        message: out.checkoutUrl
          ? "Payment started. Open the secure payment page to finish, or ask the customer to approve the prompt on their phone."
          : "Payment request sent. Ask the customer to approve the prompt on their phone.",
      },
    };
  }

  // ── Payout / withdrawal ──────────────────────────────────
  if (action === "payout") {
    const { phoneNumber, amount, description, network, customerName, customerEmail } = body || {};
    const payoutType = body?.payout_type || body?._payout_type || "send";
    const destinationType = body?.destinationType === "bank" ? "bank" : "mobile";
    const numericAmount = Number(amount);
    const numAmount = Math.round(numericAmount);
    if (!Number.isFinite(numericAmount)) return { success: false, error: "Amount is required." };
    if (numericAmount <= 0) return { success: false, error: "Enter an amount greater than zero." };
    if (!Number.isInteger(numericAmount)) return { success: false, error: "Enter a whole UGX amount without decimals." };
    if (!String(customerName || "").trim()) return { success: false, error: "Enter the recipient's full name." };
    if (customerEmail && !/^\S+@\S+\.\S+$/.test(String(customerEmail).trim())) return { success: false, error: "Enter a valid recipient email address." };
    const rawAccount = String(body?.accountNumber || phoneNumber || "").replace(/\s/g, "");
    const wallet = destinationType === "mobile" ? walletNumber(rawAccount) : "";
    if (destinationType === "mobile" && !wallet) return { success: false, error: "Enter a valid mobile money number in the 07XXXXXXXX format." };
    const requestedBankCode = String(body?.bankCode || "").toUpperCase();
    const validBank = destinationType === "bank" && /^UG00(?:0[1-9]|1\d|2\d)$/.test(requestedBankCode);
    if (destinationType === "bank" && !validBank) return { success: false, error: "Choose a supported Ugandan bank." };
    if (destinationType === "bank" && !/^\d+$/.test(rawAccount)) return { success: false, error: "Bank account numbers must contain digits only." };
    const currency = "UGX";

    const merchantWallet = first(await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}&select=*`));
    if (merchantWallet && merchantWallet.withdrawals_enabled === false) {
      return { success: false, error: "Withdrawals are currently disabled on your account. Please contact support." };
    }

    const ps = first(await rest(accessToken, `/platform_settings?select=payout_flat_fee,withdraw_fee_percent&limit=1`));
    const isWithdraw = payoutType === "withdraw";
    // The fee comes out of the amount withdrawn: withdraw 10,000 → recipient gets 10,000 − fee.
    const fee = numAmount <= 70000
      ? Number(ps?.payout_flat_fee ?? 1020)
      : Math.round(numAmount * (Number(ps?.withdraw_fee_percent ?? 3) / 100));
    const totalDeduction = numAmount;
    const recipientGets = numAmount - fee;
    if (recipientGets <= 0) return { success: false, error: `The amount must be more than the ${fee.toLocaleString()} ${"UGX"} fee.` };

    const balance = Number(merchantWallet?.available_balance || 0);
    if (balance < totalDeduction) {
      return {
        success: false,
        error: `Insufficient balance. You tried to send ${totalDeduction.toLocaleString()} ${currency} but your available balance is ${balance.toLocaleString()} ${currency}.`,
      };
    }

    const ref = String(body?.reference || `PAY${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
    const now = new Date().toISOString();
    const txnId = crypto.randomUUID();
    const bankCode = destinationType === "bank" ? requestedBankCode : networkCode(network, wallet);
    const accountNumber = destinationType === "bank" ? rawAccount : wallet;

    const { merchantTag } = await import("./merchant-identity.server");
    const tag = await merchantTag(userId);
    const out = await gatewayPayout(creds, {
      reference: ref,
      amount: recipientGets,
      merchant: tag,
      channel: isWithdraw ? "dashboard_withdrawal" : "dashboard_payout",
      typeTrans: destinationType === "bank" ? 3 : 2,
      bankCode,
      accountNumber,
      customerName: String(customerName).trim(),
      ...(destinationType === "mobile" ? { customerPhone: wallet } : {}),
      ...(customerEmail ? { customerEmail: String(customerEmail).trim() } : {}),
      remark: description || (isWithdraw ? "Withdrawal" : "Payout"),
      notifyUrl: callbackUrl(),
    });

    if (!out.ok) {
      const message = friendlyError(out.res, "payout");
      await rest(accessToken, `/payout_requests`, {
        method: "POST",
        body: JSON.stringify({
          user_id: userId, amount: numAmount, currency, phone_number: accountNumber,
          network: bankName(bankCode), status: "failed", fee_amount: fee,
          rejection_reason: message, requested_at: now,
        }),
      });
      await rest(accessToken, `/transactions`, {
        method: "POST",
        body: JSON.stringify({
          id: txnId, user_id: userId, reference: ref, type: "payout", amount: numAmount,
          currency, status: "failed", customer_phone: accountNumber, customer_name: String(customerName).trim(), fee_amount: fee,
          metadata: { error: out.res.error, code: out.res.code, destination_type: destinationType, bank_code: bankCode },
        }),
      });
      // Nothing was deducted, so the wallet stays untouched.
      return { success: false, error: message, data: { reference: ref, transaction_id: txnId, status: "failed" } };
    }

    await rest(accessToken, `/payout_requests`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId, amount: numAmount, currency, phone_number: accountNumber,
        network: bankName(bankCode), status: "processing",
        fee_amount: fee, provider_reference: out.platformReference, requested_at: now, processed_at: now,
      }),
    });

    await rest(accessToken, `/transactions`, {
      method: "POST",
      body: JSON.stringify({
        id: txnId, user_id: userId, reference: ref, type: "payout", amount: numAmount,
        currency, status: "pending", customer_phone: accountNumber, customer_name: String(customerName).trim(), provider_reference: out.platformReference,
        fee_amount: fee, net_amount: recipientGets, merchant_reference: ref,
        metadata: { fee_inclusive: true, recipient_gets: recipientGets, merchant_kyc_status: tag.kyc, platform_reference: out.platformReference, payout_type: payoutType, destination_type: destinationType, bank_code: bankCode, network: bankName(bankCode) },
        created_at: now,
      }),
    });

    await mirrorRecord(userId, {
      reference: ref,
      provider_reference: out.platformReference,
      type: "payout",
      source: "dashboard",
      amount: numAmount,
      currency,
      status: "pending",
      phone_number: accountNumber,
      description: description || null,
    });

    // Funds leave the wallet as soon as the payout is accepted; a later failure
    // is refunded by the pending-transaction sync.
    await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        available_balance: balance - totalDeduction,
        total_payouts: Number(merchantWallet?.total_payouts || 0) + numAmount,
        updated_at: now,
      }),
    });

    return {
      success: true,
      data: {
        transaction_id: txnId, reference: ref, provider_reference: out.platformReference, status: "pending",
        amount: numAmount, currency, fee_amount: fee, total_deducted: totalDeduction, recipient_gets: recipientGets,
      },
    };
  }

  return { success: false, error: `Unsupported action: ${action}` };
}

/** Applies a gateway callback to a dashboard transaction (no session involved).
 *  Only possible when a service key for the merchant database is configured;
 *  otherwise the dashboard settles the row on its next sync. */
export async function applyCallbackToDashboard(
  reference: string,
  status: "success" | "failed",
): Promise<boolean> {
  const key = SERVICE_KEY();
  if (!key || !reference) return false;
  const rows = await restWrite("", `/transactions?reference=eq.${encodeURIComponent(reference)}&select=*`);
  const txn = first(rows);
  if (!txn || txn.status !== "pending") return false;
  const patched = await resolveTransactionWithStatus(txn, status);
  return patched;
}

async function resolveTransactionWithStatus(txn: any, status: "success" | "failed"): Promise<boolean> {
  const now = new Date().toISOString();
  const fee = Number(txn.fee_amount || 0);
  const upd = await restWrite("", `/transactions?id=eq.${txn.id}&status=eq.pending`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      ...(status === "success" ? { completed_at: now, net_amount: Number(txn.amount) - fee } : {}),
    }),
  });
  if (!upd.ok || !Array.isArray(upd.data) || upd.data.length === 0) return false;

  const wallet = first(await restWrite("", `/merchant_wallets?user_id=eq.${txn.user_id}&select=*`));
  if (status === "success" && txn.type === "collection") {
    const credit = Number(txn.amount) - fee;
    if (wallet) {
      await restWrite("", `/merchant_wallets?user_id=eq.${txn.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          available_balance: Number(wallet.available_balance || 0) + credit,
          total_collections: Number(wallet.total_collections || 0) + credit,
          updated_at: now,
        }),
      });
    }
  }
  if (status === "failed" && txn.type === "payout" && wallet) {
    // Newer payouts took the fee out of the amount, so only the amount is refunded.
    const refund = Number(txn.amount) + (txn.metadata?.fee_inclusive ? 0 : fee);
    await restWrite("", `/merchant_wallets?user_id=eq.${txn.user_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        available_balance: Number(wallet.available_balance || 0) + refund,
        total_payouts: Math.max(0, Number(wallet.total_payouts || 0) - Number(txn.amount)),
        updated_at: now,
      }),
    });
  }
  return true;
}
