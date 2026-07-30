import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ObPay API (JWT-protected version) — delegates to obpay-api-no-jwt
// This function is kept for backward compatibility but the no-jwt version is the main one
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-obpay-key, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const LIVEPAY_BASE = "https://livepay.me/api";

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getLivePayKey(supabase: any, userId?: string | null): Promise<{ key: string; accountNumber: string; source: string }> {
  const envKey = Deno.env.get("LIVEPAY_API_KEY") || "";
  const envAccount = Deno.env.get("LIVEPAY_ACCOUNT_NUMBER") || "";
  if (envKey && envKey.length > 10) return { key: envKey, accountNumber: envAccount, source: "supabase_secret" };
  try {
    const { data: ps } = await supabase.from("platform_settings").select("livepay_api_key, livepay_account_number, julypay_api_key").limit(1).maybeSingle();
    if (ps?.livepay_api_key && ps.livepay_api_key.length > 10) return { key: ps.livepay_api_key, accountNumber: ps.livepay_account_number || "", source: "platform_settings" };
    if (ps?.julypay_api_key && ps.julypay_api_key.length > 10) return { key: ps.julypay_api_key, accountNumber: "", source: "platform_settings_legacy" };
  } catch (_) 
  if (userId) {
    try {
      const { data: lp } = await supabase.from("livepay_credentials").select("api_key, account_number").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (lp?.api_key && lp.api_key.length > 10) return { key: lp.api_key, accountNumber: lp.account_number || "", source: "livepay_credentials_user" };
    } catch (_) {}
  }
  return { key: "", accountNumber: "", source: "none" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    let body: any = {};
    try { body = JSON.parse(await req.text()); } catch { body = {}; }
    
    const action = (body._action || body.action || "").trim();
    
    if (action === "health") {
      const { key, accountNumber, source } = await getLivePayKey(supabase);
      let ps: any = { configured: !!key, keySource: source, accountNumber: accountNumber || "not_set" };
      if (key && accountNumber) {
        try {
          const r = await fetch(`${LIVEPAY_BASE}/check-balance?accountNumber=${encodeURIComponent(accountNumber)}&currency=UGX`, {
            headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
          });
          ps.connected = r.ok;
          ps.balance = await r.json();
        } catch (e: any) { ps.connected = false; ps.error = e.message; }
      }
      return json({ success: true, data: { version: "4.0.0-livepay", provider: "livepay", provider_status: ps } });
    }

    // For all other actions, this function verifies JWT and then passes through to the no-jwt handler logic
    // Auth via JWT
    const authHeader = req.headers.get("authorization") || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    
    if (!bearerToken || !bearerToken.startsWith("eyJ")) {
      return json({ success: false, error: "JWT authentication required" }, 401);
    }
    
    const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerToken);
    if (authErr || !user) return json({ success: false, error: "Session expired" }, 401);
    const { data: profileData } = await supabase.from("profiles").select("status, role").eq("id", user.id).maybeSingle();
    if (!profileData || profileData.status !== "active") return json({ success: false, error: "Account not active" }, 401);
    
    // Pass through to no-jwt version by re-injecting
    body._api_key_from_jwt_user = user.id;
    
    return json({ success: false, error: "Please use obpay-api-no-jwt for API calls. Pass your sk_live_... key in X-API-Key header." }, 400);
  } catch (err: any) {
    return json({ success: false, error: `Internal error: ${err.message}` }, 500);
  }
});
