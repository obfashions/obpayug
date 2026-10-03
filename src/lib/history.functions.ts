import { createServerFn } from "@tanstack/react-start";

type In = { accessToken: string; type?: string; status?: string; search?: string; all?: boolean };

/** Payments recorded by the managed engine (API, payment links, dashboard) mapped to the history row shape. */
export const listPaymentRecords = createServerFn({ method: "POST" })
  .inputValidator((d: In) => ({
    accessToken: String(d?.accessToken || ""),
    type: ["collection", "payout"].includes(String(d?.type)) ? String(d.type) : "",
    status: ["success", "pending", "failed"].includes(String(d?.status)) ? String(d.status) : "",
    search: String(d?.search || "").replace(/[%,()]/g, "").slice(0, 60),
    all: !!d?.all,
  }))
  .handler(async ({ data }) => {
    try {
      const { requireIdentity, requireAdmin } = await import("./identity.server");
      const who = data.all ? await requireAdmin(data.accessToken) : await requireIdentity(data.accessToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      let q = (supabaseAdmin as any)
        .from("payment_records")
        .select("id, merchant_id, reference, provider_reference, type, amount, fee_amount, net_amount, currency, phone_number, status, description, source, metadata, created_at, settled_at")
        .order("created_at", { ascending: false })
        .limit(data.all ? 300 : 500);
      if (!data.all) q = q.eq("merchant_id", who.userId);
      if (data.type) q = q.eq("type", data.type);
      if (data.status) q = q.eq("status", data.status);
      if (data.search) q = q.or(`reference.ilike.%${data.search}%,phone_number.ilike.%${data.search}%`);
      const { data: rows, error } = await q;
      if (error) throw error;
      let names: Record<string, string> = {};
      if (data.all && rows?.length) {
        const ids = [...new Set(rows.map((r: any) => r.merchant_id))];
        const { data: ps } = await (supabaseAdmin as any).from("profiles").select("id, full_name, email").in("id", ids);
        for (const p of ps || []) names[p.id] = p.full_name || p.email || "";
      }
      const srcLabel: Record<string, string> = { api: "API", payment_link: "Payment link", dashboard: "Dashboard", refund: "Refund", admin: "Admin" };
      return {
        success: true,
        rows: (rows || []).map((r: any) => ({
          id: r.id,
          reference: r.reference,
          amount: Number(r.amount),
          currency: r.currency,
          status: r.status,
          type: r.type,
          payment_method: `${srcLabel[r.source] || r.source} · mobile money`,
          customer_phone: r.phone_number || "",
          customer_name: r.metadata?.customer_name || r.metadata?.name || "",
          fee_amount: Number(r.fee_amount || 0),
          net_amount: Number(r.net_amount ?? r.amount),
          provider_reference: "",
          description: r.description || "",
          created_at: r.created_at,
          completed_at: r.settled_at,
          profiles: data.all ? { full_name: names[r.merchant_id] || "Unknown" } : null,
        })),
      };
    } catch (e: any) {
      return { success: false, error: e?.message || "Could not load payments.", rows: [] as any[] };
    }
  });
