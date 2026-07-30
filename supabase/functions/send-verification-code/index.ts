import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getFromAddress(): string {
  if (!RESEND_FROM_DOMAIN || RESEND_FROM_DOMAIN.length === 0) {
    throw new Error("RESEND_FROM_DOMAIN is not configured");
  }
  return `ObPay <noreply@${RESEND_FROM_DOMAIN}>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, email, type } = await req.json();

    if (!user_id || !email || !type) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type !== "registration" && type !== "login") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid type. Must be 'registration' or 'login'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set in environment");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: insertErr } = await supabaseAdmin
      .from("verification_codes")
      .insert({
        user_id,
        email,
        code,
        type,
        used: false,
        expires_at: expiresAt.toISOString(),
      });

    if (insertErr) {
      console.error("Failed to store code:", insertErr);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromAddress = getFromAddress();
    const subject = type === "registration"
      ? "Verify your ObPay account"
      : "ObPay login verification code";

    const title = type === "registration"
      ? "Welcome to ObPay!"
      : "Login Verification Required";

    const bodyText = type === "registration"
      ? "Thank you for creating an ObPay account. Please use the verification code below to verify your email address and activate your account."
      : "Someone is attempting to log into your ObPay account. Please use the verification code below to complete the login process. If this wasn't you, please ignore this email and change your password immediately.";

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #fafafa; padding: 0; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 32px 32px 0;">
        <h2 style="margin: 0; font-size: 22px; color: #111827;">${title}</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px;">
        <p style="margin: 0; font-size: 15px; color: #4b5563; line-height: 1.6;">${bodyText}</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 32px; text-align: center;">
        <div style="display: inline-block; background: #f3f4f6; border-radius: 10px; padding: 20px 36px;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827; font-family: monospace;">${code}</span>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 4px 32px 32px;">
        <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
          This code expires in 10 minutes.<br>
          If you didn&apos;t request this, please ignore this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    console.log(`Sending ${type} verification email to ${email} from ${fromAddress}`);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject,
        html,
      }),
    });

    const resendBody = await resendResponse.text();
    console.log(`Resend API status: ${resendResponse.status}, body: ${resendBody}`);

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to send verification email",
          detail: resendBody,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
