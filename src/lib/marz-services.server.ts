// Secondary-provider boundary. Never route primary mobile-money payments here.
import { z } from "zod";
import { airtimeInput, billInput, cardInput, bankInput, bankFee, moneyRaw, serviceReference, serviceState, ugPhone } from "./secondary-service-rules";
import { requireAdmin } from "./identity.server";

const db = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
const fail = (error: string) => ({ success: false, error });
const ok = (data: any) => ({ success: true as const, data });
const UNAVAILABLE = "This service is temporarily unavailable. No money has been moved. Please contact ObPay support.";
export function secondaryErrorMessage(code: unknown, status: number): string {
  switch (String(code || "")) {
    case "BANK_NOT_SUPPORTED": return "This bank is not supported. Select a bank from the current list.";
    case "VALIDATION_FAILED": return "The bank could not verify this account. Check the bank and account number with the recipient.";
    case "SERVICE_NOT_AVAILABLE": return "Bank transfers are not enabled on the payment network account.";
    case "INSUFFICIENT_BALANCE": return "The payment network has insufficient funds for this transfer. No further transfer should be submitted.";
    default: return status === 401 || status === 403 ? "The payment network connection could not authorise this request. No further payment should be submitted." : UNAVAILABLE;
  }
}

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
  if (!response.ok || (out.status !== "success" && !(path.startsWith("/transactions/") && out.transaction && out.event_type))) {
    // Never relay upstream branding, credentials, or customer data to merchants.
    console.error("Secondary service request refused", response.status, String(out.error_code || "unknown"));
    throw new Error(secondaryErrorMessage(out.error_code, response.status));
  }
  return out.data || out;
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
    { code: "bank_transfer", name: "Bank transfers", status: bank.status === "fulfilled" && bank.value.bank_transfer_available === true ? "active" : "unavailable" },
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
  const root = service === "bank_transfer" ? "/bank-transfer" : service === "card_payments" ? "/collect-money" : service === "bill_payment" ? "/bill-payment" : "/airtime-data";
  if (service === "bank_transfer" && !row.metadata?.lookup_reference) return row;
  let details = await marzRequest(`${root}/${encodeURIComponent(row.metadata?.lookup_reference || row.reference)}`);
  // The collection-detail contract can omit charges; transaction lookup includes them.
  if (service === "card_payments" && moneyRaw(details.collection?.charge ?? details.transaction?.charge) == null && details.transaction?.uuid) {
    details = await marzRequest(`/transactions/${encodeURIComponent(details.transaction.uuid)}`);
  }
  const txn = details.bank_transfer_request || details.bank_transfer || details.transaction || details;
  const next = serviceState(txn.status);
  if (next === "pending") return row;
  const detail = details.bank_transfer_request || details.bank_transfer || details.bill_payment || details;
  const evidenceAmount = detail.amount ?? txn.amount ?? details.collection?.amount;
  const evidenceCurrency = evidenceAmount?.currency;
  if (evidenceCurrency !== "UGX") return row;
  const reported = moneyRaw(detail.amount ?? txn.amount ?? details.collection?.amount);
  if (reported !== Number(row.amount)) return row;
  const evidenceReference = txn.reference || txn.uuid || details.reference;
  if (![row.reference, row.metadata?.lookup_reference].includes(evidenceReference) && ![row.reference, row.metadata?.lookup_reference].includes(txn.uuid)) return row;
  const partnerFee = moneyRaw(detail.charge_amount ?? detail.charge ?? txn.charge ?? details.collection?.charge);
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

const cleanName = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");
const sameName = (a: unknown, b: unknown) => cleanName(a).toLowerCase() === cleanName(b).toLowerCase() && cleanName(a).length > 0;

function verifiedBankName(check: any): string {
  const name = cleanName(check?.account_name);
  if (check?.valid !== true) {
    if (name && check?.status_code === 0) throw new Error("The bank found this account, but has not confirmed it is active. Ask your bank to confirm its registration for bank-network transfers, then try verification again. No money has been moved.");
    throw new Error("The bank could not verify this account. Check the bank and account number with the recipient.");
  }
  if (!name) throw new Error("The bank has not supplied the account holder's name. Try verification again before saving or sending money.");
  return name;
}

/** Approved identity may live in the current KYC table or the migrated merchant profile; both need a verified name. */
export async function verifiedIdentity(userId: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const client = await db();
  const [kycRes, mpRes] = await Promise.all([
    client.from("kyc_submissions").select("status, full_name, business_name").eq("merchant_id", userId).maybeSingle(),
    client.from("merchant_profiles").select("verification_status, company_name").eq("user_id", userId).maybeSingle(),
  ]);
  if (kycRes.error && mpRes.error) return { ok: false, error: "We couldn't confirm your verification right now. Please try again." };
  const kyc = kycRes.data, mp = mpRes.data;
  const approved = kyc?.status === "approved" || mp?.verification_status === "approved";
  if (!approved) return { ok: false, error: "Complete identity verification before using this service." };
  const name = cleanName((kyc?.status === "approved" && (kyc.full_name || kyc.business_name)) || mp?.company_name || kyc?.full_name || kyc?.business_name);
  if (name.length < 2) return { ok: false, error: "Your verified name is missing. Please update your identity details or contact support." };
  return { ok: true, name };
}

export async function secondaryPurchase(userId: string, kind: "airtime" | "bill" | "card" | "bank", body: any, source: "dashboard" | "api" = "dashboard") {
  let reserved = false;
  try {
    const payload: any = (kind === "bank" ? bankInput : kind === "airtime" ? airtimeInput : kind === "bill" ? billInput : cardInput).parse(body);
    const prior = await existing(userId, payload.reference);
    if (prior) {
      if (prior.metadata?.service !== (kind === "bank" ? "bank_transfer" : kind === "airtime" ? "airtime_data" : kind === "bill" ? "bill_payment" : "card_payments")) return fail("Reference belongs to another service.");
      return ok(publicOrder(await refreshSecondaryRecord(prior).catch(() => prior)));
    }
    const client = await db();
    const { data: account, error: accountError } = await client.from("profiles").select("status").eq("id", userId).maybeSingle();
    if (accountError || account?.status !== "active") return fail("This account cannot submit service payments. Please contact ObPay support.");
    const identity = await verifiedIdentity(userId);
    if (!identity.ok) return fail(identity.error);
    let amount = payload.amount, partnerFee = 0;
    const service = kind === "bank" ? "bank_transfer" : kind === "airtime" ? "airtime_data" : kind === "bill" ? "bill_payment" : "card_payments";
    if (kind === "bank") {
      const available = await marzRequest("/bank-transfer/services");
      if (available.bank_transfer_available !== true) return fail("Bank transfers are currently unavailable. No money has been moved.");
      const fee = bankFee(available.bank_transfer_settings, amount);
      if (fee == null) return fail("The payment network has not supplied an exact transfer fee. No money has been moved.");
      partnerFee = fee;
      if (payload.expected_fee !== fee) return fail("The transfer fee changed. Refresh and confirm the new fee.");
      const check = await marzRequest("/bank-transfer/validate", { bank_name: payload.bank_name, account_number: payload.bank_account_number });
      const accountName = verifiedBankName(check);
      if (!sameName(payload.confirmed_name, accountName)) return fail("Verify the recipient account and confirm its registered name before sending.");
      payload.bank_account_name = accountName;
    }
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
      const check = await marzRequest("/bill-payment/verify", { utility_code: payload.utility_code, meter_number: payload.meter_number, ...(payload.area ? { area: payload.area } : {}) });
      const accountName = cleanName(check?.customer_details?.customer_name || check?.customer_name);
      if (!accountName) return fail("We couldn't confirm the account holder's name for this number. Check it and try again.");
      if (!sameName(body.confirmed_name, accountName)) return fail("Verify the account and confirm the holder's name before paying.");
      payload.customer_name = accountName;
    }
    const metadata: any = { provider: "marz", service, partner_fee: partnerFee, obpay_fee: 0, total_debit: amount + partnerFee, fee_mode: "account", payer_name: identity.name, ...(kind === "bill" ? { account_name: payload.customer_name } : {}) };
    let row: any;
    if (kind === "card") {
      const { data, error } = await client.from("payment_records").insert({ merchant_id: userId, reference: payload.reference, amount, currency: "UGX", type: "collection", source, status: "pending", description: payload.description, metadata }).select("*").single();
      if (error) return fail("Reference already exists or the payment could not be saved. Check your history before retrying.");
      row = data;
    } else {
      const { data, error } = await client.rpc("reserve_payout_and_balance", { p_merchant_id: userId, p_reference: payload.reference, p_amount: amount, p_currency: "UGX", p_phone: payload.msisdn || payload.phone_number,
        p_source: source, p_description: kind === "bank" ? payload.description : kind === "bill" ? `${payload.utility_code} bill payment` : payload.purchase_type === "bundle" ? "Data bundle purchase" : "Airtime purchase", p_metadata: metadata, p_debit: amount + partnerFee });
      if (error) return fail("The payment could not be reserved. Check your UGX balance and transaction reference; no request was sent.");
      row = data;
      // Persist fees before any external money movement; a failed save retains the reservation for investigation.
      reserved = true;
      const { error: updateError } = await client.from("payment_records").update({ fee_amount: partnerFee, net_amount: amount }).eq("id", row.id);
      if (updateError) throw new Error("The reservation needs review. Do not submit another purchase.");
      row = { ...row, fee_amount: partnerFee, net_amount: amount };
    }
    reserved = true;
    const request = kind === "bank" ? { amount, description: payload.description, bank_name: payload.bank_name, bank_account_number: payload.bank_account_number, bank_account_name: payload.bank_account_name, bank_branch: payload.bank_branch, wallet_source: "main" } : kind === "card" ? { reference: payload.reference, amount, method: "card", country: "UG", description: payload.description }
      : kind === "bill" ? { ...payload, expected_fee: undefined, phone_number: `+${payload.phone_number}` } : payload;
    const out = await marzRequest(kind === "bank" ? "/bank-transfer" : kind === "card" ? "/collect-money" : kind === "bill" ? "/bill-payment" : "/airtime-data", request);
    const lookup = kind === "bank" ? out.bank_transfer?.reference : kind === "card" ? out.transaction?.uuid || out.uuid || payload.reference : payload.reference;
    if (!lookup) throw new Error("Transfer confirmation needs review. Do not send again.");
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
    if (action === "bank-services") {
      const d = await marzRequest("/bank-transfer/services");
      return ok({ bank_transfer_available: d.bank_transfer_available === true, bank_transfer_settings: d.bank_transfer_settings || null });
    }
    // Recipient lookups require identity; public callers cannot enumerate account names.
    if (!userId) return fail("Please sign in to use this service.");
    if (action === "bank-accounts-list") {
      const client = await db();
      const { data, error } = await client.from("merchant_bank_accounts").select("id,bank_name,account_number,account_name,branch,currency,created_at").eq("merchant_id", userId).order("created_at", { ascending: false });
      return error ? fail("Your saved bank accounts could not be loaded.") : ok({ accounts: data || [], automatic_wallet_credit: false });
    }
    if (action === "bank-accounts-create") {
      const input = z.object({ bank_name: z.string().trim().min(1).max(100), account_number: z.string().regex(/^\d{5,30}$/), branch: z.string().trim().max(100).default(""), currency: z.literal("UGX").default("UGX") }).parse(b);
      const check = await marzRequest("/bank-transfer/validate", { bank_name: input.bank_name, account_number: input.account_number });
      const accountName = verifiedBankName(check);
      if (accountName.length > 120) return fail("The registered account name could not be saved. Please contact support.");
      const client = await db();
      const { data, error } = await client.from("merchant_bank_accounts").insert({ ...input, merchant_id: userId, account_name: accountName }).select("id,bank_name,account_number,account_name,branch,currency,created_at").single();
      return error || !data ? fail("The bank account could not be saved; it may already be listed.") : ok({ account: data, automatic_wallet_credit: false });
    }
    if (action === "bank-accounts-delete") {
      const accountId = z.string().uuid().parse(b.id);
      const client = await db();
      const { data, error } = await client.from("merchant_bank_accounts").delete().eq("id", accountId).eq("merchant_id", userId).select("id");
      return error || !data?.length ? fail("The bank account was not found or could not be removed.") : ok({ id: accountId, removed: true });
    }
    if (action === "bank-transfer") return secondaryPurchase(userId, "bank", { reference: b.reference, amount: b.amount, description: b.description, bank_name: b.bankName, bank_account_number: b.accountNumber, bank_branch: b.bankBranch, confirmed_name: b.confirmedName, expected_fee: b.expectedFee });
    if (action === "bank-validate") {
      const input = z.object({ bank_name: z.string().min(1).max(100), account_number: z.string().regex(/^\d{5,30}$/) }).parse({ bank_name: b.bankName || b.bankCode, account_number: b.accountNumber });
      const d = await marzRequest("/bank-transfer/validate", input);
      return ok({ account_name: verifiedBankName(d), valid: true });
    }
    if (action === "bill-verify") {
      const input = z.object({ utility_code: z.enum(["LIGHT", "UMEME", "NWSC", "DSTV", "GOTV"]), meter_number: z.string().min(5).max(40), area: z.string().max(80).optional() }).parse({ utility_code: b.utilityCode, meter_number: b.meterNumber, area: b.area });
      return ok(await marzRequest("/bill-payment/verify", input));
    }
    if (action === "airtime-purchase") return secondaryPurchase(userId, "airtime", { reference: b.reference, purchase_type: b.purchaseType, msisdn: b.msisdn, ...(b.purchaseType === "bundle" ? { bundle_id: b.bundleId, expected_amount: b.bundlePrice } : { amount: b.amount }) });
    if (action === "bill-pay") return secondaryPurchase(userId, "bill", { reference: b.reference, utility_code: b.utilityCode, meter_number: b.meterNumber, phone_number: b.phoneNumber, amount: b.amount, area: b.area, bouquet_code: b.bouquetCode, customer_name: b.customerName, email: b.email, expected_fee: b.expectedFee, confirmed_name: b.confirmedName });
    if (action === "card-create") return secondaryPurchase(userId, "card", b);
    const client = await db();
    if (["airtime-status", "bill-status", "card-status", "bank-status"].includes(action)) {
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
  } catch (error) {
    if (error instanceof z.ZodError) return fail(error.issues[0]?.message || "Check your request details.");
    return fail(error instanceof Error ? error.message : UNAVAILABLE);
  }
}

export async function secondaryAdmin(accessToken: string) {
  await requireAdmin(accessToken, "settings");
  const [services, account] = await Promise.all([secondaryCatalog(), marzRequest("/balance")]);
  return ok({ services, connected: true, main_float: moneyRaw(account.account?.available_balance), card_float: moneyRaw(account.account?.card_balance), currency: "UGX",
    note: "Bank transfers require a live exact fee and verified recipient. Uncertain submissions stay reserved and are never automatically retried. Cards collect payments; card issuing is not documented." });
}