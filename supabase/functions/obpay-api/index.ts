import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ObPay API (JWT-protected version) — health/diagnostic shim.
// All real payment traffic goes through obpay-api-no-jwt (provider: MarzPay).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-obpay-key, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MARZ_BASE = "https://wallet.wearemarz.com/api/v1";

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getMarzCreds(supabase: any, userId?: string | null): Promise<{ key: string; secret: string; source: string }> {
  const pack = (key: string, secret: string, source: string) => {
    const k = (key || "").trim();
    let s = (secret || "").trim();
    if (k && !s && k.includes(":")) {
      const [first, ...rest] = k.split(":");
      return { key: first.trim(), secret: rest.join(":").trim(), source };
    }
    if (k && s.startsWith(k + ":")) s = s.slice(k.length + 1);
    return k && s ? { key: k, secret: s, source } : null;
  };

  const envHit = pack(Deno.env.get("MARZ_API_KEY") || "", Deno.env.get("MARZ_API_SECRET") || "", "supabase_secret");
  if (envHit) return envHit;

  try {
    const { data: ps } = await supabase.from("platform_settings").select("marz_api_key, marz_api_secret").limit(1).maybeSingle();
    const hit = pack(ps?.marz_api_key || "", ps?.marz_api_secret || "", "platform_settings");
    if (hit) return hit;
  } catch (_) { /* columns may not exist */ }

  try {
    const { data: ps } = await supabase.from("platform_settings").select("livepay_api_key, livepay_account_number").limit(1).maybeSingle();
    const hit = pack(ps?.livepay_api_key || "", ps?.livepay_account_number || "", "platform_settings_legacy_slot");
    if (hit) return hit;
  } catch (_) { /* ignore */ }

  if (userId) {
    try {
      const { data: row } = await supabase.from("livepay_credentials").select("api_key, account_number").eq("user_id", userId).eq("status", "active").maybeSingle();
      const hit = pack(row?.api_key || "", row?.account_number || "", "merchant_credentials");
      if (hit) return hit;
    } catch (_) { /* ignore */ }
  }

  return { key: "", secret: "", source: "none" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let body: any = {};
    try { body = JSON.parse(await req.text()); } catch { body = {}; }

    const action = (body._action || body.action || "").trim();

    if (action === "health") {
      const { key, secret, source } = await getMarzCreds(supabase);
      const ps: any = { configured: !!(key && secret), keySource: source };
      if (key && secret) {
        try {
          const r = await fetch(`${MARZ_BASE}/balance`, {
            headers: { "Authorization": `Basic ${btoa(`${key}:${secret}`)}`, "Accept": "application/json" },
          });
          ps.connected = r.ok;
          ps.balance = await r.json();
        } catch (e: any) { ps.connected = false; ps.error = e.message; }
      }
      return json({ success: true, data: { version: "6.0.0-marzpay", provider: "marzpay", provider_base: MARZ_BASE, provider_status: ps } });
    }

    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!bearerToken || !bearerToken.startsWith("eyJ")) {
      return json({ success: false, error: "JWT authentication required" }, 401);
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerToken);
    if (authErr || !user) return json({ success: false, error: "Session expired" }, 401);
    const { data: profileData } = await supabase.from("profiles").select("status, role").eq("id", user.id).maybeSingle();
    if (!profileData || profileData.status !== "active") return json({ success: false, error: "Account not active" }, 401);

    return json({ success: false, error: "Please use obpay-api-no-jwt for API calls. Pass your sk_live_... key in the X-API-Key header." }, 400);
  } catch (err: any) {
    return json({ success: false, error: `Internal error: ${err.message}` }, 500);
  }
});
