import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM_DOMAIN = Deno.env.get("RESEND_FROM_DOMAIN") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-obpay-internal",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getFromAddress(): string {
  if (!RESEND_FROM_DOMAIN || RESEND_FROM_DOMAIN.length === 0) {
    throw new Error("RESEND_FROM_DOMAIN is not configured");
  }
  return `ObPay <noreply@${RESEND_FROM_DOMAIN}>`;
}

function emailShell(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; padding: 0; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden;">
    <tr>
      <td style="padding: 28px 32px 0; background: #111827;">
        <table width="100%"><tr>
          <td><span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">ObPay</span></td>
          <td align="right"><span style="font-size: 11px; color: #9ca3af;">Secure Payments</span></td>
        </tr></table>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px 32px 8px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #111827; line-height: 1.3;">${title}</h2>
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 32px 32px;">
        ${content}
      </td>
    </tr>
    <tr>
      <td style="padding: 20px 32px; background: #f9fafb; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; line-height: 1.5;">
          This message was sent by the ObPay team. If you have questions, contact
          <a href="mailto:obfashions256@gmail.com" style="color: #111827; text-decoration: underline;">obfashions256@gmail.com</a>.
        </p>
        <p style="margin: 0; font-size: 11px; color: #9ca3af;">
          ObPay &mdash; Secure Mobile Money Collections &amp; Payouts
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string; resendId?: string }> {
  const fromAddress = getFromAddress();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to: [to], subject, html }),
  });

  let resBody: any = {};
  try { resBody = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const errMsg = resBody?.message || resBody?.error || `HTTP ${res.status}`;
    console.error(`[email-blast] Resend error for ${to}: ${errMsg}`);
    return { ok: false, error: errMsg };
  }

  if (!resBody?.id) {
    console.error(`[email-blast] Resend 200 but no id for ${to}:`, JSON.stringify(resBody));
    return { ok: false, error: resBody?.message || "No email ID returned from Resend" };
  }

  console.log(`[email-blast] Sent to ${to}, Resend ID: ${resBody.id}`);
  return { ok: true, resendId: resBody.id };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    let isAuthorized = false;

    if (token && token === serviceRoleKey && serviceRoleKey.length > 10) {
      isAuthorized = true;
      console.log("[email-blast] Authorized via service role key");
    }

    if (!isAuthorized && token && token.startsWith("eyJ")) {
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (!authErr && user) {
        isAuthorized = true;
        console.log(`[email-blast] Authorized via JWT, user: ${user.email}`);
      } else {
        console.error(`[email-blast] JWT auth failed: ${authErr?.message || "unknown"}`);
      }
    }

    if (!isAuthorized) {
      console.error(`[email-blast] Auth rejected. Token starts with: ${token.substring(0, 15)}...`);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized &mdash; your session may have expired. Try logging out and back in." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!RESEND_FROM_DOMAIN || RESEND_FROM_DOMAIN.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_FROM_DOMAIN not configured. Set up your sending domain in the Resend panel." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { subject, html_body } = body;

    if (!subject || !html_body) {
      return new Response(
        JSON.stringify({ success: false, error: "subject and html_body are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: merchants, error: merchantErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "merchant")
      .eq("status", "active");

    if (merchantErr) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch merchants", detail: merchantErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!merchants || merchants.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active merchants found", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let failed = 0;

    console.log(`[email-blast] Sending "${subject}" to ${merchants.length} merchants`);

    for (const m of merchants) {
      const personalizedHtml = html_body.replace(/\{\{name\}\}/g, m.full_name || "there");
      const fullHtml = emailShell(subject, personalizedHtml);
      const result = await sendEmail(m.email, subject, fullHtml);

      const logStatus = result.ok ? "sent" : "failed";
      if (!result.ok) {
        console.error(`[email-blast] FAIL to ${m.email}: ${result.error}`);
      }

      await supabaseAdmin.from("email_campaign_logs").insert({
        recipient_email: m.email,
        recipient_name: m.full_name || "",
        campaign_type: "blast",
        subject,
        body_preview: html_body.replace(/<[^>]*>/g, "").slice(0, 150),
        status: logStatus,
      });

      if (result.ok) sent++; else failed++;
    }

    console.log(`[email-blast] Done. Sent: ${sent}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: merchants.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[email-blast] Crash:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
