// Server-only transaction notifications.
//
// Whenever a transaction settles as successful we:
//   1. mirror it into ObPay's own payment records (what the admin screens read)
//   2. email the merchant a receipt
//   3. email the ObPay admin an alert
//
// Everything here is best effort: a mail or mirror failure must never break a
// settlement that already happened at the provider.

const BUILT_IN_URL = (import.meta.env["VITE_PUBLIC_SUPABASE_URL"] as string) || "";
const BUILT_IN_KEY = (import.meta.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] as string) || "";

const legacyUrl = () =>
  (process.env["LEGACY_SUPABASE_URL"] || process.env["VITE_PUBLIC_SUPABASE_URL"] || BUILT_IN_URL || "").replace(/\/+$/, "");
const legacyKey = () =>
  (process.env["LEGACY_SUPABASE_ANON_KEY"] || process.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] || BUILT_IN_KEY || "").trim();

export const ADMIN_ALERT_EMAIL = () =>
  (process.env["ADMIN_ALERT_EMAIL"] || "obfashions256@gmail.com").trim();

export interface SettlementInfo {
  merchantId: string;
  reference: string;
  type: "collection" | "payout" | string;
  amount: number | string;
  currency?: string;
  status: "success" | "failed" | string;
  phone_number?: string | null;
  description?: string | null;
  source?: string;
  merchantEmail?: string | null;
  merchantName?: string | null;
  accessToken?: string | null;
}

const money = (amount: number | string, currency = "UGX") =>
  `${currency} ${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Best-effort lookup of the merchant's email address. */
async function resolveMerchantEmail(info: SettlementInfo): Promise<{ email: string | null; name: string | null }> {
  if (info.merchantEmail) return { email: info.merchantEmail, name: info.merchantName ?? null };

  const base = legacyUrl();
  const key = legacyKey();
  if (base && key) {
    try {
      const resp = await fetch(
        `${base}/rest/v1/profiles?id=eq.${info.merchantId}&select=email,full_name,company_name`,
        {
          headers: {
            apikey: key,
            ...(info.accessToken ? { Authorization: `Bearer ${info.accessToken}` } : {}),
          },
        },
      );
      if (resp.ok) {
        const rows = (await resp.json()) as Array<Record<string, string>>;
        const row = rows?.[0];
        if (row?.email) return { email: row.email, name: row.company_name || row.full_name || null };
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: the verification record the merchant submitted to ObPay.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("kyc_submissions")
      .select("email, full_name, business_name")
      .eq("merchant_id", info.merchantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.email) return { email: data.email, name: data.business_name || data.full_name || null };
  } catch {
    /* no email available */
  }

  return { email: null, name: info.merchantName ?? null };
}

async function sendMail(to: string, subject: string, html: string, type: string) {
  const base = legacyUrl();
  const key = legacyKey();
  if (!base || !key || !to) return false;
  try {
    const resp = await fetch(`${base}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_email: to,
        subject,
        html_body: html,
        notification_type: type,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/** Operational alert to the ObPay admin mailbox (not merchant facing). */
export async function sendAdminAlert(subject: string, html: string): Promise<boolean> {
  return await sendMail(ADMIN_ALERT_EMAIL(), subject, html, "admin_operational_alert");
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">${label}</td><td style="padding:6px 0;font-size:13px;color:#111827;font-weight:600;text-align:right;">${value}</td></tr>`;
}

function detailsTable(info: SettlementInfo) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;">
    ${row("Reference", String(info.reference))}
    ${row("Type", info.type === "payout" ? "Payout" : "Collection")}
    ${row("Amount", money(info.amount, info.currency))}
    ${info.phone_number ? row("Phone", String(info.phone_number)) : ""}
    ${info.description ? row("Description", String(info.description)) : ""}
    ${row("Status", "Successful")}
    ${row("Date", new Date().toLocaleString("en-GB", { timeZone: "Africa/Kampala" }))}
  </table>`;
}

/** Mirrors a settled transaction into ObPay's records so admin screens see it. */
async function mirrorForAdmin(info: SettlementInfo) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any).from("payment_records").upsert(
      {
        merchant_id: info.merchantId,
        reference: info.reference,
        type: info.type,
        amount: Number(info.amount) || 0,
        currency: (info.currency || "UGX").toUpperCase(),
        phone_number: info.phone_number ?? null,
        description: info.description ?? null,
        status: info.status,
        source: info.source || "dashboard",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "reference" },
    );
  } catch {
    /* admin mirror is best effort */
  }
}

/**
 * Called once a transaction reaches a terminal state. Emails go out only for
 * successful transactions; the admin mirror runs for every terminal state.
 */
export async function notifySettlement(info: SettlementInfo): Promise<void> {
  await mirrorForAdmin(info);
  if (info.status !== "success") return;

  const { email, name } = await resolveMerchantEmail(info);
  const isPayout = info.type === "payout";
  const heading = isPayout ? "Payout sent successfully" : "Payment received";

  const merchantHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.6;">
      ${name ? `Hi ${name},` : "Hello,"} your ${isPayout ? "payout" : "collection"} of
      <strong>${money(info.amount, info.currency)}</strong> completed successfully.
    </p>
    ${detailsTable(info)}
    <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">You can view this transaction any time in your ObPay dashboard.</p>`;

  const adminHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.6;">
      A ${isPayout ? "payout" : "collection"} completed successfully for merchant
      <strong>${name || info.merchantId}</strong>${email ? ` (${email})` : ""}.
    </p>
    ${detailsTable(info)}`;

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const common = {
    kind: isPayout ? "payout" : "collection",
    amount: money(info.amount, info.currency),
    reference: String(info.reference),
    phone: info.phone_number ? String(info.phone_number) : undefined,
    description: info.description ? String(info.description) : undefined,
    date: new Date().toLocaleString("en-GB", { timeZone: "Africa/Kampala" }),
  };
  void merchantHtml; void adminHtml; void heading;
  const tasks: Array<Promise<unknown>> = [
    sendTemplateEmail("transaction-receipt", ADMIN_ALERT_EMAIL(), {
      templateData: { ...common, forAdmin: true, merchant: `${name || info.merchantId}${email ? ` (${email})` : ""}` },
      idempotencyKey: `receipt-admin-${info.reference}`,
    }).catch((e) => console.error("admin receipt email failed", e?.code || e?.message)),
  ];
  if (email) {
    tasks.push(
      sendTemplateEmail("transaction-receipt", email, {
        templateData: { ...common, name: name || undefined },
        idempotencyKey: `receipt-merchant-${info.reference}`,
      }).catch((e) => console.error("merchant receipt email failed", e?.code || e?.message)),
    );
  }
  // Also send through Mailjet at the same time.
  try {
    const { sendMailjet, brandedHtml } = await import("./mailjet.server");
    const mj = [{ to: ADMIN_ALERT_EMAIL(), name: "ObPay Admin", subject: `[ObPay] ${heading} — ${money(info.amount, info.currency)}`, html: brandedHtml(heading, adminHtml), customId: `admin-${info.reference}` }];
    if (email) mj.push({ to: email, name: name || email, subject: `[ObPay] ${heading} — ${money(info.amount, info.currency)}`, html: brandedHtml(heading, merchantHtml), customId: `merchant-${info.reference}` });
    tasks.push(sendMailjet(mj).then((r) => { if (r.failed) console.error("mailjet receipt failed", r.errors); }));
  } catch (e: any) {
    console.error("mailjet receipt failed", e?.message);
  }
  await Promise.allSettled(tasks);
}
