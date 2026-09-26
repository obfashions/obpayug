import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Type = z.enum(["login", "registration"]);

async function userFromToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { admin: supabaseAdmin, user: data.user };
}

async function hash(code: string, userId: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}:${code}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Emails a 6-digit code (valid 10 minutes) to the signed-in user via Mailjet. */
export const sendVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(10), type: Type }).parse(d))
  .handler(async ({ data }) => {
    const me = await userFromToken(data.accessToken);
    if (!me) return { success: false, error: "Please sign in again to continue." };
    const email = me.user.email || "";
    const { data: recent } = await me.admin
      .from("verification_codes")
      .select("created_at")
      .eq("user_id", me.user.id)
      .eq("type", data.type)
      .gte("created_at", new Date(Date.now() - 45_000).toISOString())
      .limit(1);
    if (recent?.length) return { success: true };

    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(buf[0] % 1_000_000).padStart(6, "0");
    await me.admin.from("verification_codes").update({ used: true }).eq("user_id", me.user.id).eq("type", data.type).eq("used", false);
    const { error } = await me.admin.from("verification_codes").insert({
      user_id: me.user.id,
      email,
      type: data.type,
      code_hash: await hash(code, me.user.id),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) return { success: false, error: "We couldn't create a code right now. Please try again." };

    const { sendMailjet, brandedHtml } = await import("./mailjet.server");
    const purpose = data.type === "login" ? "finish signing in" : "verify your email";
    const res = await sendMailjet([
      {
        to: email,
        subject: `Your ObPay verification code: ${code}`,
        html: brandedHtml(
          "Your verification code",
          `<p>Use this code to ${purpose}:</p>
<p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:18px 0;">${code}</p>
<p>It expires in 10 minutes. If you didn't try to sign in, change your password.</p>`,
        ),
      },
    ]);
    if (!res.sent) return { success: false, error: "We couldn't send the code email right now. Please try again shortly." };
    return { success: true };
  });

export const checkVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ accessToken: z.string().min(10), type: Type, code: z.string().regex(/^\d{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const me = await userFromToken(data.accessToken);
    if (!me) return { success: false, error: "Please sign in again to continue." };
    const { data: rows } = await me.admin
      .from("verification_codes")
      .select("*")
      .eq("user_id", me.user.id)
      .eq("type", data.type)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) return { success: false, error: "No code found. Please request a new one." };
    if (new Date(row.expires_at) < new Date()) return { success: false, error: "That code has expired. Please request a new one." };
    if (row.attempts >= 5) return { success: false, error: "Too many attempts. Please request a new code." };
    if (row.code_hash !== (await hash(data.code, me.user.id))) {
      await me.admin.from("verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { success: false, error: "That code didn't work. Please check it and try again." };
    }
    await me.admin.from("verification_codes").update({ used: true }).eq("id", row.id);
    const patch = data.type === "login" ? { login_verified_at: new Date().toISOString() } : { email_verified: true };
    await me.admin.from("profiles").update(patch).eq("id", me.user.id);
    return { success: true };
  });
