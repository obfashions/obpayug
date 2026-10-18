import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ userId: z.string().uuid() });
async function digest(userId: string, code: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${code}`));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sendRegistrationCode = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: found, error } = await admin.auth.admin.getUserById(data.userId);
    if (error || !found.user?.email || found.user.email_confirmed_at) return { success: true };
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const code = String(random[0] % 1000000).padStart(6, "0");
    const { data: claim, error: claimError } = await admin.rpc("claim_registration_code", {
      p_user_id: data.userId, p_email: found.user.email, p_hash: await digest(data.userId, code),
    });
    if (claimError) return { success: false, error: "We couldn't prepare your code. Please try again shortly." };
    if (!claim) return { success: true };
    const { sendMailjet, brandedHtml } = await import("./mailjet.server");
    const result = await sendMailjet([{ to: found.user.email, subject: "Verify your ObPay email", html: brandedHtml("Verify your email", `<p>Your ObPay verification code is:</p><p style="font-size:30px;font-weight:700">${code}</p><p>This code expires in 10 minutes.</p>`) }]);
    if (!result.sent) {
      await admin.from("verification_codes").delete().eq("id", String(claim));
      return { success: false, error: "Your code email couldn't be sent. Please try again shortly." };
    }
    return { success: true };
  });

export const verifyRegistrationCode = createServerFn({ method: "POST" })
  .inputValidator((d) => input.extend({ code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data }): Promise<{ success: boolean; error?: string }> => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: valid, error } = await admin.rpc("consume_registration_code", { p_user_id: data.userId, p_hash: await digest(data.userId, data.code) });
    if (error || !valid) return { success: false, error: "That code is incorrect or expired. Please request a new code." };
    const confirmed = await admin.auth.admin.updateUserById(data.userId, { email_confirm: true });
    if (confirmed.error) return { success: false, error: "We couldn't confirm your email. Please request a new code." };
    const { error: profileError } = await admin.from("profiles").update({ email_verified: true, login_verified_at: new Date().toISOString() }).eq("id", data.userId);
    if (profileError) return { success: false, error: "Your email is confirmed. Please sign in to continue." };
    return { success: true };
  });