import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TransferRecipient = { id: string; name: string; username: string; currencies: string[] };
export type MerchantTransfer = { id: string; reference: string; sender_id: string; recipient_id: string; amount: number; currency: string; reason: string; sender_name: string; recipient_name: string; created_at: string; sender_balance_before: number; sender_balance_after: number; recipient_balance_before: number; recipient_balance_after: number; duplicate?: boolean };

export const findTransferRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ identifier: z.string().trim().min(3).max(160) }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("find_transfer_recipient", { p_identifier: data.identifier });
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as TransferRecipient;
  });

export const sendMerchantTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ recipientId: z.string().uuid(), currency: z.string(), amount: z.number().finite().positive(), reason: z.string().trim().min(1).max(200), requestId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc("transfer_between_merchants", { p_recipient: data.recipientId, p_currency: data.currency, p_amount: data.amount, p_reason: data.reason, p_request_id: data.requestId });
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as MerchantTransfer;
  });

export const listMerchantTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const result = await context.supabase.from("merchant_transfers").select("*").or(`sender_id.eq.${context.userId},recipient_id.eq.${context.userId}`).order("created_at", { ascending: false }).limit(50);
    if (result.error) throw new Error(result.error.message);
    return result.data as unknown as MerchantTransfer[];
  });