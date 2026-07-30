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
          This is an automated message from ObPay. If you have questions, contact
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

function greetingHtml(name: string, greeting: string, timeLabel: string): string {
  return `
    <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 18px; color: #065f46; font-weight: 700;">
        ${greeting}, ${name || "there"}! &#9728;&#65039;
      </p>
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
      Hope you're having a productive ${timeLabel}. Here's a quick reminder that your ObPay dashboard is always ready for you:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
      <tr>
        <td style="padding: 6px 0;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: #fff; font-size: 12px; margin-right: 8px;">&#10003;</span>
          <span style="font-size: 13px; color: #374151;">Monitor your transactions in real-time</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 6px 0;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: #fff; font-size: 12px; margin-right: 8px;">&#10003;</span>
          <span style="font-size: 13px; color: #374151;">Check your collection and payout status</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 6px 0;">
          <span style="display: inline-block; width: 20px; height: 20px; background: #10b981; border-radius: 50%; text-align: center; line-height: 20px; color: #fff; font-size: 12px; margin-right: 8px;">&#10003;</span>
          <span style="font-size: 13px; color: #374151;">Generate payment links for your customers</span>
        </td>
      </tr>
    </table>
    <div style="text-align: center; margin: 20px 0;">
      <a href="https://obpay.online/dashboard" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Go to Dashboard</a>
    </div>
    <p style="margin: 14px 0 0; font-size: 13px; color: #6b7280;">
      Wishing you a successful day ahead!
    </p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">
      &mdash; The ObPay Team
    </p>`;
}

function referralHtml(name: string): string {
  return `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 18px; color: #1e40af; font-weight: 700;">
        Share ObPay, Earn Rewards! &#127873;
      </p>
    </div>
    <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
      Hi ${name || "there"}, we believe great things are better when shared. If ObPay has made your payment collections easier and faster, why not tell a friend?
    </p>
    <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #111827; font-weight: 600;">How it works:</p>
      <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        <strong style="color: #111827;">1.</strong> Refer a business owner or merchant to ObPay
      </p>
      <p style="margin: 0 0 6px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        <strong style="color: #111827;">2.</strong> They sign up and start collecting payments
      </p>
      <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
        <strong style="color: #111827;">3.</strong> Contact our support team and you'll receive a <strong style="color: #111827;">Thanks Fund</strong> for every successful referral!
      </p>
    </div>
    <p style="margin: 0 0 14px; font-size: 13px; color: #6b7280; line-height: 1.6;">
      Simply reach out to <a href="mailto:obfashions256@gmail.com" style="color: #111827; font-weight: 600; text-decoration: underline;">obfashions256@gmail.com</a> with the details of the business you referred, and our team will take care of the rest.
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="mailto:obfashions256@gmail.com?subject=Referral%20Thanks%20Fund%20Request" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Claim Your Thanks Fund</a>
    </div>
    <p style="margin: 14px 0 0; font-size: 13px; color: #6b7280;">
      Thank you for being part of the ObPay community!
    </p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">
      &mdash; The ObPay Team
    </p>`;
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
    console.error(`[send-automated] Resend error for ${to}: ${errMsg}`);
    return { ok: false, error: errMsg };
  }

  if (!resBody?.id) {
    console.error(`[send-automated] Resend 200 but no id for ${to}:`, JSON.stringify(resBody));
    return { ok: false, error: resBody?.message || "No email ID returned from Resend" };
  }

  console.log(`[send-automated] Sent to ${to}, Resend ID: ${resBody.id}`);
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
      console.log("[send-automated] Authorized via service role key");
    }

    if (!isAuthorized && token && token.startsWith("eyJ")) {
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (!authErr && user) {
        isAuthorized = true;
        console.log(`[send-automated] Authorized via JWT, user: ${user.email}`);
      } else {
        console.error(`[send-automated] JWT auth failed: ${authErr?.message || "unknown"}`);
      }
    }

    if (!isAuthorized) {
      console.error(`[send-automated] Auth rejected. Token starts with: ${token.substring(0, 15)}...`);
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
    const { campaigns, force } = body;

    if (!campaigns || (Array.isArray(campaigns) && campaigns.length === 0)) {
      return new Response(
        JSON.stringify({ success: false, error: "Specify campaigns: 'greeting', 'referral', or ['greeting','referral']" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const campaignList = Array.isArray(campaigns) ? campaigns : [campaigns];
    const skipDedup = force === true;

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

    const results: Record<string, { sent: number; skipped: number; failed: number; skipReason?: string }> = {};
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    console.log(`[send-automated] Starting campaigns: ${campaignList.join(",")}, force=${skipDedup}, merchants=${merchants.length}`);

    for (const campaign of campaignList) {
      let sent = 0;
      let skipped = 0;
      let failed = 0;
      let skipReason = "";

      if (campaign === "greeting") {
        const hour = now.getHours();
        let greetingText: string;
        let timeLabel: string;
        let greetingType: string;

        if (hour >= 6 && hour < 12) {
          greetingText = "Good Morning";
          timeLabel = "morning";
          greetingType = "greeting_morning";
        } else if (hour >= 12 && hour < 18) {
          greetingText = "Good Afternoon";
          timeLabel = "afternoon";
          greetingType = "greeting_afternoon";
        } else {
          greetingText = "Good Evening";
          timeLabel = "evening";
          greetingType = "greeting_evening";
        }

        skipReason = `Already received ${greetingType.replace("greeting_", "")} greeting today`;

        for (const m of merchants) {
          if (!skipDedup) {
            const { data: existing } = await supabaseAdmin
              .from("email_campaign_logs")
              .select("id, status")
              .eq("recipient_email", m.email)
              .eq("campaign_type", greetingType)
              .gte("sent_at", `${todayStr}T00:00:00Z`)
              .lte("sent_at", `${todayStr}T23:59:59Z`)
              .limit(1);

            if (existing && existing.length > 0) {
              console.log(`[send-automated] SKIP greeting for ${m.email}: already sent today`);
              skipped++;
              continue;
            }
          }

          const subject = `${greetingText} from ObPay!`;
          const html = emailShell(`${greetingText}!`, greetingHtml(m.full_name || "", greetingText, timeLabel));
          const result = await sendEmail(m.email, subject, html);

          const logStatus = result.ok ? "sent" : "failed";
          if (!result.ok) {
            console.error(`[send-automated] FAIL greeting to ${m.email}: ${result.error}`);
          }

          await supabaseAdmin.from("email_campaign_logs").insert({
            recipient_email: m.email,
            recipient_name: m.full_name || "",
            campaign_type: greetingType,
            subject,
            body_preview: `${greetingText}, ${m.full_name || "there"}! Hope you're having a productive ${timeLabel}.`,
            status: logStatus,
          });

          if (result.ok) sent++; else failed++;
        }

        results.greeting = { sent, skipped, failed, skipReason };
      }

      if (campaign === "referral") {
        skipReason = "Already received referral email in the last 8 hours";

        for (const m of merchants) {
          if (!skipDedup) {
            const eightHoursAgo = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();

            const { data: lastReferral } = await supabaseAdmin
              .from("email_campaign_logs")
              .select("sent_at, status")
              .eq("recipient_email", m.email)
              .eq("campaign_type", "referral")
              .order("sent_at", { ascending: false })
              .limit(1);

            if (lastReferral && lastReferral.length > 0 && lastReferral[0].sent_at > eightHoursAgo) {
              console.log(`[send-automated] SKIP referral for ${m.email}: last sent at ${lastReferral[0].sent_at}`);
              skipped++;
              continue;
            }
          }

          const subject = "Share ObPay & Earn a Thanks Fund!";
          const html = emailShell("Share ObPay, Earn Rewards!", referralHtml(m.full_name || ""));
          const result = await sendEmail(m.email, subject, html);

          const logStatus = result.ok ? "sent" : "failed";
          if (!result.ok) {
            console.error(`[send-automated] FAIL referral to ${m.email}: ${result.error}`);
          }

          await supabaseAdmin.from("email_campaign_logs").insert({
            recipient_email: m.email,
            recipient_name: m.full_name || "",
            campaign_type: "referral",
            subject,
            body_preview: "Share ObPay with friends and earn a Thanks Fund for every successful referral! Contact support to claim.",
            status: logStatus,
          });

          if (result.ok) sent++; else failed++;
        }

        results.referral = { sent, skipped, failed, skipReason };
      }
    }

    console.log(`[send-automated] Done:`, JSON.stringify(results));

    return new Response(
      JSON.stringify({ success: true, results, totalMerchants: merchants.length, forceUsed: skipDedup }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[send-automated] Crash:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
