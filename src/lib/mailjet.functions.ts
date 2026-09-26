import { createServerFn } from "@tanstack/react-start";

async function collectMerchants(accessToken: string, provided: Array<{ email: string; name?: string | null }> = []) {
  const out = new Map<string, string | null>();
  for (const r of provided) {
    const e = String(r?.email || "").trim().toLowerCase();
    if (e) out.set(e, r?.name || null);
  }
  const base = ((import.meta.env["VITE_PUBLIC_SUPABASE_URL"] as string) || "").replace(/\/+$/, "");
  const key = ((import.meta.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] as string) || "").trim();
  if (base && key) {
    try {
      const resp = await fetch(`${base}/rest/v1/profiles?select=email,full_name,company_name&status=neq.deleted&limit=5000`, {
        headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
      });
      if (resp.ok) {
        for (const r of (await resp.json()) as any[]) {
          if (r?.email) out.set(String(r.email).toLowerCase(), r.company_name || r.full_name || null);
        }
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("kyc_submissions").select("email, full_name, business_name");
    for (const r of data || []) {
      const e = r?.email && String(r.email).toLowerCase();
      if (e && !out.has(e) && !provided.length) out.set(e, r.business_name || r.full_name || null);
    }
  } catch {
    /* ignore */
  }
  return [...out.entries()].filter(([e]) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export const sendMerchantNotice = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; subject: string; body: string; testTo?: string; recipients?: Array<{ email: string; name?: string | null }> }) => ({
    recipients: Array.isArray(d?.recipients) ? d.recipients.slice(0, 5000).map((r) => ({ email: String(r?.email || "").slice(0, 200), name: r?.name ? String(r.name).slice(0, 120) : null })) : [],
    accessToken: String(d?.accessToken || ""),
    subject: String(d?.subject || "").trim().slice(0, 200),
    body: String(d?.body || "").trim().slice(0, 10000),
    testTo: d?.testTo ? String(d.testTo).trim().slice(0, 200) : "",
  }))
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      await requireAdmin(data.accessToken);
      if (!data.subject || !data.body) return { success: false, error: "Subject and message are required." };
      const { sendMailjet, brandedHtml, textToHtml, mailjetConfigured } = await import("./mailjet.server");
      if (!mailjetConfigured()) return { success: false, error: "Mailjet keys are not configured." };
      const list = data.testTo ? [[data.testTo, null] as [string, string | null]] : await collectMerchants(data.accessToken, data.recipients);
      if (!list.length) return { success: false, error: "No merchant email addresses found." };
      const result = await sendMailjet(
        list.map(([to, name]) => {
          const text = data.body.replace(/\{name\}/g, name || "there");
          return { to, name, subject: data.subject, html: brandedHtml(data.subject, textToHtml(text)), text, customId: "notice" };
        }),
      );
      return { success: result.sent > 0, total: list.length, ...result, error: result.sent ? undefined : result.errors[0] };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not send." };
    }
  });

export const purgeMerchantData = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; merchantId: string }) => ({
    accessToken: String(d?.accessToken || ""),
    merchantId: String(d?.merchantId || "").trim(),
  }))
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      const admin = await requireAdmin(data.accessToken);
      if (!/^[0-9a-f-]{36}$/i.test(data.merchantId)) return { success: false, error: "Invalid merchant." };
      if (admin.userId === data.merchantId) return { success: false, error: "You cannot delete your own account." };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const db = supabaseAdmin as any;
      const id = data.merchantId;
      const { data: docs } = await db.from("kyc_documents").select("file_path").eq("merchant_id", id);
      const paths = (docs || []).map((d: any) => d.file_path).filter(Boolean);
      if (paths.length) await db.storage.from("kyc-documents").remove(paths);
      for (const t of ["kyc_documents", "kyc_submissions", "merchant_api_keys", "webhook_deliveries", "webhook_endpoints", "merchant_balances", "merchant_signing_secrets", "api_request_logs"]) {
        await db.from(t).delete().eq("merchant_id", id);
      }
      await db.from("payment_records").update({ payment_link_id: null }).eq("merchant_id", id);
      await db.from("payment_links").delete().eq("merchant_id", id);
      await db.from("payment_records").delete().eq("merchant_id", id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not delete." };
    }
  });
