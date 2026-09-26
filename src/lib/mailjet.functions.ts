import { createServerFn } from "@tanstack/react-start";

async function collectMerchants(accessToken: string) {
  const out = new Map<string, string | null>();
  const base = ((import.meta.env["VITE_PUBLIC_SUPABASE_URL"] as string) || "").replace(/\/+$/, "");
  const key = ((import.meta.env["VITE_PUBLIC_SUPABASE_ANON_KEY"] as string) || "").trim();
  if (base && key) {
    try {
      const resp = await fetch(`${base}/rest/v1/profiles?select=email,full_name,company_name&limit=5000`, {
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
      if (e && !out.has(e)) out.set(e, r.business_name || r.full_name || null);
    }
  } catch {
    /* ignore */
  }
  return [...out.entries()].filter(([e]) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export const sendMerchantNotice = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; subject: string; body: string; testTo?: string }) => ({
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
      const list = data.testTo ? [[data.testTo, null] as [string, string | null]] : await collectMerchants(data.accessToken);
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
