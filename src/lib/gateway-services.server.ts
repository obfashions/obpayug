// Server-only handlers for the extra money-movement services ObPay offers on
// top of collections and mobile money payouts: bank transfers to any Ugandan
// bank, plus the service catalog.
//
// Every money-moving action debits the merchant's ObPay wallet through Supabase
// REST with the CALLER's access token, so row level security still applies.

import {
  getGatewayCreds,
  gatewayPayout,
  gatewayPayoutStatus,
  friendlyError,
  UG_BANKS,
  MOBILE_NETWORKS,
  walletNumber,
} from "./gateway.server";

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

/** Read-only catalog/lookup actions — no merchant session required. */
export const SERVICE_PUBLIC_ACTIONS = [
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
export const SERVICE_PRIVATE_ACTIONS = [
  "bank-transfer",
  "bank-status",
  "bill-pay",
  "bill-status",
  "airtime-purchase",
  "airtime-status",
  "airtime-list",
];

export const SERVICE_ACTIONS = [...SERVICE_PUBLIC_ACTIONS, ...SERVICE_PRIVATE_ACTIONS];

/** Services the current banking partner does not offer. */
const UNAVAILABLE = new Set([
  "bill-services",
  "bill-areas",
  "bill-bouquets",
  "bill-verify",
  "bill-pay",
  "bill-status",
  "airtime-catalog",
  "airtime-detect",
  "airtime-purchase",
  "airtime-status",
  "airtime-list",
]);

const UNAVAILABLE_MESSAGE =
  "Bill payments, airtime and data bundles are not available on ObPay yet. Collections, mobile money payouts and bank transfers are live.";

/** Flat bank-transfer charge, taken from the platform settings row. */
async function bankCharge(token: string, amount: number): Promise<number> {
  const ps = first(await rest(token, `/platform_settings?select=payout_flat_fee,withdraw_fee_percent&limit=1`));
  const flat = Number(ps?.payout_flat_fee ?? 1020);
  return Number.isFinite(flat) && flat >= 0 ? Math.round(flat) : 0;
  void amount;
}

async function ensureFunds(token: string, userId: string, needed: number, currency: string) {
  const wallet = first(await rest(token, `/merchant_wallets?user_id=eq.${userId}&select=*`));
  const balance = Number(wallet?.available_balance || 0);
  if (balance < needed) {
    return `Insufficient balance. This request needs ${needed.toLocaleString()} ${currency} but your available balance is ${balance.toLocaleString()} ${currency}.`;
  }
  return null;
}

async function debitWallet(
  token: string,
  userId: string,
  opts: {
    amount: number;
    fee: number;
    currency: string;
    reference: string;
    description: string;
    meta: Record<string, unknown>;
    providerReference?: string | null;
  },
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
      merchant_reference: opts.reference,
      ...(opts.providerReference ? { provider_reference: opts.providerReference } : {}),
      metadata: opts.meta,
      created_at: now,
    }),
  });
}

const newRef = (prefix: string) =>
  `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase()}`;

function bankCodeFor(input: string): string {
  const value = String(input || "").trim();
  if (/^UG\d{4}$/i.test(value)) return value.toUpperCase();
  const match = [...UG_BANKS, ...MOBILE_NETWORKS].find(
    (b) => b.name.toLowerCase() === value.toLowerCase() || b.name.toLowerCase().includes(value.toLowerCase()),
  );
  return match?.code || "";
}

export async function runServiceAction(action: string, accessToken: string, userId: string | null, body: any) {
  const b = body || {};

  if (UNAVAILABLE.has(action)) return { success: false, error: UNAVAILABLE_MESSAGE };

  switch (action) {
    case "svc-list":
      return {
        success: true,
        data: {
          services: [
            { code: "collections", name: "Mobile money collections", status: "active" },
            { code: "payouts", name: "Mobile money payouts", status: "active" },
            { code: "bank_transfer", name: "Bank transfers", status: "active" },
            { code: "bill_payment", name: "Bill payments", status: "coming_soon" },
            { code: "airtime_data", name: "Airtime & data", status: "coming_soon" },
          ],
        },
      };

    case "bank-banks":
      return { success: true, data: { banks: UG_BANKS } };

    case "bank-services": {
      const fee = await bankCharge(accessToken, 0);
      return {
        success: true,
        data: {
          bank_transfer_settings: {
            minimum_transfer_amount: 1000,
            maximum_transfer_amount: 20000000,
            amount_type: "fixed",
            fixed_transfer_charge: fee,
            charge_percentage: 0,
          },
        },
      };
    }

    case "bank-validate":
      return {
        success: false,
        error:
          "Account names cannot be checked automatically for bank transfers. Type the account name exactly as it appears on the bank statement.",
      };

    case "bank-transfer": {
      const creds = await getGatewayCreds();
      if (!creds) return { success: false, error: "Transfers are temporarily unavailable. Please try again shortly." };

      const amount = Math.round(Number(b.amount || 0));
      if (!amount || amount <= 0) return { success: false, error: "Enter an amount greater than zero." };
      const bankCode = bankCodeFor(b.bankCode || b.bankName);
      if (!bankCode) return { success: false, error: "Choose a bank from the list." };
      const accountNumber = String(b.accountNumber || "").replace(/\s/g, "");
      if (!accountNumber) return { success: false, error: "Enter the account number." };
      if (!b.accountName) return { success: false, error: "Enter the account name." };

      const currency = "UGX";
      const fee = await bankCharge(accessToken, amount);
      const shortfall = await ensureFunds(accessToken, userId!, amount + fee, currency);
      if (shortfall) return { success: false, error: shortfall };

      const reference = newRef("BNK");
      const out = await gatewayPayout(creds, {
        reference,
        amount,
        typeTrans: 3,
        bankCode,
        accountNumber,
        customerName: String(b.accountName),
        remark: String(b.description || "Bank transfer via ObPay"),
      });
      if (!out.ok) return { success: false, error: friendlyError(out.res, "payout") };

      await debitWallet(accessToken, userId!, {
        amount,
        fee,
        currency,
        reference,
        description: `Bank transfer to ${b.accountName}`,
        providerReference: out.platformReference,
        meta: {
          service: "bank_transfer",
          provider_reference: out.platformReference,
          bank_code: bankCode,
          account: accountNumber,
        },
      });
      return {
        success: true,
        data: { reference, provider_reference: out.platformReference, amount, fee, currency },
      };
    }

    case "bank-status": {
      const creds = await getGatewayCreds();
      if (!creds) return { success: false, error: "Transfers are temporarily unavailable." };
      const ref = String(b.reference || "").trim();
      if (!ref) return { success: false, error: "Enter a transfer reference." };
      const out = await gatewayPayoutStatus(creds, {
        merchantReference: ref.startsWith("P") ? null : ref,
        platformReference: ref.startsWith("P") ? ref : null,
      });
      if (!out.ok) return { success: false, error: friendlyError(out.res || {}, "request") };
      return {
        success: true,
        data: { reference: ref, status: out.status, amount: out.amount, transferred_at: out.transferredAt, reason: out.reason },
      };
    }
  }

  return { success: false, error: `Unsupported action: ${action}` };
}

export { walletNumber };
