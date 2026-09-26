// Server-only Mailjet sender (Send API v3.1). Never import from client code.

export interface MailjetMessage {
  to: string;
  name?: string | null;
  subject: string;
  html: string;
  text?: string;
  customId?: string;
}

const FROM_EMAIL = () => (process.env["MAILJET_FROM_EMAIL"] || "noreply@obpay.online").trim();
const FROM_NAME = "ObPay";

function auth() {
  const key = process.env["MAILJET_API_KEY"];
  const secret = process.env["MAILJET_SECRET_KEY"];
  if (!key || !secret) return null;
  return "Basic " + btoa(`${key.trim()}:${secret.trim()}`);
}

export function mailjetConfigured() {
  return !!auth();
}

/** Sends up to any number of messages, batched 50 per request. Returns counts. */
export async function sendMailjet(messages: MailjetMessage[]): Promise<{ sent: number; failed: number; errors: string[] }> {
  const header = auth();
  if (!header) return { sent: 0, failed: messages.length, errors: ["Mailjet keys are not configured."] };
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let i = 0; i < messages.length; i += 50) {
    const batch = messages.slice(i, i + 50);
    try {
      const resp = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: { Authorization: header, "Content-Type": "application/json" },
        body: JSON.stringify({
          Messages: batch.map((m) => ({
            From: { Email: FROM_EMAIL(), Name: FROM_NAME },
            To: [{ Email: m.to, Name: m.name || m.to }],
            Subject: m.subject,
            HTMLPart: m.html,
            TextPart: m.text || m.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
            ...(m.customId ? { CustomID: m.customId.slice(0, 250) } : {}),
          })),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const body: any = await resp.json().catch(() => ({}));
      if (Array.isArray(body?.Messages)) {
        for (const r of body.Messages) {
          if (r?.Status === "success") sent++;
          else {
            failed++;
            const e = r?.Errors?.[0]?.ErrorMessage;
            if (e && errors.length < 5) errors.push(e);
          }
        }
      } else {
        failed += batch.length;
        errors.push(body?.ErrorMessage || `Mailjet error ${resp.status}`);
      }
    } catch (e: any) {
      failed += batch.length;
      errors.push(e?.message || "Mailjet request failed");
    }
  }
  return { sent, failed, errors };
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ObPay-branded email shell. `bodyHtml` must already be safe HTML. */
export function brandedHtml(title: string, bodyHtml: string) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:24px auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
<tr><td style="background:#111827;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:700;">ObPay</td></tr>
<tr><td style="padding:28px;"><h2 style="margin:0 0 14px;font-size:20px;color:#111827;">${esc(title)}</h2>
<div style="font-size:14px;line-height:1.7;color:#374151;">${bodyHtml}</div></td></tr>
<tr><td style="padding:16px 28px;background:#f9fafb;font-size:12px;color:#6b7280;">Need help? Call or WhatsApp ObPay support on +256762201984.</td></tr>
</table></body></html>`;
}

export function textToHtml(text: string) {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
