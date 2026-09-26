import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_HOSTS = [/(^|\.)obpay\.online$/, /\.lovable\.app$/, /\.lovableproject\.com$/, /^localhost$/];

function safeOrigin(origin: string) {
  try {
    const u = new URL(origin);
    if (ALLOWED_HOSTS.some((r) => r.test(u.hostname))) return u.origin;
  } catch {
    /* fall through */
  }
  return "https://obpay.online";
}

async function sendResetEmail(email: string, origin: string): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendMailjet, brandedHtml } = await import("./mailjet.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email });
  const hashed = (data as any)?.properties?.hashed_token;
  if (error || !hashed) return { ok: false, error: "no-account" };
  const link = `${safeOrigin(origin)}/reset-password?token_hash=${encodeURIComponent(hashed)}&type=recovery`;
  const res = await sendMailjet([
    {
      to: email,
      subject: "Reset your ObPay password",
      html: brandedHtml(
        "Reset your password",
        `<p>We received a request to reset your ObPay password.</p>
<p><a href="${link}" style="display:inline-block;background:#111827;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">Choose a new password</a></p>
<p>This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
      ),
    },
  ]);
  if (!res.sent) return { ok: false, error: "The email could not be sent. Please try again shortly." };
  return { ok: true };
}

/** Sign-in fallback: brings an account over from the old system when the password matches there. */
export const migrateLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(255), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { migrateOnLogin } = await import("./legacy-migrate.server");
    try {
      return await migrateOnLogin(data.email, data.password);
    } catch (e: any) {
      console.error("[migrateLogin]", e?.message);
      return { moved: false };
    }
  });

/** Public "forgot password": always answers the same way so emails can't be probed. */
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: z.string().email().max(255), origin: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("id, email, status").ilike("email", email).maybeSingle();
    if (prof?.id && prof.status !== "deactivated") {
      const { ensureAuthUser } = await import("./legacy-migrate.server");
      await ensureAuthUser(prof.id, email);
    }
    const res = await sendResetEmail(email, data.origin);
    if (!res.ok && res.error !== "no-account") return { success: false, error: res.error };
    return { success: true };
  });

/** Admin: email a reset link to a merchant. */
export const adminSendResetLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(10), targetUserId: z.string().uuid(), origin: z.string().max(300) }).parse(d))
  .handler(async ({ data }) => {
    const { resolveIdentity } = await import("./identity.server");
    const me = await resolveIdentity(data.accessToken);
    if (!me) return { success: false, error: "Please sign in again to continue." };
    if (!me.isAdmin) return { success: false, error: "Your admin account isn't allowed to reset passwords." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("id, email").eq("id", data.targetUserId).maybeSingle();
    if (!prof?.email) return { success: false, error: "This merchant has no email address on file." };
    const { ensureAuthUser } = await import("./legacy-migrate.server");
    await ensureAuthUser(prof.id, prof.email);
    const res = await sendResetEmail(prof.email.toLowerCase(), data.origin);
    if (!res.ok) return { success: false, error: res.error === "no-account" ? "This merchant's sign-in could not be prepared." : res.error };
    return { success: true, email: prof.email };
  });
