import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

export function assertAccountAccess(profile: { status: string; email_verified: boolean; login_verified_at: string | null } | null, verificationRequired: boolean) {
  if (!profile || !["active", "pending"].includes(profile.status)) throw new ToolError("This account is unavailable. Sign in to ObPay for assistance.");
  if (!profile.email_verified || (verificationRequired && !profile.login_verified_at)) throw new ToolError("Complete your ObPay email and login verification first.");
}
export async function accountClient(ctx: ToolContext) {
  const client = supabaseForUser(ctx);
  const owner = ctx.getUserId();
  if (!owner) throw new ToolError("Sign in to ObPay first.");
  const [profile, settings] = await Promise.all([
    client.from("profiles").select("status,email_verified,login_verified_at,default_currency").eq("id", owner).maybeSingle(),
    client.from("platform_settings").select("require_login_verification").limit(1).maybeSingle(),
  ]);
  if (profile.error || settings.error) throw new ToolError("Your account permissions could not be checked. Try again later.");
  assertAccountAccess(profile.data, settings.data?.require_login_verification ?? true);
  return { client, owner, mainCurrency: profile.data?.default_currency ?? "UGX" };
}