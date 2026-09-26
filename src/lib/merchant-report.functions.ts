import { createServerFn } from "@tanstack/react-start";

/** Admin-only: a merchant's payments (API + payment links) for one month. */
export const merchantMonthRecords = createServerFn({ method: "POST" })
  .inputValidator((d: { merchantId: string; month: string; accessToken: string }) => ({
    merchantId: String(d?.merchantId || ""),
    month: /^\d{4}-\d{2}$/.test(String(d?.month)) ? String(d.month) : new Date().toISOString().slice(0, 7),
    accessToken: String(d?.accessToken || ""),
  }))
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      await requireAdmin(data.accessToken);
      const start = new Date(`${data.month}-01T00:00:00Z`);
      const end = new Date(start);
      end.setUTCMonth(end.getUTCMonth() + 1);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: rows }, { data: kyc }] = await Promise.all([
        (supabaseAdmin as any)
          .from("payment_records")
          .select("reference, type, amount, fee_amount, net_amount, currency, status, phone_number, description, source, created_at")
          .eq("merchant_id", data.merchantId)
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: true }),
        (supabaseAdmin as any)
          .from("kyc_submissions")
          .select("business_name, full_name, status")
          .eq("merchant_id", data.merchantId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { success: true, rows: rows || [], kyc: kyc || null };
    } catch (e: any) {
      return { success: false, error: e?.message || "Could not load the report.", rows: [], kyc: null };
    }
  });
