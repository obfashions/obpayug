// Server-only ObPay payment engine.
//
// The deployed Supabase edge function cannot be updated from here, so all live
// MarzPay work (collections, payouts, status sync, balance) runs in this
// project's server runtime using the credentials held in its environment.
// Database writes go through Supabase REST with the CALLER's access token, so
// row level security still applies exactly as it would in the browser.

import { readMarzCreds, marzFetch, isIpWhitelistError, verifySupabaseUser, normalizePhone, getEgressIp } from "./marz.server";

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

const first = (res: { data: any }) => (Array.isArray(res.data) ? res.data[0] || null : null);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const providerReference = (candidate?: string) =>
  candidate && UUID_V4.test(candidate.trim()) ? candidate.trim() : crypto.randomUUID();

function marzCountry(currency?: string): string {
  const map: Record<string, string> = { UGX: "UG", KES: "KE", GHS: "GH", XAF: "CM", TZS: "TZ" };
  return map[(currency || "UGX").toUpperCase()] || "UG";
}

function mapNetwork(network?: string): string {
  const lower = (network || "").toLowerCase().trim();
  if (!lower || lower === "bank" || lower === "card") return "MTN";
  if (lower.includes("airtel")) return "AIRTEL";
  if (lower.includes("mtn")) return "MTN";
  return network!.toUpperCase();
}

function normalizeStatus(raw: string): "pending" | "success" | "failed" | null {
  const s = (raw || "").toLowerCase().trim();
  if (["success", "successful", "completed", "sandbox"].includes(s)) return "success";
  if (["failed", "failure", "rejected", "declined", "cancelled", "canceled", "expired"].includes(s)) return "failed";
  if (["pending", "processing", "in_progress", "initiated"].includes(s)) return "pending";
  return null;
}

/** Turns raw provider errors into something a merchant can act on. */
async function friendlyProviderError(res: { error?: string; data?: any }, kind: "collection" | "payout"): Promise<string> {
  if (isIpWhitelistError(res)) {
    const ip = (await getEgressIp()) || "the IP shown in your MarzPay API logs";
    if (!proxyConfig()) {
      return `MarzPay blocked this ${kind} because it only accepts calls from whitelisted IP addresses, and this hosting platform sends each request from a different address (this one came from ${ip}). Connect the ObPay static-egress relay so every payout leaves from one fixed IP, then whitelist that single address in MarzPay → Security → IP Whitelist.`;
    }
    return kind === "payout"
      ? `MarzPay refused this payout because ${ip} is not on its IP whitelist. Open your MarzPay dashboard → Security → IP Whitelist, add ${ip}, save, then retry.`
      : `MarzPay refused this request because ${ip} is not whitelisted. Add it in MarzPay → Security → IP Whitelist, then try again.`;
  }
  const raw = (res?.error || "").toString();
  if (/insufficient/i.test(raw)) return "Your MarzPay float is too low for this transfer. Top it up and try again.";
  if (/invalid api credentials/i.test(raw)) return "MarzPay rejected the API credentials. Update them in Admin → Settings.";
  if (/phone|msisdn/i.test(raw) && /invalid/i.test(raw)) return "That phone number is not valid for mobile money. Use the 2567XXXXXXXX format.";
  if (/not subscribed|SERVICE_NOT_SUBSCRIBED/i.test(raw)) return "Your MarzPay account is not subscribed to the disbursement service. Enable it in the MarzPay service marketplace.";
  return raw || `The ${kind} could not be processed. Please try again.`;
}

// ─── MarzPay wrappers ─────────────────────────────────────────

async function marzTxn(reference: string) {
  const creds = readMarzCreds()!;
  const res = await marzFetch(creds, `/transactions/${encodeURIComponent(reference)}`);
  if (!res.ok) return { ok: false as const, error: res.error, data: res.data };
  const body = res.data?.data || res.data || {};
  const txn = body.transaction || {};
  const detail = body.collection || body.disbursement || {};
  return {
    ok: true as const,
    data: {
      status: txn.status || "",
      uuid: txn.uuid || "",
      reference: txn.reference || reference,
      charge: Number(detail.charge?.raw ?? detail.charge ?? 0) || 0,
      provider_transaction_id: detail.provider_transaction_id || "",
      amount: txn.amount?.raw ?? null,
      currency: txn.amount?.currency || "UGX",
    },
  };
}

// ─── Pending-transaction resolution ───────────────────────────

async function resolveTransaction(token: string, txn: any) {
  const meta = txn.metadata || {};
  const lookupRef = meta.lp_internal_ref || meta.lp_reference || txn.merchant_reference || txn.provider_reference || txn.reference;
  if (!lookupRef) return null;

  const res = await marzTxn(String(lookupRef));
  if (!res.ok) return null;

  const status = normalizeStatus(res.data.status);
  if (!status || status === "pending") return null;

  const now = new Date().toISOString();
  const fee = res.data.charge > 0 ? res.data.charge : Number(txn.fee_amount || 0);
  const updates: Record<string, unknown> = {
    status,
    fee_amount: fee,
    ...(res.data.uuid ? { provider_reference: res.data.uuid } : {}),
    ...(status === "success" ? { completed_at: now, net_amount: Number(txn.amount) - fee } : {}),
  };

  const upd = await rest(token, `/transactions?id=eq.${txn.id}&status=eq.pending`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  // Someone else (webhook/other tab) already resolved it — do not touch the wallet twice.
  if (!upd.ok || !Array.isArray(upd.data) || upd.data.length === 0) return null;

  const walletRes = await rest(token, `/merchant_wallets?user_id=eq.${txn.user_id}&select=*`);
  const wallet = first(walletRes);

  if (status === "success" && txn.type === "collection") {
    const credit = Number(txn.amount) - fee;
    if (wallet) {
      await rest(token, `/merchant_wallets?user_id=eq.${txn.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          available_balance: Number(wallet.available_balance || 0) + credit,
          total_collections: Number(wallet.total_collections || 0) + credit,
          updated_at: now,
        }),
      });
    } else {
      await rest(token, `/merchant_wallets`, {
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
    await rest(token, `/merchant_wallets?user_id=eq.${txn.user_id}`, {
      method: "PATCH",
      body: JSON.stringify({
        available_balance: Number(wallet.available_balance || 0) + refund,
        total_payouts: Math.max(0, Number(wallet.total_payouts || 0) - Number(txn.amount)),
        updated_at: now,
      }),
    });
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
  return { checked: rows.length, resolved };
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
];

export async function runObpayAction(action: string, accessToken: string, body: any) {
  const creds = readMarzCreds();
  if (!creds) return { success: false, error: "MarzPay credentials are not configured on the server." };

  // The public IP MarzPay sees — this is what must be whitelisted for payouts.
  if (action === "server-ip") {
    return { success: true, data: { ip: await getEgressIp() } };
  }

  // Checks whether disbursements are currently allowed from this server.
  if (action === "payout-preflight") {
    const svc = await marzFetch(creds, "/send-money/services");
    const bal = await marzFetch(creds, "/balance");
    const ip = await getEgressIp();
    if (bal.ok) {
      return { success: true, data: { ip, disbursement_ready: true, subscribed: svc.ok, balance: bal.data?.data ?? null } };
    }
    return {
      success: true,
      data: {
        ip,
        disbursement_ready: false,
        subscribed: svc.ok,
        blocked_by_ip_whitelist: isIpWhitelistError(bal),
        message: await friendlyProviderError(bal, "payout"),
      },
    };
  }

  // Actions that do not need a signed-in merchant.
  if (action === "verify-phone" || action === "verify-number") {

    const res = await marzFetch(creds, "/phone-verification/verify", {
      method: "POST",
      body: { phone_number: normalizePhone(body?.phoneNumber, body?.currency) },
    });
    if (!res.ok) return { success: false, error: res.error || "Could not verify that number." };
    const d = res.data?.data || {};
    return {
      success: true,
      data: {
        customer_name: d.full_name || [d.first_name, d.last_name].filter(Boolean).join(" ") || d.name || d.customer_name || null,
        phone_number: d.phone_number || res.data?.phone_number || null,
        network: (d.provider || d.network || "").toUpperCase(),
      },
    };
  }

  if (action === "test-connection") {
    const res = await marzFetch(creds, "/transactions?per_page=1");
    if (res.ok) {
      const account = res.data?.data?.account || null;
      return { success: true, data: { status: "connected", provider: "marzpay", balance: account?.current_balance ?? null, account } };
    }
    if (isIpWhitelistError(res)) {
      return {
        success: true,
        data: {
          status: "connected",
          provider: "marzpay",
          balance_restricted: true,
          note: "Connected to MarzPay. Live balance is hidden because MarzPay limits that endpoint to whitelisted IPs.",
        },
      };
    }
    return { success: false, error: res.error || "MarzPay rejected the credentials." };
  }

  const userId = await verifySupabaseUser(accessToken);
  if (!userId) return { success: false, error: "Please sign in again to continue." };

  // ── Balance ──────────────────────────────────────────────
  if (action === "balance") {
    const wallet = first(await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}&select=*`));
    let providerBalance: any = null;
    const res = await marzFetch(creds, "/transactions?per_page=1");
    if (res.ok) providerBalance = res.data?.data?.account?.current_balance ?? null;
    return {
      success: true,
      data: {
        available_balance: wallet?.available_balance || 0,
        pending_balance: wallet?.pending_balance || 0,
        total_collections: wallet?.total_collections || 0,
        total_payouts: wallet?.total_payouts || 0,
        currency: wallet?.currency || "UGX",
        withdrawals_enabled: wallet?.withdrawals_enabled !== false,
        provider_balance: providerBalance,
      },
    };
  }

  // ── Sync pending ─────────────────────────────────────────
  if (action === "sync-all-pending") {
    const out = await syncPending(accessToken, userId);
    return { success: true, data: out };
  }

  // ── Single transaction status ────────────────────────────
  if (action === "transaction-status" || action === "check-transaction") {
    const reference = String(body?.reference || "").trim();
    if (!reference) return { success: false, error: "A transaction reference is required." };
    const row = first(await rest(accessToken, `/transactions?user_id=eq.${userId}&reference=eq.${encodeURIComponent(reference)}&select=*`));
    if (row && row.status === "pending") await resolveTransaction(accessToken, row);
    const fresh = row
      ? first(await rest(accessToken, `/transactions?id=eq.${row.id}&select=*`))
      : null;
    const provider = await marzTxn(fresh?.metadata?.lp_internal_ref || fresh?.metadata?.lp_reference || reference);
    return {
      success: true,
      data: {
        status: fresh?.status || (provider.ok ? normalizeStatus(provider.data.status) : "unknown"),
        reference,
        transaction: fresh,
        provider: provider.ok ? provider.data : null,
      },
    };
  }

  // ── Collect ──────────────────────────────────────────────
  if (action === "collect") {
    const { phoneNumber, amount, currency, description, customerName, network } = body || {};
    const numAmount = Number(amount);
    if (!phoneNumber || !numAmount || !currency) return { success: false, error: "Phone number, amount and currency are required." };
    if (numAmount <= 0) return { success: false, error: "Enter an amount greater than zero." };

    const ref = String(body?.reference || `COL${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
    const dup = first(await rest(accessToken, `/transactions?reference=eq.${encodeURIComponent(ref)}&select=id`));
    if (dup) return { success: false, error: `Reference "${ref}" has already been used.` };

    const providerRef = providerReference();
    const res = await marzFetch(creds, "/collect-money", {
      method: "POST",
      body: {
        amount: Math.round(numAmount),
        phone_number: normalizePhone(phoneNumber, currency),
        method: "mobile_money",
        country: marzCountry(currency),
        reference: providerRef,
        description: (description || "Collection via ObPay").slice(0, 255),
      },
    });

    const txnId = crypto.randomUUID();
    if (!res.ok) {
      await rest(accessToken, `/transactions`, {
        method: "POST",
        body: JSON.stringify({
          id: txnId, user_id: userId, reference: ref, type: "collection", amount: numAmount,
          currency, status: "failed", customer_phone: phoneNumber,
          metadata: { error: res.error, httpStatus: res.httpStatus },
        }),
      });
      return { success: false, error: await friendlyProviderError(res, "collection"), data: { reference: ref, transaction_id: txnId, status: "failed" } };
    }

    const d = res.data?.data || {};
    const lpRef = d.transaction?.reference || providerRef;
    const internalRef = d.transaction?.uuid || "";
    await rest(accessToken, `/transactions`, {
      method: "POST",
      body: JSON.stringify({
        id: txnId, user_id: userId, reference: ref, type: "collection", amount: numAmount,
        currency, status: "pending", customer_phone: phoneNumber, customer_name: customerName || "",
        description: description || "", merchant_reference: lpRef,
        metadata: { lp_reference: lpRef, lp_internal_ref: internalRef, network: (d.collection?.provider || mapNetwork(network)).toUpperCase() },
        created_at: new Date().toISOString(),
      }),
    });

    return {
      success: true,
      data: {
        reference: ref, transaction_id: txnId, lp_reference: lpRef, provider_uuid: internalRef,
        status: "pending", amount: numAmount, currency,
        message: "Payment request sent. Ask the customer to approve the prompt on their phone.",
      },
    };
  }

  // ── Payout / withdrawal ──────────────────────────────────
  if (action === "payout") {
    const { phoneNumber, amount, currency, description, network } = body || {};
    const payoutType = body?.payout_type || body?._payout_type || "send";
    const numAmount = Number(amount);
    if (!phoneNumber || !numAmount || !currency) return { success: false, error: "Phone number, amount and currency are required." };
    if (numAmount <= 0) return { success: false, error: "Enter an amount greater than zero." };

    const wallet = first(await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}&select=*`));
    if (wallet && wallet.withdrawals_enabled === false) {
      return { success: false, error: "Withdrawals are currently disabled on your account. Please contact support." };
    }

    const ps = first(await rest(accessToken, `/platform_settings?select=payout_flat_fee,withdraw_fee_percent&limit=1`));
    const isWithdraw = payoutType === "withdraw";
    const fee = isWithdraw
      ? Math.round(numAmount * (Number(ps?.withdraw_fee_percent ?? 9) / 100))
      : Number(ps?.payout_flat_fee ?? 1020);
    const totalDeduction = numAmount + fee;

    const balance = Number(wallet?.available_balance || 0);
    if (balance < totalDeduction) {
      return {
        success: false,
        error: `Insufficient balance. This payout needs ${totalDeduction.toLocaleString()} ${currency} (including a ${fee.toLocaleString()} ${currency} fee) but your available balance is ${balance.toLocaleString()} ${currency}.`,
      };
    }

    const ref = String(body?.reference || `PAY${Date.now().toString(36).toUpperCase()}`).replace(/\s/g, "").slice(0, 30);
    const providerRef = providerReference();
    const now = new Date().toISOString();
    const txnId = crypto.randomUUID();

    const res = await marzFetch(creds, "/send-money", {
      method: "POST",
      body: {
        amount: Math.round(numAmount),
        phone_number: normalizePhone(phoneNumber, currency),
        country: marzCountry(currency),
        reference: providerRef,
        description: (description || (isWithdraw ? "Withdrawal" : "Payout")).slice(0, 255),
      },
    });

    if (!res.ok) {
      const message = await friendlyProviderError(res, "payout");
      await rest(accessToken, `/payout_requests`, {
        method: "POST",
        body: JSON.stringify({
          user_id: userId, amount: numAmount, currency, phone_number: phoneNumber,
          network: mapNetwork(network), status: "failed", fee_amount: fee,
          rejection_reason: message, requested_at: now,
        }),
      });
      await rest(accessToken, `/transactions`, {
        method: "POST",
        body: JSON.stringify({
          id: txnId, user_id: userId, reference: ref, type: "payout", amount: numAmount,
          currency, status: "failed", customer_phone: phoneNumber, fee_amount: fee,
          metadata: { error: res.error, httpStatus: res.httpStatus },
        }),
      });
      // Nothing was deducted, so the wallet stays untouched.
      return { success: false, error: message, data: { reference: ref, transaction_id: txnId, status: "failed" } };
    }

    const d = res.data?.data || {};
    const lpRef = d.transaction?.reference || providerRef;
    const internalRef = d.transaction?.uuid || "";
    const providerStatus = normalizeStatus(d.transaction?.status || "") || "pending";
    const dbStatus = providerStatus === "success" ? "success" : "pending";

    await rest(accessToken, `/payout_requests`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId, amount: numAmount, currency, phone_number: phoneNumber,
        network: mapNetwork(network), status: dbStatus === "success" ? "completed" : "processing",
        fee_amount: fee, provider_reference: lpRef, requested_at: now, processed_at: now,
        ...(dbStatus === "success" ? { completed_at: now } : {}),
      }),
    });

    await rest(accessToken, `/transactions`, {
      method: "POST",
      body: JSON.stringify({
        id: txnId, user_id: userId, reference: ref, type: "payout", amount: numAmount,
        currency, status: dbStatus, customer_phone: phoneNumber, provider_reference: internalRef || lpRef,
        fee_amount: fee, net_amount: numAmount, merchant_reference: lpRef,
        ...(dbStatus === "success" ? { completed_at: now } : {}),
        metadata: { lp_reference: lpRef, lp_internal_ref: internalRef, payout_type: payoutType },
        created_at: now,
      }),
    });

    // Funds leave the wallet as soon as MarzPay accepts the disbursement; a later
    // failure is refunded by the pending-transaction sync.
    await rest(accessToken, `/merchant_wallets?user_id=eq.${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        available_balance: balance - totalDeduction,
        total_payouts: Number(wallet?.total_payouts || 0) + numAmount,
        updated_at: now,
      }),
    });

    return {
      success: true,
      data: {
        transaction_id: txnId, reference: ref, lp_reference: lpRef, status: dbStatus,
        amount: numAmount, currency, fee_amount: fee, total_deducted: totalDeduction,
      },
    };
  }

  return { success: false, error: `Unsupported action: ${action}` };
}
