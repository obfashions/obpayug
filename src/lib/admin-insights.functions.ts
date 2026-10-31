import { createServerFn } from "@tanstack/react-start";

const tokenInput = (d: { accessToken: string; days?: number }) => ({
  accessToken: String(d?.accessToken || ""),
  days: Math.min(Math.max(Number(d?.days) || 7, 1), 365),
});

/** Same spendable funds as the merchant view, without combining currencies. */
export const adminAccountBalances = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; userIds?: string[] }) => ({ accessToken: String(d.accessToken || ""), userIds: (d.userIds || []).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 51) }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken, "finance");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { combinedBalances } = await import("./balance-values");
    if (!data.userIds.length) return {};
    const [profiles, wallets, managed] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, default_currency").in("id", data.userIds),
      supabaseAdmin.from("merchant_wallets").select("*").in("user_id", data.userIds),
      supabaseAdmin.from("merchant_balances").select("merchant_id, currency, available_balance").in("merchant_id", data.userIds),
    ]);
    if (profiles.error || wallets.error || managed.error) throw new Error("Account balances could not be refreshed.");
    return Object.fromEntries((profiles.data || []).map((p) => {
      const wallet = wallets.data?.find((w) => w.user_id === p.id);
      const currency = p.default_currency || "UGX";
      const values = combinedBalances(wallet || null, managed.data?.filter((b) => b.merchant_id === p.id) || [], currency);
      return [p.id, { currency, withdrawals_enabled: wallet?.withdrawals_enabled !== false, available_balance: values[currency] || 0, wallets: values, pending_balance: Number(wallet?.pending_balance || 0), total_collections: Number(wallet?.total_collections || 0), total_payouts: Number(wallet?.total_payouts || 0) }];
    }));
  });

export const adminMerchantDirectory = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; search?: string; status?: string; verification?: string; accountType?: string; page?: number }) => ({ ...d, search: String(d.search || "").trim().slice(0, 120), page: Math.max(0, Math.floor(Number(d.page) || 0)) }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: directory, error } = await supabaseAdmin.rpc("admin_merchant_directory", { p_search: data.search, p_status: data.status || "all", p_verification: data.verification || "all", p_account_type: data.accountType || "all", p_page: data.page });
    if (error) throw new Error("Merchant accounts could not be loaded. Please retry.");
    const result = directory as any;
    const ids = (result.rows || []).map((r: any) => r.id);
    if (!ids.length) return result;
    const [members, base] = await Promise.all([
      supabaseAdmin.from("member_roles").select("user_id,role").in("user_id", ids),
      supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids),
    ]);
    if (members.error || base.error) throw new Error("Member permissions could not be loaded.");
    return { ...result, rows: result.rows.map((r: any) => {
      const roles = (members.data || []).filter((m) => m.user_id === r.id).map((m) => m.role);
      const admin = roles.includes("super_admin") || (base.data || []).some((b) => b.user_id === r.id && b.role === "admin");
      return { ...r, role: admin ? "admin" : "merchant", memberRoles: roles, role_tag: roles.join(", ") || null, support_agent: roles.includes("support_agent"), merchant_profiles: [{ ...r }] };
    }) };
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

/** Admin-only: one merchant's full activity — dashboard, API and payment-link payments together. */
export const adminMerchantActivity = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; userId: string }) => ({ accessToken: String(d?.accessToken || ""), userId: String(d?.userId || "") }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken, "finance");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const id = data.userId;
    const [mp, key, legacy, records, payouts, links] = await Promise.all([
      db.from("merchant_profiles").select("*").eq("user_id", id).maybeSingle(),
      db.from("merchant_api_keys").select("public_key, environment, status, created_at, last_used_at").eq("merchant_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("transactions").select("id, amount, currency, status, type, created_at, customer_phone, customer_name, description, payment_method, reference, fee_amount").eq("user_id", id).order("created_at", { ascending: false }).limit(500),
      db.from("payment_records").select("id, amount, currency, status, type, created_at, phone_number, description, source, reference, fee_amount").eq("merchant_id", id).order("created_at", { ascending: false }).limit(500),
      db.from("payout_requests").select("id, amount, currency, status, requested_at, phone_number").eq("user_id", id).order("requested_at", { ascending: false }).limit(10),
      db.from("payment_links").select("id", { count: "exact", head: true }).eq("merchant_id", id),
    ]);
    if ([mp, key, legacy, records, payouts, links].some((r) => r.error)) throw new Error("Account tracking could not be loaded. Please retry.");
    const seen = new Set((legacy.data || []).map((t: any) => t.reference).filter(Boolean));
    const fromRecords = (records.data || []).filter((r: any) => !seen.has(r.reference)).map((r: any) => ({
      id: r.id, amount: r.amount, currency: r.currency, status: r.status, type: r.type, created_at: r.created_at,
      customer_phone: r.phone_number, description: r.description, reference: r.reference, fee_amount: r.fee_amount,
      payment_method: r.source === "payment_link" ? "Payment link" : "API",
    }));
    const txs = [...(legacy.data || []), ...fromRecords].sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));
    return { mp: mp.data || null, apiKey: key.data || null, txs, payouts: payouts.data || [], linkCount: links.count || 0 };
  });

/** Admin-only: platform totals and recent activity across dashboard, API and payment-link payments, never counted twice. */
export const adminDashboardActivity = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => ({ accessToken: String(d?.accessToken || "") }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken, "finance");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const page = async (table: string, cols: string) => {
      const out: any[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data: rows, error } = await db.from(table).select(cols).order("created_at", { ascending: false }).range(from, from + 999);
        if (error) throw new Error("Activity could not be loaded.");
        out.push(...(rows || []));
        if (!rows || rows.length < 1000) break;
      }
      return out;
    };
    const [legacy, records, names] = await Promise.all([
      page("transactions", "id, user_id, reference, amount, currency, status, type, payment_method, customer_phone, created_at"),
      page("payment_records", "id, merchant_id, reference, amount, currency, status, type, source, phone_number, created_at"),
      db.from("profiles").select("id, full_name"),
    ]);
    const nameOf = new Map((names.data || []).map((p: any) => [p.id, p.full_name]));
    const refs = new Set(legacy.map((t) => t.reference).filter(Boolean));
    const all = [
      ...legacy,
      ...records.filter((r) => !refs.has(r.reference)).map((r) => ({ id: r.id, user_id: r.merchant_id, reference: r.reference, amount: r.amount, currency: r.currency, status: r.status, type: r.type, payment_method: r.source === "payment_link" ? "Payment link" : "API", customer_phone: r.phone_number, created_at: r.created_at })),
    ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const volume: Record<string, number> = {}; const todayVolume: Record<string, number> = {};
    let success = 0;
    for (const t of all) {
      if (t.status !== "success" && t.status !== "successful" && t.status !== "completed") continue;
      success++;
      const c = String(t.currency || "UGX").toUpperCase();
      volume[c] = (volume[c] || 0) + (Number(t.amount) || 0);
      if (new Date(t.created_at) >= today) todayVolume[c] = (todayVolume[c] || 0) + (Number(t.amount) || 0);
    }
    return {
      total: all.length, success, volume, todayVolume,
      recent: all.slice(0, 50).map((t) => ({ ...t, profiles: { full_name: nameOf.get(t.user_id) || null } })),
    };
  });
