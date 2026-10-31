import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const businessWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(10), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).parse(d))
  .handler(async ({ data }) => {
    const { requireIdentity } = await import("./identity.server");
    const identity = await requireIdentity(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const start = new Date(`${data.month}-01T00:00:00Z`);
    const end = new Date(start); end.setUTCMonth(end.getUTCMonth() + 1);
    const [kyc, mp] = await Promise.all([
      db.from("kyc_submissions").select("account_type,business_name,status,id_number,address").eq("merchant_id", identity.userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("merchant_profiles").select("company_name,merchant_id,country,verification_status").eq("user_id", identity.userId).maybeSingle(),
    ]);
    if (kyc.error || mp.error) throw new Error("Business details could not be loaded.");
    if (kyc.data?.account_type !== "business") return { business: false, rows: [], details: null, truncated: false };
    const read = async (table: string, owner: string) => {
      const rows: any[] = [];
      for (let offset = 0; offset < 5000; offset += 500) {
        const result = await db.from(table).select("reference,type,amount,fee_amount,net_amount,currency,status,created_at,description").eq(owner, identity.userId).gte("created_at", start.toISOString()).lt("created_at", end.toISOString()).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 499);
        if (result.error) throw new Error("Business statement could not be loaded. Please retry.");
        rows.push(...(result.data || []).map((r: any) => ({ ...r, source: table === "transactions" ? "dashboard" : "API / payment link" })));
        if ((result.data || []).length < 500) return { rows, truncated: false };
      }
      return { rows, truncated: true };
    };
    const [legacy, records] = await Promise.all([read("transactions", "user_id"), read("payment_records", "merchant_id")]);
    const refs = new Set(legacy.rows.map((r) => r.reference).filter(Boolean));
    const rows = [...legacy.rows, ...records.rows.filter((r) => !refs.has(r.reference))].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { business: true, details: { ...mp.data, ...kyc.data }, rows, truncated: legacy.truncated || records.truncated };
  });