import { createServerFn } from "@tanstack/react-start";

const ALLOWED_KEYS = ["whatsapp_group_url", "exchange_fee_percent"] as const;

export const getSiteSetting = createServerFn({ method: "GET" })
  .inputValidator((data: { key: string }) => ({ key: String(data?.key || "") }))
  .handler(async ({ data }) => {
    if (!(ALLOWED_KEYS as readonly string[]).includes(data.key)) return { value: "" };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await (supabaseAdmin as any)
        .from("site_settings")
        .select("value")
        .eq("key", data.key)
        .maybeSingle();
      return { value: String(row?.value || "") };
    } catch {
      return { value: "" };
    }
  });

export const saveSiteSetting = createServerFn({ method: "POST" })
  .inputValidator((data: { key: string; value: string; accessToken: string }) => ({
    key: String(data?.key || ""),
    value: String(data?.value || "").trim().slice(0, 500),
    accessToken: String(data?.accessToken || ""),
  }))
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      const admin = await requireAdmin(data.accessToken);
      if (!(ALLOWED_KEYS as readonly string[]).includes(data.key)) return { success: false, error: "Unknown setting." };
      if (data.key === "whatsapp_group_url" && data.value && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com|www\.whatsapp\.com)\//i.test(data.value)) {
        return { success: false, error: "Enter a WhatsApp link starting with https://chat.whatsapp.com/ or https://wa.me/" };
      }
      if (data.key === "exchange_fee_percent") {
        const pct = Number(data.value);
        if (!Number.isFinite(pct) || pct < 0 || pct > 20) return { success: false, error: "Enter a percentage between 0 and 20." };
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await (supabaseAdmin as any).from("site_settings").upsert(
        { key: data.key, value: data.value, updated_at: new Date().toISOString(), updated_by: admin.email || admin.userId },
        { onConflict: "key" },
      );
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not save." };
    }
  });
