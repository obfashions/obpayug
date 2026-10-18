import { createServerFn } from "@tanstack/react-start";

const tokenInput = (d: { accessToken: string; days?: number }) => ({
  accessToken: String(d?.accessToken || ""),
  days: Math.min(Math.max(Number(d?.days) || 7, 1), 365),
});

/** Same spendable funds as the merchant view, without combining currencies. */
export const adminAccountBalances = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => ({ accessToken: String(d.accessToken || "") }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { combinedBalances } = await import("./balance-values");
    const [profiles, wallets, managed] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, default_currency"),
      supabaseAdmin.from("merchant_wallets").select("*"),
      supabaseAdmin.from("merchant_balances").select("merchant_id, currency, available_balance"),
    ]);
    if (profiles.error || wallets.error || managed.error) throw new Error("Account balances could not be refreshed.");
    return Object.fromEntries((profiles.data || []).map((p) => {
      const wallet = wallets.data?.find((w) => w.user_id === p.id);
      const currency = p.default_currency || "UGX";
      const values = combinedBalances(wallet || null, managed.data?.filter((b) => b.merchant_id === p.id) || [], currency);
      return [p.id, { ...wallet, currency, available_balance: values[currency] || 0, pending_balance: Number(wallet?.pending_balance || 0), total_collections: Number(wallet?.total_collections || 0), total_payouts: Number(wallet?.total_payouts || 0) }];
    }));
  });

/** Admin-only: real API usage grouped by endpoint. */
export const adminApiMetrics = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      await requireAdmin(data.accessToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - data.days * 86400000).toISOString();
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("api_request_logs")
        .select("method, path, status_code, duration_ms, error_message, created_at, merchant_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      const map = new Map<string, { endpoint: string; requests: number; errors: number; totalMs: number }>();
      for (const r of rows || []) {
        const key = `${r.method} ${String(r.path).replace(/\/[0-9A-Za-z_-]{16,}/g, "/:id")}`;
        const m = map.get(key) || { endpoint: key, requests: 0, errors: 0, totalMs: 0 };
        m.requests++;
        if (Number(r.status_code) >= 400) m.errors++;
        m.totalMs += Number(r.duration_ms) || 0;
        map.set(key, m);
      }
      const endpoints = [...map.values()]
        .map((m) => ({
          endpoint: m.endpoint,
          requests: m.requests,
          errors: m.errors,
          successRate: m.requests ? Math.round(((m.requests - m.errors) / m.requests) * 1000) / 10 : 100,
          avgLatencyMs: m.requests ? Math.round(m.totalMs / m.requests) : 0,
        }))
        .sort((a, b) => b.requests - a.requests);
      const recentErrors = (rows || [])
        .filter((r: any) => Number(r.status_code) >= 400)
        .slice(0, 20)
        .map((r: any) => ({ at: r.created_at, endpoint: `${r.method} ${r.path}`, code: r.status_code, message: r.error_message || "" }));
      return { success: true, endpoints, recentErrors };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not load API data.", endpoints: [], recentErrors: [] };
    }
  });

/** Admin-only: API + payment-link payments for the reports page. */
export const adminCloudPayments = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      await requireAdmin(data.accessToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const since = new Date(Date.now() - data.days * 86400000).toISOString();
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("payment_records")
        .select("type, amount, fee_amount, status, created_at, source")
        .gte("created_at", since)
        .limit(10000);
      if (error) throw error;
      return { success: true, rows: rows || [] };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not load payments.", rows: [] };
    }
  });

/** Admin-only: disable every merchant API key at once. */
export const revokeAllApiKeys = createServerFn({ method: "POST" })
  .inputValidator(tokenInput)
  .handler(async ({ data }) => {
    try {
      const { requireAdmin } = await import("./identity.server");
      await requireAdmin(data.accessToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await (supabaseAdmin as any)
        .from("merchant_api_keys")
        .update({ status: "revoked" })
        .eq("status", "active")
        .select("id");
      if (error) throw error;
      return { success: true, count: (rows || []).length };
    } catch (err: any) {
      return { success: false, error: err?.message || "Could not revoke keys.", count: 0 };
    }
  });
