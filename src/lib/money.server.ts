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
  const creds = await getGatewayCreds();
  if (!creds) return fail("Payouts are temporarily unavailable.");
  const cur = String(currency || "UGX").toUpperCase();
  if (!["UGX", "KES", "RWF", "USD"].includes(cur)) return fail("Unsupported currency.");
  return ok(await gatewayPayoutMethods(creds, cur));
}

/* ── Refunds ─────────────────────────────────────────────── */

export async function listRefundable(id: Identity) {
  const [{ data: records }, { data: refunds }] = await Promise.all([
    db().from("payment_records").select("reference, amount, currency, phone_number, description, created_at, source")
      .eq("merchant_id", id.userId).eq("type", "collection").eq("status", "success")
      .order("created_at", { ascending: false }).limit(200),
    db().from("merchant_refunds").select("*").eq("merchant_id", id.userId).order("created_at", { ascending: false }).limit(200),
  ]);
  return ok({ payments: records ?? [], refunds: refunds ?? [] });
}

async function refundedSoFar(reference: string) {
  const { data } = await db().from("merchant_refunds").select("amount, status").eq("original_reference", reference);
  return (data ?? []).filter((r: any) => r.status !== "failed").reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
}

/** Refunds a managed (API / payment link / Kenya / Rwanda) payment by sending the money back to the payer. */
export async function createRefund(id: Identity, body: Record<string, any>) {
  const reference = String(body.reference || "").trim();
  const reason = String(body.reason || "").slice(0, 200);
  const { data: rec } = await db().from("payment_records").select("*")
    .eq("merchant_id", id.userId).eq("reference", reference).maybeSingle();
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
  const res: any = await apiPayout(id.userId, {
    reference: refundRef,
    amount,
    currency: rec.currency,
    phone_number: rec.phone_number,
    customer_name: String(rec.metadata?.customer_name || "ObPay customer"),
    description: `Refund of ${reference}${reason ? ` – ${reason}` : ""}`,
  }, "refund");

  await db().from("merchant_refunds").insert({
    merchant_id: id.userId, original_reference: reference, refund_reference: refundRef, amount,
    currency: rec.currency, phone_number: rec.phone_number, reason: reason || null,
    status: res?.success ? "pending" : "failed", error: res?.success ? null : String(res?.error || "").slice(0, 300),
  });
  if (!res?.success) return fail(res?.error || "The refund could not be sent.");
  return ok({ refund_reference: refundRef, amount, currency: rec.currency, recipient_gets: res.data?.recipient_gets, status: "pending" });
}

/** Logs a refund sent through the dashboard's own payout (Uganda dashboard collections). */
export async function logRefund(id: Identity, body: Record<string, any>) {
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
        rateCache = { at: Date.now(), rates: { USD: 1, UGX: j.rates.UGX, KES: j.rates.KES, RWF: j.rates.RWF } };
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
  const all = ["UGX", "KES", "RWF", "USD"];
  if (!all.includes(from) || !all.includes(to) || from === to) return fail("Choose two different currencies.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter an amount greater than zero.");
  const r: any = await getRates();
  if (!r.success) return r;
  const { rates, fee_percent } = r.data;
  const { data: bal } = await db().from("merchant_balances").select("available_balance")
    .eq("merchant_id", id.userId).eq("currency", from).maybeSingle();
  const available = Number(bal?.available_balance || 0);
  if (amount > available) return fail(`Insufficient ${from} balance. Available: ${available.toLocaleString()} ${from}.`);
  const rate = rates[to] / rates[from];
  const raw = amount * rate * (1 - fee_percent / 100);
  const toAmount = to === "USD" ? Math.floor(raw * 100) / 100 : Math.floor(raw);
  if (toAmount <= 0) return fail("That amount is too small to convert.");

  const debit = await db().rpc("apply_merchant_balance_change", {
    p_merchant_id: id.userId, p_currency: from, p_available_delta: -amount, p_collections_delta: 0, p_payouts_delta: 0,
  });
  if (debit.error) return fail("The conversion could not be completed.");
  const credit = await db().rpc("apply_merchant_balance_change", {
    p_merchant_id: id.userId, p_currency: to, p_available_delta: toAmount, p_collections_delta: 0, p_payouts_delta: 0,
  });
  if (credit.error) {
    await db().rpc("apply_merchant_balance_change", {
      p_merchant_id: id.userId, p_currency: from, p_available_delta: amount, p_collections_delta: 0, p_payouts_delta: 0,
    });
    return fail("The conversion could not be completed.");
  }
  await db().from("currency_exchanges").insert({
    merchant_id: id.userId, from_currency: from, to_currency: to, from_amount: amount, to_amount: toAmount, rate, fee_percent,
  });
  return ok({ from, to, from_amount: amount, to_amount: toAmount, rate, fee_percent });
}

export async function listExchanges(id: Identity) {
  const { data } = await db().from("currency_exchanges").select("*").eq("merchant_id", id.userId)
    .order("created_at", { ascending: false }).limit(50);
  return ok(data ?? []);
}
