import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reviewPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { recordId: string; partnerReference: string; status?: "success" | "failed"; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    try {
      const { data: allowed, error: roleError } = await context.supabase.rpc("has_permission", { _user_id: context.userId, _permission: "finance" });
      if (roleError || !allowed) throw new Error("You do not have permission to confirm payouts.");
      const { reviewVerifiedPayout } = await import("./payout-confirmation.server");
      return await reviewVerifiedPayout(data, context.userId);
    } catch (e) {
      return { success: false as const, error: e instanceof Error ? e.message : "Could not verify this payout." };
    }
  });