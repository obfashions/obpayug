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

// ── Template-based email generation ──
function buildTemplateEmail(type: string, data: Record<string, unknown>): { subject: string; html: string } {
  switch (type) {
    case "account_verified": {
      const company = String(data.company_name || "Your Business");
      const merchantId = String(data.merchant_id || "N/A");
      const slug = String(data.merchant_slug || "");
      return {
        subject: "Your ObPay Account Has Been Verified!",
        html: emailShell("Account Verified!", `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #065f46; font-weight: 700;">Congratulations, ${company}!</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            Your KYC verification has been approved and your merchant account is now <strong style="color: #111827;">live</strong>!
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #111827; font-weight: 600;">Your Account Details</p>
            <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;"><strong style="color: #111827;">Merchant ID:</strong> ${merchantId}</p>
            <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;"><strong style="color: #111827;">Payment Page:</strong> obpay.online/pay/${slug}</p>
            <p style="margin: 0; font-size: 13px; color: #6b7280;"><strong style="color: #111827;">Status:</strong> Active</p>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://obpay.online/dashboard" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Go to Dashboard</a>
          </div>
          <p style="margin: 14px 0 0; font-size: 13px; color: #6b7280;">
            You can now start collecting payments, creating payment links, using your API keys, and requesting payouts.
          </p>
        `),
      };
    }

    case "account_rejected": {
      const company = String(data.company_name || "Your Business");
      const reason = String(data.rejection_reason || "Document requirements not met");
      return {
        subject: "Update Needed — Your ObPay Verification",
        html: emailShell("Verification Requires Attention", `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #991b1b; font-weight: 700;">Action Required, ${company}</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            Your KYC verification could not be approved at this time. Here's why:
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin: 0; font-size: 14px; color: #991b1b; line-height: 1.6;">${reason}</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280; line-height: 1.7;">
            Please log in to your dashboard, update the required information, and resubmit your verification.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://obpay.online/dashboard/kyc" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">Update KYC</a>
          </div>
          <p style="margin: 14px 0 0; font-size: 13px; color: #6b7280;">
            If you have questions about the rejection reason, please contact our support team.
          </p>
        `),
      };
    }

    case "support_ticket_received": {
      const ticketSubject = String(data.ticket_subject || "General Inquiry");
      const message = String(data.ticket_message || "").slice(0, 200);
      return {
        subject: `Ticket Received: ${ticketSubject}`,
        html: emailShell("Support Ticket Received", `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #1e40af; font-weight: 700;">We Got Your Message!</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            Thank you for reaching out. Our support team has received your ticket and will respond shortly.
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin: 0 0 6px; font-size: 13px; color: #111827; font-weight: 600;">${ticketSubject}</p>
            <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">${message}${message.length >= 200 ? "..." : ""}</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
            We typically respond within 1 hour during business hours (Mon-Fri, 8AM-6PM EAT).
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://obpay.online/support" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">View Support Center</a>
          </div>
        `),
      };
    }

    case "support_ticket_replied": {
      const replyMessage = String(data.reply_message || "").slice(0, 300);
      const ticketId = String(data.ticket_id || "");
      return {
        subject: `New Reply on Your Support Ticket #${ticketId}`,
        html: emailShell("New Reply to Your Ticket", `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #1e40af; font-weight: 700;">Our Team Replied!</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            A support agent has responded to your ticket #${ticketId}:
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.6;">${replyMessage}${replyMessage.length >= 300 ? "..." : ""}</p>
          </div>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://obpay.online/support" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">View Ticket</a>
          </div>
        `),
      };
    }

    case "payment_received": {
      const amountStr = String(data.amount || "0");
      const currency = String(data.currency || "UGX");
      const customer = String(data.customer_phone || "customer");
      const reference = String(data.reference || "N/A");
      const fee = String(data.fee_amount || "0");
      const net = String(data.net_amount || amountStr);
      return {
        subject: `Payment Received: ${Number(amountStr).toLocaleString()} ${currency}`,
        html: emailShell("Payment Received!", `
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #065f46; font-weight: 700;">New Payment Received!</p>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <table width="100%" cellpadding="4" cellspacing="0">
              <tr><td style="font-size:13px;color:#6b7280;">Amount</td><td align="right" style="font-size:13px;font-weight:700;color:#111827;">${Number(amountStr).toLocaleString()} ${currency}</td></tr>
              <tr><td style="font-size:13px;color:#6b7280;">Fee</td><td align="right" style="font-size:13px;color:#dc2626;">-${Number(fee).toLocaleString()} ${currency}</td></tr>
              <tr><td colspan="2"><hr style="border:0;border-top:1px solid #e5e7eb;margin:4px 0;"></td></tr>
              <tr><td style="font-size:13px;color:#6b7280;">Net Amount</td><td align="right" style="font-size:15px;font-weight:700;color:#065f46;">${Number(net).toLocaleString()} ${currency}</td></tr>
            </table>
          </div>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Customer:</strong> ${customer}</p>
            <p style="margin:0;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Reference:</strong> ${reference}</p>
          </div>
        `),
      };
    }

    case "payment_failed": {
      const amountStr = String(data.amount || "0");
      const currency = String(data.currency || "UGX");
      const customer = String(data.customer_phone || "customer");
      const reference = String(data.reference || "N/A");
      return {
        subject: `Payment Failed: ${Number(amountStr).toLocaleString()} ${currency}`,
        html: emailShell("Payment Attempt Failed", `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #991b1b; font-weight: 700;">Payment Not Completed</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            A payment attempt was not completed. No funds were moved.
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Amount:</strong> ${Number(amountStr).toLocaleString()} ${currency}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Customer:</strong> ${customer}</p>
            <p style="margin:0;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Reference:</strong> ${reference}</p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            This could be due to insufficient funds, wrong PIN, or timeout on the customer's side.
          </p>
        `),
      };
    }

    case "loan_application_received": {
      const amt = String(data.amount || "0");
      const curr = String(data.currency || "UGX");
      const purpose = String(data.purpose || "Business Financing");
      const bizName = String(data.business_name || "Your Business");
      return {
        subject: "Loan Application Submitted — ObPay",
        html: emailShell("Loan Application Received", `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #1e40af; font-weight: 700;">Application Submitted!</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            Your loan application has been received and is under review.
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Amount:</strong> ${Number(amt).toLocaleString()} ${curr}</p>
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Purpose:</strong> ${purpose}</p>
            <p style="margin:0;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Business:</strong> ${bizName}</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280;">
            Our team will review your application within 1-2 business days. We'll notify you once a decision is made.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://obpay.online/dashboard/loans" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">View Loans</a>
          </div>
        `),
      };
    }

    case "payout_request_received": {
      const amt = String(data.amount || "0");
      const curr = String(data.currency || "UGX");
      const method = String(data.payment_method || "Mobile Money");
      return {
        subject: `Payout Request Submitted: ${Number(amt).toLocaleString()} ${curr}`,
        html: emailShell("Payout Request Received", `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 18px; color: #1e40af; font-weight: 700;">Payout Request Submitted</p>
          </div>
          <p style="margin: 0 0 12px; font-size: 14px; color: #374151; line-height: 1.7;">
            Your payout request is being processed.
          </p>
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin-bottom: 18px;">
            <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Amount:</strong> ${Number(amt).toLocaleString()} ${curr}</p>
            <p style="margin:0;font-size:13px;color:#6b7280;"><strong style="color:#111827;">Method:</strong> ${method}</p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            Payouts to mobile money are usually instant. Bank transfers may take 1-2 business days.
          </p>
        `),
      };
    }

    default: {
      const rawSubject = String(data.subject || data.ticket_subject || type);
      const rawBody = String(data.message || data.ticket_message || JSON.stringify(data));
      return {
        subject: rawSubject,
        html: emailShell("ObPay Notification", `<p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${rawBody}</p>`),
      };
    }
  }
}

// ── Core send helper ──
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
    console.error(`[transactional] Resend error for ${to}: ${errMsg}`);
    return { ok: false, error: errMsg };
  }

  if (!resBody?.id) {
    console.error(`[transactional] Resend 200 but no id for ${to}:`, JSON.stringify(resBody));
    return { ok: false, error: resBody?.message || "No email ID returned from Resend" };
  }

  console.log(`[transactional] Sent to ${to}, Resend ID: ${resBody.id}`);
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
    const internalKey = req.headers.get("x-obpay-internal") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    let isAuthorized = false;

    // Allow internal calls with x-obpay-internal header (for webhooks)
    if (internalKey && internalKey === serviceRoleKey && serviceRoleKey.length > 10) {
      isAuthorized = true;
    }

    // Standard auth: Bearer token (user JWT or service role key)
    if (!isAuthorized && token && token === serviceRoleKey && serviceRoleKey.length > 10) {
      isAuthorized = true;
    }

    if (!isAuthorized && token && token.startsWith("eyJ")) {
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (!authErr && user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
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
        JSON.stringify({ success: false, error: "RESEND_FROM_DOMAIN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();

    // ── TEMPLATE MODE: caller passes { email, type, data } ──
    if (body.email && body.type && body.data) {
      const template = buildTemplateEmail(body.type, body.data);
      const fullHtml = emailShell(template.subject, template.html);
      const result = await sendEmail(body.email, template.subject, fullHtml);

      const logStatus = result.ok ? "sent" : "failed";
      await supabaseAdmin.from("email_campaign_logs").insert({
        recipient_email: body.email,
        recipient_name: body.data?.company_name || body.data?.full_name || "",
        campaign_type: body.type,
        subject: template.subject,
        body_preview: template.html.replace(/<[^>]*>/g, "").slice(0, 150),
        status: logStatus,
      }).then(() => {}, () => {});

      return new Response(
        JSON.stringify(result.ok ? { success: true, resendId: result.resendId } : { success: false, error: result.error }),
        { status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DIRECT MODE: caller passes { recipient_email, subject, html_body } ──
    const { recipient_email, recipient_name, subject, html_body, notification_type } = body;

    if (!recipient_email || !subject || !html_body) {
      return new Response(
        JSON.stringify({ success: false, error: "recipient_email, subject and html_body are required (or use email/type/data for templates)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fullHtml = emailShell(subject, html_body);
    const result = await sendEmail(recipient_email, subject, fullHtml);

    const logStatus = result.ok ? "sent" : "failed";
    const campaignType = notification_type || "transactional";

    await supabaseAdmin.from("email_campaign_logs").insert({
      recipient_email,
      recipient_name: recipient_name || "",
      campaign_type: campaignType,
      subject,
      body_preview: html_body.replace(/<[^>]*>/g, "").slice(0, 150),
      status: logStatus,
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify(result.ok ? { success: true, resendId: result.resendId } : { success: false, error: result.error }),
      { status: result.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[transactional] Crash:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
