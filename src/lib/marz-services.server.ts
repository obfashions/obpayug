// Server-only handlers for the MarzPay service catalog beyond collections and
// payouts: bank transfers, bill payments, airtime & data, and the service list.
//
// Every money-moving action debits the merchant's ObPay wallet through Supabase
// REST with the CALLER's access token, so row level security still applies.

import { readMarzCreds, marzFetch, normalizePhone } from "./marz.server";

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

const unwrap = (res: { data: any }) => res.data?.data ?? res.data ?? null;

/** Read-only catalog/lookup actions — no merchant session required. */
export const MARZ_PUBLIC_SERVICE_ACTIONS = [
  "svc-list",
  "bank-banks",
  "bank-services",
  "bank-validate",
  "bill-services",
  "bill-areas",
  "bill-bouquets",
  "bill-verify",
  "airtime-catalog",
  "airtime-detect",
];

/** Actions that move money and therefore need a signed-in merchant. */
export const MARZ_PRIVATE_SERVICE_ACTIONS = [
  "bank-transfer",
  "bank-status",
  "bill-pay",
  "bill-status",
  "airtime-purchase",
  "airtime-status",
  "airtime-list",
];

export const MARZ_SERVICE_ACTIONS = [...MARZ_PUBLIC_SERVICE_ACTIONS, ...MARZ_PRIVATE_SERVICE_ACTIONS];

function fail(res: { error?: string; data?: any }, fallback: string) {
  const raw = (res?.error || res?.data?.message || "").toString();
  if (/insufficient/i.test(raw)) return "Your MarzPay float is too low for this request. Top it up and try again.";
  if (/not subscribed|SERVICE_NOT_SUBSCRIBED/i.test(raw))
    return "Your MarzPay account is not subscribed to this service. Enable it in the MarzPay service marketplace, then retry.";
  return raw || fallback;
}

async function bankCharge(amount: number): Promise<number> {
  const creds = readMarzCreds()!;
  const res = await marzFetch(creds, "/bank-transfer/services");
  const s = res.ok ? unwrap(res)?.bank_transfer_settings : null;
  if (!s) return 0;
  if ((s.amount_type || "").toLowerCase() === "percentage") {
    return Math.round((Number(s.charge_percentage || 0) / 100) * amount);
  }
  return Math.round(Number(s.fixed_transfer_charge || 0));
}

async function debitWallet(
  token: string,
  userId: string,
  opts: { amount: number; fee: number; currency: string; reference: string; description: string; meta: Record<string, unknown> },
) {
  const now = new Date().toISOString();
  const wallet = first(await rest(token, `/merchant_wallets?user_id=eq.${userId}&select=*`));
  const balance = Number(wallet?.available_balance || 0);
  await rest(token, `/merchant_wallets?user_id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      available_balance: Math.max(0, balance - (opts.amount + opts.fee)),
      total_payouts: Number(wallet?.total_payouts || 0) + opts.amount,
      updated_at: now,
    }),
  });
  await rest(token, `/transactions`, {
    method: "POST",
    body: JSON.stringify({
      id: crypto.randomUUID(),
      user_id: userId,
      reference: opts.reference,
      type: "payout",
      amount: opts.amount,
      currency: opts.currency,
      status: "pending",
      fee_amount: opts.fee,
      net_amount: opts.amount,
      description: opts.description,
      metadata: opts.meta,
      created_at: now,
    }),
  });
}

async function ensureFunds(token: string, userId: string, needed: number, currency: string) {
  const wallet = first(await rest(token, `/merchant_wallets?user_id=eq.${userId}&select=*`));
  const balance = Number(wallet?.available_balance || 0);
  if (balance < needed) {
    return `Insufficient balance. This request needs ${needed.toLocaleString()} ${currency} but your available balance is ${balance.toLocaleString()} ${currency}.`;
  }
  return null;
}

const newRef = (prefix: string) => `${prefix}${Date.now().toString(36).toUpperCase()}`;

export async function runMarzServiceAction(action: string, accessToken: string, userId: string | null, body: any) {
  const creds = readMarzCreds();
  if (!creds) return { success: false, error: "MarzPay credentials are not configured on the server." };
  const b = body || {};

  switch (action) {
    /* ── Service catalog ─────────────────────────────────── */
    case "svc-list": {
      const res = await marzFetch(creds, "/services");
      if (!res.ok) return { success: false, error: fail(res, "Could not load your MarzPay services.") };
      return { success: true, data: unwrap(res) };
    }

    /* ── Bank transfer ───────────────────────────────────── */
    case "bank-banks": {
      const res = await marzFetch(creds, "/bank-transfer/banks");
      if (!res.ok) return { success: false, error: fail(res, "Could not load the bank list.") };
      return { success: true, data: unwrap(res) };
    }
    case "bank-services": {
      const res = await marzFetch(creds, "/bank-transfer/services");
      if (!res.ok) return { success: false, error: fail(res, "Bank transfer service is unavailable.") };
      return { success: true, data: unwrap(res) };
    }
    case "bank-validate": {
      const res = await marzFetch(creds, "/bank-transfer/validate", {
        method: "POST",
        body: { bank_name: String(b.bankName || "").trim(), account_number: String(b.accountNumber || "").trim() },
      });
      if (!res.ok) return { success: false, error: fail(res, "That account could not be validated.") };
      return { success: true, data: unwrap(res) };
    }
    case "bank-transfer": {
      const amount = Math.round(Number(b.amount || 0));
      if (!amount || amount <= 0) return { success: false, error: "Enter an amount greater than zero." };
      if (!b.bankName || !b.accountNumber || !b.accountName)
        return { success: false, error: "Bank, account number and account name are required." };

      const currency = "UGX";
      const fee = await bankCharge(amount);
      const shortfall = await ensureFunds(accessToken, userId!, amount + fee, currency);
      if (shortfall) return { success: false, error: shortfall };

      const reference = newRef("BNK");
      const res = await marzFetch(creds, "/bank-transfer", {
        method: "POST",
        body: {
          amount,
          description: (b.description || "Bank transfer via ObPay").slice(0, 255),
          bank_name: b.bankName,
          bank_account_number: String(b.accountNumber),
          bank_account_name: b.accountName,
          ...(b.branch ? { bank_branch: b.branch } : {}),
          wallet_source: "main",
        },
      });
      if (!res.ok) return { success: false, error: fail(res, "The bank transfer was rejected.") };

      const data = unwrap(res) || {};
      const providerRef = data.transaction?.reference || data.reference || reference;
      await debitWallet(accessToken, userId!, {
        amount,
        fee,
        currency,
        reference,
        description: `Bank transfer to ${b.accountName} (${b.bankName})`,
        meta: { service: "bank_transfer", provider_reference: providerRef, bank: b.bankName, account: b.accountNumber },
      });
      return { success: true, data: { reference, provider_reference: providerRef, amount, fee, currency, raw: data } };
    }
    case "bank-status": {
      const res = await marzFetch(creds, `/bank-transfer/${encodeURIComponent(String(b.reference || ""))}`);
      if (!res.ok) return { success: false, error: fail(res, "Could not fetch that transfer.") };
      return { success: true, data: unwrap(res) };
    }

    /* ── Bill payments ───────────────────────────────────── */
    case "bill-services": {
      const res = await marzFetch(creds, "/bill-payment/services");
      if (!res.ok) return { success: false, error: fail(res, "Bill payments are unavailable.") };
      return { success: true, data: unwrap(res) };
    }
    case "bill-areas": {
      const res = await marzFetch(creds, "/bill-payment/nwsc/areas");
      if (!res.ok) return { success: false, error: fail(res, "Could not load NWSC areas.") };
      return { success: true, data: unwrap(res) };
    }
    case "bill-bouquets": {
      const utility = String(b.utilityCode || "DSTV").toLowerCase() === "gotv" ? "gotv" : "dstv";
      const res = await marzFetch(creds, `/bill-payment/${utility}/bouquet-codes`);
      if (!res.ok) return { success: false, error: fail(res, "Could not load bouquets.") };
      return { success: true, data: unwrap(res) };
    }
    case "bill-verify": {
      const payload: Record<string, unknown> = {
        utility_code: String(b.utilityCode || "").toUpperCase(),
        meter_number: String(b.meterNumber || "").trim(),
      };
      if (b.area) payload.area = b.area;
      const res = await marzFetch(creds, "/bill-payment/verify", { method: "POST", body: payload });
      if (!res.ok) return { success: false, error: fail(res, "That meter or account could not be verified.") };
      return { success: true, data: unwrap(res) };
    }
    case "bill-pay": {
      const amount = Math.round(Number(b.amount || 0));
      const utility = String(b.utilityCode || "").toUpperCase();
      if (!utility || !b.meterNumber) return { success: false, error: "Utility and meter/account number are required." };
      if (!amount || amount < 1000) return { success: false, error: "The minimum bill payment is 1,000 UGX." };
      if (!b.phoneNumber) return { success: false, error: "A contact phone number is required." };

      const currency = "UGX";
      const svc = await marzFetch(creds, "/bill-payment/services");
      const fee = svc.ok ? Math.round(Number(unwrap(svc)?.bill_payment_settings?.charge_amount?.raw || 0)) : 0;
      const shortfall = await ensureFunds(accessToken, userId!, amount + fee, currency);
      if (shortfall) return { success: false, error: shortfall };

      const reference = crypto.randomUUID();
      const payload: Record<string, unknown> = {
        reference,
        utility_code: utility,
        meter_number: String(b.meterNumber).trim(),
        phone_number: normalizePhone(b.phoneNumber, currency),
        amount,
        ...(b.customerName ? { customer_name: b.customerName } : {}),
        ...(b.email ? { email: b.email } : {}),
        ...(b.area ? { area: b.area } : {}),
        ...(b.bouquetCode ? { bouquet_code: b.bouquetCode } : {}),
      };
      const res = await marzFetch(creds, "/bill-payment", { method: "POST", body: payload });
      if (!res.ok) return { success: false, error: fail(res, "The bill payment was rejected.") };

      const localRef = newRef("BIL");
      await debitWallet(accessToken, userId!, {
        amount,
        fee,
        currency,
        reference: localRef,
        description: `${utility} bill payment — ${b.meterNumber}`,
        meta: { service: "bill_payment", utility, meter_number: b.meterNumber, provider_reference: reference },
      });
      return { success: true, data: { reference: localRef, provider_reference: reference, amount, fee, currency, raw: unwrap(res) } };
    }
    case "bill-status": {
      const res = await marzFetch(creds, `/bill-payment/${encodeURIComponent(String(b.reference || ""))}`);
      if (!res.ok) return { success: false, error: fail(res, "Could not fetch that bill payment.") };
      return { success: true, data: unwrap(res) };
    }

    /* ── Airtime & data ──────────────────────────────────── */
    case "airtime-catalog": {
      const res = await marzFetch(creds, "/airtime-data/catalog");
      if (!res.ok) return { success: false, error: fail(res, "Could not load the airtime catalog.") };
      return { success: true, data: unwrap(res) };
    }
    case "airtime-detect": {
      const msisdn = normalizePhone(b.msisdn || b.phoneNumber, "UGX").replace(/^\+/, "");
      const res = await marzFetch(creds, `/airtime-data/detect-network?msisdn=${encodeURIComponent(msisdn)}`);
      if (!res.ok) return { success: false, error: fail(res, "Could not detect that network.") };
      return { success: true, data: unwrap(res) };
    }
    case "airtime-purchase": {
      const type = b.purchaseType === "bundle" ? "bundle" : "airtime";
      const msisdn = normalizePhone(b.msisdn || b.phoneNumber, "UGX").replace(/^\+/, "");
      if (!msisdn) return { success: false, error: "A phone number is required." };

      const currency = "UGX";
      const amount = Math.round(Number(b.amount || 0));
      if (type === "airtime" && (!amount || amount < 500)) return { success: false, error: "The minimum airtime purchase is 500 UGX." };
      if (type === "bundle" && !b.bundleId) return { success: false, error: "Choose a data bundle." };

      const charge = type === "bundle" ? Math.round(Number(b.bundlePrice || 0)) : amount;
      const shortfall = await ensureFunds(accessToken, userId!, charge, currency);
      if (shortfall) return { success: false, error: shortfall };

      const reference = crypto.randomUUID();
      const res = await marzFetch(creds, "/airtime-data", {
        method: "POST",
        body: {
          reference,
          purchase_type: type,
          msisdn,
          ...(type === "airtime" ? { amount } : { bundle_id: b.bundleId }),
        },
      });
      if (!res.ok) return { success: false, error: fail(res, "The purchase was rejected.") };

      const localRef = newRef("AIR");
      await debitWallet(accessToken, userId!, {
        amount: charge,
        fee: 0,
        currency,
        reference: localRef,
        description: type === "bundle" ? `Data bundle for ${msisdn}` : `Airtime for ${msisdn}`,
        meta: { service: "airtime_data", purchase_type: type, msisdn, provider_reference: reference },
      });
      return { success: true, data: { reference: localRef, provider_reference: reference, amount: charge, currency, raw: unwrap(res) } };
    }
    case "airtime-status": {
      const res = await marzFetch(creds, `/airtime-data/${encodeURIComponent(String(b.reference || ""))}`);
      if (!res.ok) return { success: false, error: fail(res, "Could not fetch that purchase.") };
      return { success: true, data: unwrap(res) };
    }
    case "airtime-list": {
      const res = await marzFetch(creds, "/airtime-data");
      if (!res.ok) return { success: false, error: fail(res, "Could not load purchases.") };
      return { success: true, data: unwrap(res) };
    }
  }

  return { success: false, error: `Unsupported action: ${action}` };
}
