import { apiCollect, apiTransaction } from "./public-api.server";

/** Called only after the existing merchant/session authentication boundary. */
export async function cardAction(action: string, userId: string | null, body: Record<string, any>, source = "dashboard") {
  if (!userId) return { success: false, error: "Please sign in to use card payments." };
  if (action === "card-create") return apiCollect(userId, { ...body, payment_method: "card", currency: body.currency || "USD" }, source);
  if (action === "card-status") return apiTransaction(userId, String(body.reference || ""));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("payment_records").select("reference,amount,currency,status,fee_amount,net_amount,description,metadata,created_at").eq("merchant_id", userId).contains("metadata", { payment_method: "card" }).order("created_at", { ascending: false }).limit(30);
  if (error) return { success: false, error: "Card payments could not be loaded." };
  return { success: true, data: { purchases: (data || []).map((r: any) => ({ ...r, fee: r.fee_amount, checkout_url: r.status === "pending" ? r.metadata?.checkout_url : null, metadata: undefined })) } };
}