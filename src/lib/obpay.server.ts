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
  (process.env["VITE_PUBLIC_SUPABASE_URL"] || import.meta.env.VITE_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPA_ANON = () =>
  process.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] || import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";

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
  (process.env["LEGACY_SUPABASE_SERVICE_ROLE_KEY"] || process.env["MERCHANT_DB_SERVICE_KEY"] || "").trim();

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
      Authorization: `Bearer ${key}`,
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
  if (!record || (record.status !== "success" && record.status !== "failed")) return null;
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
  ...SERVICE_ACTIONS,
];

export async function runObpayAction(action: string, accessToken: string, body: any) {
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
    const { phoneNumber, amount, currency, description, customerName, customerEmail, network } = body || {};
    const numAmount = Math.round(Number(amount));
    if (!phoneNumber || !numAmount || !currency) return { success: false, error: "Phone number, amount and currency are required." };
    if (numAmount <= 0) return { success: false, error: "Enter an amount greater than zero." };
    const wallet = walletNumber(phoneNumber);
    if (!wallet) return { success: false, error: "Enter a valid mobile money number in the 07XXXXXXXX format." };

    const ref = String(body?.reference || `COL${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
    const dup = first(await rest(accessToken, `/transactions?reference=eq.${encodeURIComponent(ref)}&select=id`));
    if (dup) return { success: false, error: `Reference "${ref}" has already been used.` };

    const bankCode = networkCode(network, wallet);
    const out = await gatewayCollect(creds, {
      reference: ref,
      amount: numAmount,
      customerName: customerName || "ObPay customer",
      customerEmail: customerEmail || "payments@obpay.online",
      phone: wallet,
      bankCode,
      description: description || "Collection via ObPay",
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
    const { phoneNumber, amount, currency, description, network, customerName } = body || {};
    const payoutType = body?.payout_type || body?._payout_type || "send";
    const numAmount = Math.round(Number(amount));
    if (!phoneNumber || !numAmount || !currency) return { success: false, error: "Phone number, amount and currency are required." };
    if (numAmount <= 0) return { success: false, error: "Enter an amount greater than zero." };
    const wallet = walletNumber(phoneNumber);
    if (!wallet) return { success: false, error: "Enter a valid mobile money number in the 07XXXXXXXX format." };

    const merchantWallet = first(await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}&select=*`));
    if (merchantWallet && merchantWallet.withdrawals_enabled === false) {
      return { success: false, error: "Withdrawals are currently disabled on your account. Please contact support." };
    }

    const ps = first(await rest(accessToken, `/platform_settings?select=payout_flat_fee,withdraw_fee_percent&limit=1`));
    const isWithdraw = payoutType === "withdraw";
    const fee = isWithdraw
      ? Math.round(numAmount * (Number(ps?.withdraw_fee_percent ?? 9) / 100))
      : Number(ps?.payout_flat_fee ?? 1020);
    const totalDeduction = numAmount + fee;

    const balance = Number(merchantWallet?.available_balance || 0);
    if (balance < totalDeduction) {
      return {
        success: false,
        error: `Insufficient balance. This payout needs ${totalDeduction.toLocaleString()} ${currency} (including a ${fee.toLocaleString()} ${currency} fee) but your available balance is ${balance.toLocaleString()} ${currency}.`,
      };
    }

    const ref = String(body?.reference || `PAY${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
    const now = new Date().toISOString();
    const txnId = crypto.randomUUID();
    const bankCode = networkCode(network, wallet);

    const out = await gatewayPayout(creds, {
      reference: ref,
      amount: numAmount,
      typeTrans: 2,
      bankCode,
      accountNumber: wallet,
      customerName: customerName || "ObPay recipient",
      customerPhone: wallet,
      remark: description || (isWithdraw ? "Withdrawal" : "Payout"),
      notifyUrl: callbackUrl(),
    });

    if (!out.ok) {
      const message = friendlyError(out.res, "payout");
      await rest(accessToken, `/payout_requests`, {
        method: "POST",
        body: JSON.stringify({
          user_id: userId, amount: numAmount, currency, phone_number: wallet,
          network: bankName(bankCode), status: "failed", fee_amount: fee,
          rejection_reason: message, requested_at: now,
        }),
      });
      await rest(accessToken, `/transactions`, {
        method: "POST",
        body: JSON.stringify({
          id: txnId, user_id: userId, reference: ref, type: "payout", amount: numAmount,
          currency, status: "failed", customer_phone: wallet, fee_amount: fee,
          metadata: { error: out.res.error, code: out.res.code },
        }),
      });
      // Nothing was deducted, so the wallet stays untouched.
      return { success: false, error: message, data: { reference: ref, transaction_id: txnId, status: "failed" } };
    }

    await rest(accessToken, `/payout_requests`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId, amount: numAmount, currency, phone_number: wallet,
        network: bankName(bankCode), status: "processing",
        fee_amount: fee, provider_reference: out.platformReference, requested_at: now, processed_at: now,
      }),
    });

    await rest(accessToken, `/transactions`, {
      method: "POST",
      body: JSON.stringify({
        id: txnId, user_id: userId, reference: ref, type: "payout", amount: numAmount,
        currency, status: "pending", customer_phone: wallet, provider_reference: out.platformReference,
        fee_amount: fee, net_amount: numAmount, merchant_reference: ref,
        metadata: { platform_reference: out.platformReference, payout_type: payoutType, network: bankName(bankCode) },
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
      phone_number: wallet,
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
        amount: numAmount, currency, fee_amount: fee, total_deducted: totalDeduction,
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
    const refund = Number(txn.amount) + fee;
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
