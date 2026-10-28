// Secondary-provider boundary. Never route primary mobile-money payments here.
import { z } from "zod";
import { airtimeInput, billInput, cardInput, moneyRaw, serviceReference, serviceState, ugPhone } from "./secondary-service-rules";
import { requireAdmin } from "./identity.server";

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
const fail = (error: string) => ({ success: false, error });
const ok = (data: any) => ({ success: true, data });
const UNAVAILABLE = "This service is temporarily unavailable. No money has been moved. Please contact ObPay support.";

export async function marzRequest(path: string, body?: Record<string, unknown>): Promise<any> {
  const key = process.env["UDC_MARZPAY_SERVICES_2_API_KEY"];
  const auth = process.env["LOVABLE_API_KEY"];
  if (!key || !auth) throw new Error(UNAVAILABLE);
  const response = await fetch(`https://connector-gateway.lovable.dev/udc_marzpay_services_2${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25000),
  });
  const text = await response.text();
  let out: any;
  try { out = JSON.parse(text); } catch { throw new Error(UNAVAILABLE); }
  if (!response.ok || out.status !== "success") {
    // Never relay upstream branding, credentials, or customer data to merchants.
    console.error("Secondary service request refused", response.status, String(out.error_code || "unknown"));
    throw new Error(UNAVAILABLE);
  }
  return out.data;
}

function cleanCatalog(data: any) {
  return {
    country: "UG", currency: "UGX",
    networks: (data.networks || []).map((n: any) => ({ code: n.code, airtime: n.airtime, bundles: n.bundles, min_airtime_amount: n.min_airtime_amount })),
    mtn: { bundles: data.mtn?.bundles || {} }, airtel: { bundles: data.airtel?.bundles || {} },
  };
}
export async function secondaryCatalog() {
  const [airtime, bills, bank, subscriptions] = await Promise.allSettled([
    marzRequest("/airtime-data/catalog"), marzRequest("/bill-payment/services"),
    marzRequest("/bank-transfer/services"), marzRequest("/services"),
  ]);
  const enabledCard = subscriptions.status === "fulfilled" && subscriptions.value.services?.some((s: any) => s.service?.name === "Card Payments" && s.availability?.is_subscribed && s.subscription?.status === "active");
  return [
    { code: "collections", name: "Mobile money collections", status: "active" },
    { code: "payouts", name: "Mobile money payouts", status: "active" },
    { code: "bill_payment", name: "Bill payments", status: bills.status === "fulfilled" ? "active" : "unavailable" },
    { code: "airtime_data", name: "Airtime & data", status: airtime.status === "fulfilled" ? "active" : "unavailable" },
    { code: "card_payments", name: "Card payments", status: enabledCard ? "active" : "unavailable" },
    { code: "bank_transfer", name: "Bank transfers", status: bank.status === "fulfilled" ? "manual_review" : "unavailable" },
  ];
}

function publicOrder(row: any) {
  return { reference: row.reference, amount: Number(row.amount), currency: row.currency, status: row.status,
    fee: Number(row.fee_amount), net_amount: row.net_amount, description: row.description,
    msisdn: row.phone_number, checkout_url: row.metadata?.checkout_url || null, created_at: row.created_at,
    balance_before: row.metadata?.balance_before, balance_after: row.metadata?.balance_after };
}

export async function refreshSecondaryRecord(row: any) {
  if (row.status !== "pending" || row.metadata?.provider !== "marz") return row;
  const service = row.metadata?.service;
  const root = service === "card_payments" ? "/collect-money" : service === "bill_payment" ? "/bill-payment" : "/airtime-data";
  // Bank-transfer submissions are disabled: no documented quote/idempotency contract.
  const details = await marzRequest(`${root}/${encodeURIComponent(row.metadata?.lookup_reference || row.reference)}`);
  const txn = details.transaction || details;
  const next = serviceState(txn.status);
  if (next === "pending") return row;
  const detail = details.bill_payment || details;
  const reported = moneyRaw(detail.amount ?? txn.amount);
  if (next === "success" && reported !== Number(row.amount)) return row;
  const partnerFee = moneyRaw(detail.charge ?? txn.charge);
  if (service === "card_payments") {
    if (next === "success" && partnerFee == null) return row;
    const { collectionFeeFor } = await import("./settle.server");
    const fee = next === "success" ? await collectionFeeFor(row, partnerFee ?? 0) : 0;
    const client = await db();
    const { data, error } = await client.rpc("settle_secondary_card", { p_record_id: row.id, p_status: next, p_fee: fee, p_partner_fee: partnerFee ?? 0 });
    if (error) throw new Error("Payment confirmation is temporarily unavailable.");
    return data?.record || row;
  }
  if (next === "success" && (partnerFee == null || partnerFee !== Number(row.metadata?.partner_fee))) return row;
  const { settlePaymentRecord } = await import("./settle.server");
  const result = await settlePaymentRecord(row, next, { fee: Number(row.fee_amount), providerReference: row.reference });
  return result.record || row;
}

async function existing(userId: string, reference: string) {
  const client = await db();
  const { data, error } = await client.from("payment_records").select("*").eq("reference", reference).maybeSingle();
  if (error) throw new Error(UNAVAILABLE);
  if (data && (data.merchant_id !== userId || data.metadata?.provider !== "marz")) throw new Error("This reference is already in use.");
  return data;
}

export async function secondaryPurchase(userId: string, kind: "airtime" | "bill" | "card", body: any) {
  let reserved = false;
  try {
    const payload: any = (kind === "airtime" ? airtimeInput : kind === "bill" ? billInput : cardInput).parse(body);
    const prior = await existing(userId, payload.reference);
    if (prior) {
      if (prior.metadata?.service !== (kind === "airtime" ? "airtime_data" : kind === "bill" ? "bill_payment" : "card_payments")) return fail("Reference belongs to another service.");
      return ok(publicOrder(await refreshSecondaryRecord(prior).catch(() => prior)));
    }
    const client = await db();
    const { data: profile, error: profileError } = await client.from("profiles").select("kyc_status").eq("id", userId).maybeSingle();
    if (profileError || profile?.kyc_status !== "approved") return fail("Complete identity verification before using this service.");
    let amount = payload.amount, partnerFee = 0;
    const service = kind === "airtime" ? "airtime_data" : kind === "bill" ? "bill_payment" : "card_payments";
    if (kind === "airtime") {
      const [catalog, detected] = await Promise.all([marzRequest("/airtime-data/catalog"), marzRequest(`/airtime-data/detect-network?msisdn=${payload.msisdn}`)]);
      const network = catalog.networks?.find((n: any) => n.code === detected.network);
      if (!network) return fail("This mobile network is not supported.");
      if (payload.purchase_type === "bundle") {
        if (!network.bundles) return fail("This network supports airtime only.");
        const groups: any[] = Object.values(catalog[String(detected.network).toLowerCase()]?.bundles || {});
        const product = groups.flatMap((g) => g.items || []).find((p: any) => p.product_id === payload.bundle_id);
        amount = moneyRaw(product?.price);
        if (amount == null || !Number.isInteger(amount) || amount <= 0) return fail("Choose an available data bundle.");
        if (Number(body.expected_amount) !== amount) return fail("The bundle price changed. Refresh and confirm the new price.");
      } else if (amount < Number(network.min_airtime_amount)) return fail(`Minimum airtime is ${network.min_airtime_amount} UGX.`);
    }
    if (kind === "bill") {
      const services = await marzRequest("/bill-payment/services");
      partnerFee = moneyRaw(services.bill_payment_settings?.charge_amount) ?? -1;
      if (!Number.isInteger(partnerFee) || partnerFee < 0) return fail("The service fee cannot be verified. No money has been moved.");
      if (payload.expected_fee !== partnerFee) return fail("The service fee changed. Refresh and confirm the new fee.");
      if (["DSTV", "GOTV"].includes(payload.utility_code)) {
        const bundles = await marzRequest(`/bill-payment/${payload.utility_code.toLowerCase()}/bouquet-codes`);
        const product = bundles.bouquet_details?.find((p: any) => p.code === payload.bouquet_code);
        if (moneyRaw(product?.price) !== amount) return fail("The payment amount must match the current TV package price.");
      }
      await marzRequest("/bill-payment/verify", { utility_code: payload.utility_code, meter_number: payload.meter_number, ...(payload.area ? { area: payload.area } : {}) });
    }
    const metadata = { provider: "marz", service, partner_fee: partnerFee, obpay_fee: 0, total_debit: amount + partnerFee, fee_mode: "account" };
    let row: any;
    if (kind === "card") {
      const { data, error } = await client.from("payment_records").insert({ merchant_id: userId, reference: payload.reference, amount, currency: "UGX", type: "collection", source: "dashboard", status: "pending", description: payload.description, metadata }).select("*").single();
      if (error) return fail("Reference already exists or the payment could not be saved. Check your history before retrying.");
      row = data;
    } else {
      const { data, error } = await client.rpc("reserve_payout_and_balance", { p_merchant_id: userId, p_reference: payload.reference, p_amount: amount, p_currency: "UGX", p_phone: payload.msisdn || payload.phone_number,
        p_source: "dashboard", p_description: kind === "bill" ? `${payload.utility_code} bill payment` : payload.purchase_type === "bundle" ? "Data bundle purchase" : "Airtime purchase", p_metadata: metadata, p_debit: amount + partnerFee });
      if (error) return fail("The payment could not be reserved. Check your UGX balance and transaction reference; no request was sent.");
      row = data;
      // Persist fees before any external money movement; a failed save retains the reservation for investigation.
      reserved = true;
      const { error: updateError } = await client.from("payment_records").update({ fee_amount: partnerFee, net_amount: amount }).eq("id", row.id);
      if (updateError) throw new Error("The reservation needs review. Do not submit another purchase.");
      row = { ...row, fee_amount: partnerFee, net_amount: amount };
    }
    reserved = true;
    const request = kind === "card" ? { reference: payload.reference, amount, method: "card", country: "UG", description: payload.description }
      : kind === "bill" ? { ...payload, expected_fee: undefined, phone_number: `+${payload.phone_number}` } : payload;
    const out = await marzRequest(kind === "card" ? "/collect-money" : kind === "bill" ? "/bill-payment" : "/airtime-data", request);
    const lookup = out.transaction?.uuid || payload.reference;
    const checkout = kind === "card" ? out.redirect_url : null;
    if (checkout && !/^https:\/\//.test(checkout)) throw new Error("The checkout address could not be verified.");
    const { error: saveError } = await client.from("payment_records").update({ metadata: { ...row.metadata, lookup_reference: lookup, checkout_url: checkout, submission_state: "accepted" }, provider_reference: lookup }).eq("id", row.id);
    if (saveError) throw new Error("Confirmation needs review. Do not submit another payment.");
    row = { ...row, metadata: { ...row.metadata, lookup_reference: lookup, checkout_url: checkout }, provider_reference: lookup };
    return ok(publicOrder(await refreshSecondaryRecord(row).catch(() => row)));
  } catch (error) {
    if (reserved) return fail("The request may have been submitted. Check this reference in service history or contact support. Do not create a new reference or pay again.");
    return fail(error instanceof z.ZodError ? error.issues[0]?.message || "Check your payment details." : error instanceof Error ? error.message : UNAVAILABLE);
  }
}

export async function secondaryAction(action: string, userId: string | null, b: any) {
  try {
    if (action === "svc-list") return ok({ services: await secondaryCatalog() });
    if (action === "airtime-catalog") return ok(cleanCatalog(await marzRequest("/airtime-data/catalog")));
    if (action === "airtime-detect") {
      const phone = ugPhone.parse(b.msisdn);
      const d = await marzRequest(`/airtime-data/detect-network?msisdn=${phone}`);
      return ok({ network: d.network });
    }
    if (action === "bill-services") {
      const d = await marzRequest("/bill-payment/services");
      return ok({ available_utilities: d.available_utilities, bill_payment_settings: d.bill_payment_settings });
    }
    if (action === "bill-areas") return ok(await marzRequest("/bill-payment/nwsc/areas"));
    if (action === "bill-bouquets") {
      const code = z.enum(["DSTV", "GOTV"]).parse(b.utilityCode);
      return ok(await marzRequest(`/bill-payment/${code.toLowerCase()}/bouquet-codes`));
    }
    if (action === "bank-banks") {
      const d = await marzRequest("/bank-transfer/banks");
      return ok({ banks: (d.banks || []).map((bank: any) => ({ code: bank.code || bank.name, name: bank.name })) });
    }
    if (action === "bank-services") return ok({ bank_transfer_available: (await marzRequest("/bank-transfer/services")).bank_transfer_available, manual_review: true });
    // Recipient lookups require identity; public callers cannot enumerate account names.
    if (!userId) return fail("Please sign in to use this service.");
    if (action === "bank-transfer") return fail("Bank transfers are handled by customer service until the exact network fee and safe submission can be confirmed. No money has been moved.");
    if (action === "bank-validate") {
      const input = z.object({ bank_name: z.string().min(1).max(100), account_number: z.string().regex(/^\d{5,30}$/) }).parse({ bank_name: b.bankName || b.bankCode, account_number: b.accountNumber });
      const d = await marzRequest("/bank-transfer/validate", input);
      return ok({ account_name: d.account_name, valid: d.valid });
    }
    if (action === "bill-verify") {
      const input = z.object({ utility_code: z.enum(["LIGHT", "UMEME", "NWSC", "DSTV", "GOTV"]), meter_number: z.string().min(5).max(40), area: z.string().max(80).optional() }).parse({ utility_code: b.utilityCode, meter_number: b.meterNumber, area: b.area });
      return ok(await marzRequest("/bill-payment/verify", input));
    }
    if (action === "airtime-purchase") return secondaryPurchase(userId, "airtime", { reference: b.reference, purchase_type: b.purchaseType, msisdn: b.msisdn, ...(b.purchaseType === "bundle" ? { bundle_id: b.bundleId, expected_amount: b.bundlePrice } : { amount: b.amount }) });
    if (action === "bill-pay") return secondaryPurchase(userId, "bill", { reference: b.reference, utility_code: b.utilityCode, meter_number: b.meterNumber, phone_number: b.phoneNumber, amount: b.amount, area: b.area, bouquet_code: b.bouquetCode, customer_name: b.customerName, email: b.email, expected_fee: b.expectedFee });
    if (action === "card-create") return secondaryPurchase(userId, "card", b);
    const client = await db();
    if (["airtime-status", "bill-status", "card-status"].includes(action)) {
      const reference = serviceReference.parse(b.reference);
      const row = await existing(userId, reference);
      if (!row) return fail("Payment not found.");
      return ok(publicOrder(await refreshSecondaryRecord(row)));
    }
    if (["airtime-list", "service-history", "card-list"].includes(action)) {
      const { data, error } = await client.from("payment_records").select("*").eq("merchant_id", userId).contains("metadata", { provider: "marz", ...(action === "card-list" ? { service: "card_payments" } : action === "airtime-list" ? { service: "airtime_data" } : {}) }).order("created_at", { ascending: false }).limit(30);
      if (error) return fail(UNAVAILABLE);
      const rows = await Promise.all((data || []).map((r: any) => refreshSecondaryRecord(r).catch(() => r)));
      const { data: cardWallet } = await client.from("merchant_card_balances").select("available_balance").eq("merchant_id", userId).maybeSingle();
      return ok({ purchases: rows.map(publicOrder), card_balance: Number(cardWallet?.available_balance || 0), currency: "UGX" });
    }
    return fail("This action is not available.");
  } catch { return fail(UNAVAILABLE); }
}

export async function secondaryAdmin(accessToken: string) {
  await requireAdmin(accessToken, "settings");
  const [services, account] = await Promise.all([secondaryCatalog(), marzRequest("/balance")]);
  return ok({ services, connected: true, main_float: moneyRaw(account.account?.available_balance), card_float: moneyRaw(account.account?.card_balance), currency: "UGX",
    note: "Bank transfer creation remains blocked: documentation supplies no pre-submit fee quote or client idempotency key. Cards collect payments; card issuing is not documented." });
}