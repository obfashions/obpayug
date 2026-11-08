import { bankPayoutError, bankPayoutQuote, BANK_PAYOUT_FEE_PERCENT, type BankPayoutInput } from "./bank-payouts";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;

/** Reserves the full debit (amount + 4.5% fee) atomically, then queues the request for the finance team. */
export async function requestBankPayout(userId: string, input: BankPayoutInput & { reference: string }) {
  const problem = bankPayoutError(input);
  if (problem) return { success: false as const, error: problem };
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(input.reference)) return { success: false as const, error: "Invalid request reference. Refresh and try again." };
  const q = bankPayoutQuote(input.amount);
  const db = await admin();
  const { data, error } = await db.rpc("reserve_payout_and_balance", {
    p_merchant_id: userId, p_reference: input.reference, p_amount: q.amount, p_currency: input.currency,
    p_phone: input.account_number.trim(), p_source: "dashboard", p_description: input.note?.trim() || "Bank withdrawal",
    p_debit: q.total,
    p_metadata: {
      payout_channel: "bank", processing: "manual_review", fee_mode: "account", obpay_fee: q.fee, partner_fee: 0, fee_percent: BANK_PAYOUT_FEE_PERCENT,
      recipient_name: input.account_name.trim(), bank: { bank_name: input.bank_name.trim(), account_number: input.account_number.trim(), account_name: input.account_name.trim(), branch: input.branch?.trim() || null },
    },
  });
  if (error || !data) return { success: false as const, error: error?.message?.includes("Insufficient") ? error.message : error?.message?.includes("already reserved") ? "This request was already submitted. Check your bank withdrawals below." : "Your withdrawal could not be submitted. Your balance was not changed." };
  return { success: true as const, reference: input.reference, ...q };
}

const view = (r: any) => ({ id: r.id, reference: r.reference, amount: r.amount, currency: r.currency, status: r.status, created_at: r.created_at, settled_at: r.settled_at,
  fee: r.metadata?.obpay_fee ?? 0, total: r.metadata?.total_debit ?? r.amount, bank: r.metadata?.bank ?? null, note: r.description });

export async function listMyBankPayouts(userId: string) {
  const db = await admin();
  const { data, error } = await db.from("payment_records").select("*").eq("merchant_id", userId).eq("type", "payout").eq("metadata->>payout_channel", "bank").order("created_at", { ascending: false }).limit(50);
  if (error) return { success: false as const, error: "Could not load bank withdrawals." };
  return { success: true as const, items: (data || []).map(view) };
}

export async function adminListBankPayouts(status: string) {
  const db = await admin();
  let q = db.from("payment_records").select("*").eq("type", "payout").eq("metadata->>payout_channel", "bank").order("created_at", { ascending: true }).limit(200);
  if (status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return { success: false as const, error: error.message };
  const ids = [...new Set((data || []).map((r: any) => r.merchant_id))];
  const { data: people } = ids.length ? await db.from("profiles").select("id,full_name,email,business_name,phone").in("id", ids) : { data: [] };
  const byId = new Map((people || []).map((p: any) => [p.id, p]));
  return { success: true as const, items: (data || []).map((r: any) => ({ ...view(r), merchant: byId.get(r.merchant_id) || { id: r.merchant_id } })) };
}

/** Finance marks a manual transfer as sent (with the transfer reference) or failed (full refund of amount + fee). */
export async function adminCompleteBankPayout(actor: string, input: { recordId: string; status: "success" | "failed"; transferReference: string; reason: string }) {
  const db = await admin();
  const { data: r, error } = await db.from("payment_records").select("*").eq("id", input.recordId).single();
  if (error || !r || r.type !== "payout" || r.metadata?.payout_channel !== "bank") return { success: false as const, error: "Bank withdrawal not found." };
  const ref = input.transferReference.trim() || (input.status === "failed" ? `FAILED-${r.reference}` : "");
  if (!ref) return { success: false as const, error: "Enter the bank transfer reference from the payment dashboard." };
  const evidence = { reference: ref, status: input.status, currency: r.currency, net_amount: Number(r.amount), manual: true, verified_at: new Date().toISOString() };
  const { data, error: e2 } = await db.rpc("confirm_payout_status", { p_record_id: r.id, p_status: input.status, p_provider_reference: ref, p_actor: actor, p_reason: input.reason, p_evidence: evidence });
  if (e2) return { success: false as const, error: e2.message };
  return { success: true as const, result: data };
}
