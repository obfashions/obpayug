// Server-only: multi-country money, crypto, refunds and currency exchange.
// Uses ObPay's managed records (payment_records / merchant_balances).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Identity } from "./identity.server";

const db = () => supabaseAdmin as any;
const ok = (data: unknown) => ({ success: true, data });
const fail = (error: string) => ({ success: false, error });

export async function intlCollect(id: Identity, body: Record<string, any>) {
  const { apiCollect } = await import("./public-api.server");
  return apiCollect(id.userId, body, "dashboard");
}

export async function intlPayout(id: Identity, body: Record<string, any>) {
  const { apiPayout } = await import("./public-api.server");
  return apiPayout(id.userId, body, "dashboard");
}

export async function payoutMethods(currency: string) {
  const { getGatewayCreds, gatewayPayoutMethods } = await import("./gateway.server");
  const { SUPPORTED_MONEY_CURRENCIES } = await import("./countries");
  const creds = await getGatewayCreds();
  if (!creds) return fail("Payouts are temporarily unavailable.");
  const cur = String(currency || "UGX").toUpperCase();
  if (!SUPPORTED_MONEY_CURRENCIES.includes(cur)) return fail("Unsupported currency.");
  return ok(await gatewayPayoutMethods(creds, cur));
}

/* ── Refunds ─────────────────────────────────────────────── */

export async function listRefundable(id: Identity) {
  // Admins see every merchant's payments (refunds are an admin-only action after a fraud review).
  let pq = db().from("payment_records").select("merchant_id, reference, amount, currency, phone_number, description, created_at, source, metadata")
    .eq("type", "collection").eq("status", "success").order("created_at", { ascending: false }).limit(300);
  let rq = db().from("merchant_refunds").select("*").order("created_at", { ascending: false }).limit(300);
  let tq = db().from("transactions").select("user_id, reference, amount, currency, customer_phone, customer_name, description, created_at")
    .eq("type", "collection").eq("status", "success").order("created_at", { ascending: false }).limit(300);
  if (!id.isAdmin) { pq = pq.eq("merchant_id", id.userId); rq = rq.eq("merchant_id", id.userId); tq = tq.eq("user_id", id.userId); }
  const [{ data: records }, { data: refunds }, { data: txs }] = await Promise.all([pq, rq, id.isAdmin ? tq : Promise.resolve({ data: [] })]);
  const seen = new Set((records ?? []).map((r: any) => r.reference));
  const payments = [
    ...(records ?? []).map((r: any) => ({ ...r, name: r.metadata?.customer_name || null, metadata: undefined })),
    ...((txs as any[]) ?? []).filter((t) => !seen.has(t.reference)).map((t) => ({
      merchant_id: t.user_id, reference: t.reference, amount: Number(t.amount), currency: t.currency || "UGX",
      phone_number: t.customer_phone, description: t.description, created_at: t.created_at, source: "dashboard", name: t.customer_name,
    })),
  ].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
  let merchants: Record<string, string> = {};
  if (id.isAdmin) {
    const ids = [...new Set(payments.map((p: any) => p.merchant_id).concat((refunds ?? []).map((r: any) => r.merchant_id)))];
    if (ids.length) {
      const { data: profs } = await db().from("profiles").select("id, full_name, email").in("id", ids);
      merchants = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name || p.email || p.id]));
    }
  }
  return ok({ payments: id.isAdmin ? payments : [], refunds: refunds ?? [], merchants });
}

async function refundedSoFar(reference: string) {
  const { data } = await db().from("merchant_refunds").select("amount, status").eq("original_reference", reference);
  return (data ?? []).filter((r: any) => r.status !== "failed").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
}

/** Refunds a managed (API / payment link / Kenya / Rwanda) payment by sending the money back to the payer. */
export async function createRefund(id: Identity, body: Record<string, any>) {
  if (!id.isAdmin) return fail("Refunds are handled by ObPay support after a review.");
  const merchantId = String(body.merchant_id || "").trim();
  if (!merchantId) return fail("Pick the merchant's payment to refund.");
  const reference = String(body.reference || "").trim();
  const reason = String(body.reason || "").slice(0, 200);
  let { data: rec } = await db().from("payment_records").select("*")
    .eq("merchant_id", merchantId).eq("reference", reference).maybeSingle();
  if (!rec) {
    const { data: t } = await db().from("transactions").select("*").eq("user_id", merchantId).eq("reference", reference).maybeSingle();
    if (t) rec = { type: "collection", status: t.status, amount: Number(t.amount), currency: t.currency || "UGX", phone_number: t.customer_phone, metadata: { customer_name: t.customer_name } };
  }
  if (!rec || rec.type !== "collection" || rec.status !== "success") return fail("Only successful collections can be refunded.");
  if (!rec.phone_number) return fail("This payment has no phone number to refund to.");
  if (rec.currency === "USD") return fail("Crypto payments can't be refunded automatically.");
  const already = await refundedSoFar(reference);
  const left = Number(rec.amount) - already;
  const amount = body.amount ? Math.round(Number(body.amount)) : left;
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter a refund amount greater than zero.");
  if (amount > left) return fail(`You can refund at most ${left.toLocaleString()} ${rec.currency}.`);

  const refundRef = `RFD${Date.now().toString(36).toUpperCase()}`;
  const { apiPayout } = await import("./public-api.server");
  const res: any = await apiPayout(merchantId, {
    reference: refundRef,
    amount,
    currency: rec.currency,
    phone_number: rec.phone_number,
    customer_name: String(rec.metadata?.customer_name || "ObPay customer"),
    description: `Refund of ${reference}${reason ? ` – ${reason}` : ""}`,
  }, "refund", true);

  await db().from("merchant_refunds").insert({
    merchant_id: merchantId, original_reference: reference, refund_reference: refundRef, amount,
    currency: rec.currency, phone_number: rec.phone_number, reason: reason || null,
    status: res?.success ? "pending" : "failed", error: res?.success ? null : String(res?.error || "").slice(0, 300),
  });
  if (!res?.success) return fail(res?.error || "The refund could not be sent.");
  return ok({ refund_reference: refundRef, amount, currency: rec.currency, recipient_gets: res.data?.recipient_gets, status: "pending" });
}

/** Logs a refund sent through the dashboard's own payout (Uganda dashboard collections). */
export async function logRefund(id: Identity, body: Record<string, any>) {
  if (!id.isAdmin) return fail("Refunds are handled by ObPay support after a review.");
  const amount = Math.round(Number(body.amount));
  if (!body.original_reference || !amount) return fail("Missing refund details.");
  await db().from("merchant_refunds").insert({
    merchant_id: id.userId,
    original_reference: String(body.original_reference).slice(0, 60),
    refund_reference: String(body.refund_reference || `RFD${Date.now().toString(36).toUpperCase()}`).slice(0, 60),
    amount, currency: String(body.currency || "UGX"), phone_number: String(body.phone_number || "") || null,
    reason: String(body.reason || "").slice(0, 200) || null, status: body.status === "failed" ? "failed" : "pending",
    error: body.error ? String(body.error).slice(0, 300) : null,
  });
  return ok(true);
}

/* ── Currency exchange ───────────────────────────────────── */

let rateCache: { at: number; rates: Record<string, number> } | null = null;

export async function getRates() {
  if (!rateCache || Date.now() - rateCache.at > 10 * 60_000) {
    try {
      const resp = await fetch("https://open.er-api.com/v6/latest/USD");
      const j: any = await resp.json();
      if (j?.result === "success" && j.rates) {
        const { SUPPORTED_MONEY_CURRENCIES } = await import("./countries");
        const rates: Record<string, number> = { USD: 1 };
        for (const c of SUPPORTED_MONEY_CURRENCIES) {
          const v = Number(j.rates[c]);
          if (Number.isFinite(v) && v > 0) rates[c] = v;
        }
        rateCache = { at: Date.now(), rates };
      }
    } catch { /* keep old cache */ }
  }
  if (!rateCache) return fail("Exchange rates are unavailable right now. Try again shortly.");
  const fee = await exchangeFeePercent();
  return ok({ base: "USD", rates: rateCache.rates, fee_percent: fee, conversion_available: false, updated_at: new Date(rateCache.at).toISOString() });
}

async function exchangeFeePercent() {
  const { data } = await db().from("site_settings").select("value").eq("key", "exchange_fee_percent").maybeSingle();
  const v = Number(data?.value);
  return Number.isFinite(v) && v >= 0 && v <= 20 ? v : 1.5;
}

/** Accounts whose exchanges are handled manually by customer service. */
export const MANUAL_EXCHANGE_MERCHANTS = new Set(["2e213e51-8069-4795-9873-c95192306c8b"]);
export const MANUAL_EXCHANGE_NOTE = "Currency exchange for your account is handled manually. Please contact ObPay customer service to exchange funds. No money has been moved or charged.";

export async function convertBalance(id: Identity, body: Record<string, any>) {
  if (MANUAL_EXCHANGE_MERCHANTS.has(id.userId)) return fail(MANUAL_EXCHANGE_NOTE);
  const from = String(body.from || "").trim().toUpperCase();
  const to = String(body.to || "").trim().toUpperCase();
  const amount = Number(body.amount);
  const { SUPPORTED_MONEY_CURRENCIES } = await import("./countries");
  const all = SUPPORTED_MONEY_CURRENCIES;
  if (!all.includes(from) || !all.includes(to) || from === to) return fail("Choose two different currencies.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  if (from !== "USD" && !Number.isInteger(amount)) return fail(`Enter a whole ${from} amount.`);

  // 1. Confirm the merchant's own balance in the wallet being exchanged from.
  const { combinedBalances } = await import("./balance-values");
  const [{ data: wallet }, { data: managed }, { data: prof }] = await Promise.all([
    db().from("merchant_wallets").select("available_balance, currency, balances_by_currency").eq("user_id", id.userId).maybeSingle(),
    db().from("merchant_balances").select("currency, available_balance").eq("merchant_id", id.userId),
    db().from("profiles").select("default_currency").eq("id", id.userId).maybeSingle(),
  ]);
  const mine = combinedBalances(wallet, managed ?? [], prof?.default_currency || wallet?.currency || "UGX");
  const fromBalance = mine[from] || 0;
  if (amount > fromBalance) return fail(`Your ${from} wallet has ${fromBalance.toLocaleString()} ${from}, which is less than ${amount.toLocaleString()} ${from}. No money has been moved.`);

  // 2. Price the exchange.
  const r: any = await getRates();
  if (!r.success) return r;
  const rate = r.data.rates[to] / r.data.rates[from];
  const fee = r.data.fee_percent;
  const { exchangeReceive } = await import("./exchange-math");
  const receive = exchangeReceive(amount, rate, fee, to);
  if (!Number.isFinite(receive) || receive <= 0) return fail("This amount is too small to exchange.");

  // 3. The destination wallet must already hold enough real (partner) funds that
  //    are not owed to any merchant; otherwise the credit would be unbacked.
  const { getGatewayCreds, gatewayLiveBalances } = await import("./gateway.server");
  const creds = await getGatewayCreds();
  if (!creds) return fail("Currency exchange is unavailable right now. No money has been moved.");
  const live = (await gatewayLiveBalances(creds, [to]))[0];
  if (live?.available == null) return fail(`We couldn't confirm the ${to} wallet balance right now. Please try again shortly. No money has been moved.`);
  const [{ data: owedManaged }, { data: owedMain }] = await Promise.all([
    db().from("merchant_balances").select("available_balance").eq("currency", to),
    db().from("merchant_wallets").select("available_balance").eq("currency", to),
  ]);
  const owed = [...(owedManaged ?? []), ...(owedMain ?? [])].reduce((s: number, x: any) => s + Math.max(0, Number(x.available_balance) || 0), 0);
  const free = Math.max(0, live.available - owed);
  if (receive > free) {
    return fail(`The ${to} wallet doesn't have enough funds to complete this exchange right now (${receive.toLocaleString()} ${to} needed). Please try a smaller amount or another currency later. No money has been moved or charged.`);
  }

  const { error } = await db().rpc("exchange_wallet_balance", {
    p_merchant_id: id.userId, p_from: from, p_to: to, p_amount: amount, p_to_amount: receive, p_rate: rate, p_fee_percent: fee,
  });
  if (error) return fail(/insufficient/i.test(error.message) ? `Your ${from} wallet doesn't have enough funds. No money has been moved.` : "The exchange could not be completed. No money has been moved.");
  return ok({ from_amount: amount, to_amount: receive, rate, fee_percent: fee });
}

export async function listExchanges(id: Identity) {
  const { data } = await db().from("currency_exchanges").select("*").eq("merchant_id", id.userId)
    .order("created_at", { ascending: false }).limit(50);
  const rows: any = data ?? [];
  rows.manual = MANUAL_EXCHANGE_MERCHANTS.has(id.userId);
  return { success: true, data: rows, manual: rows.manual };
}
