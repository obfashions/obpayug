// Server-only: multi-country money, crypto, refunds and currency exchange.
// Uses ObPay's managed records (payment_records / merchant_balances).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { exchangeReceive } from "./exchange-math";
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
  return ok({ base: "USD", rates: rateCache.rates, fee_percent: fee, updated_at: new Date(rateCache.at).toISOString() });
}

async function exchangeFeePercent() {
  const { data } = await db().from("site_settings").select("value").eq("key", "exchange_fee_percent").maybeSingle();
  const v = Number(data?.value);
  return Number.isFinite(v) && v >= 0 && v <= 20 ? v : 1.5;
}

export async function convertBalance(id: Identity, body: Record<string, any>) {
  const from = String(body.from || "").toUpperCase();
  const to = String(body.to || "").toUpperCase();
  const amount = Number(body.amount);
  const { SUPPORTED_MONEY_CURRENCIES } = await import("./countries");
  const all = SUPPORTED_MONEY_CURRENCIES;
  if (!all.includes(from) || !all.includes(to) || from === to) return fail("Choose two different currencies.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  const r: any = await getRates();
  if (!r.success) return r;
  const { rates, fee_percent } = r.data;
  const rate = rates[to] / rates[from];
  const toAmount = exchangeReceive(amount, rate, fee_percent, to);
  if (toAmount <= 0) return fail("That amount is too small to convert.");

  // Atomic across the main wallet and the managed store: checks the combined balance,
  // debits the source wallet and credits the destination wallet in one transaction.
  const { data, error } = await db().rpc("exchange_wallet_balance", {
    p_merchant_id: id.userId, p_from: from, p_to: to,
    p_amount: amount, p_to_amount: toAmount, p_rate: rate, p_fee_percent: fee_percent,
  });
  if (error) {
    const msg = String(error.message || "");
    if (msg.startsWith("Insufficient") || msg.startsWith("Choose") || msg.startsWith("Invalid")) return fail(msg);
    return fail("The conversion could not be completed.");
  }
  return ok(data);
}

export async function listExchanges(id: Identity) {
  const { data } = await db().from("currency_exchanges").select("*").eq("merchant_id", id.userId)
    .order("created_at", { ascending: false }).limit(50);
  return ok(data ?? []);
}
