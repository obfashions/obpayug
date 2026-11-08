import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const bankConnectionCheck = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { jjumaConnectionStatus } = await import("./jjuma.server");
    return jjumaConnectionStatus(data.accessToken);
  });

export const submitBankPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ reference: z.string(), amount: z.number(), currency: z.string(), bank_name: z.string(), account_number: z.string(), account_name: z.string(), branch: z.string().optional(), note: z.string().max(200).optional() }))
  .handler(async ({ data, context }) => (await import("./bank-payouts.server")).requestBankPayout(context.userId, data));

export const myBankPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => (await import("./bank-payouts.server")).listMyBankPayouts(context.userId));

async function requireFinance(context: any) {
  const { data, error } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission: "finance" });
  if (error || !data) throw new Error("You do not have permission to manage bank withdrawals.");
}

export const adminBankPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ status: z.enum(["pending", "success", "failed", "all"]) }))
  .handler(async ({ data, context }) => {
    try { await requireFinance(context); return (await import("./bank-payouts.server")).adminListBankPayouts(data.status); }
    catch (e) { return { success: false as const, error: e instanceof Error ? e.message : "Not allowed." }; }
  });

export const adminCompleteBankPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ recordId: z.string().uuid(), status: z.enum(["success", "failed"]), transferReference: z.string().max(120), reason: z.string().min(5).max(300) }))
  .handler(async ({ data, context }) => {
    try { await requireFinance(context); return (await import("./bank-payouts.server")).adminCompleteBankPayout(context.userId, data); }
    catch (e) { return { success: false as const, error: e instanceof Error ? e.message : "Not allowed." }; }
  });
