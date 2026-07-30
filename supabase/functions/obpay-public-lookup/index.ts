
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let reqBody: any = {};
  if (req.method === "POST") { try { reqBody = await req.json(); } catch {} }
  const action = reqBody._action || "";

  try {
    if (action === "public-lookup" && reqBody._merchant_slug) {
      const slug = String(reqBody._merchant_slug).trim();
      if (!slug) {
        return new Response(JSON.stringify({ success: false, error: "merchant_slug is required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: linkData } = await supabaseAdmin.from("payment_links").select("id, amount, currency, description, reference, status, expiry_date, user_id, url_slug").eq("url_slug", slug).eq("status", "active").maybeSingle();

      let merchantUserId: string | null = null;
      let link = null;
      let merchant = null;

      if (linkData?.user_id) {
        merchantUserId = linkData.user_id;
        const { data: profile } = await supabaseAdmin.from("merchant_profiles").select("company_name, merchant_id, user_id").eq("user_id", linkData.user_id).maybeSingle();
        if (profile) {
          merchant = { company_name: profile.company_name || "Merchant", merchant_id: profile.merchant_id || "", user_id: profile.user_id };
        }
        link = {
          id: linkData.id,
          amount: Number(linkData.amount || 0),
          currency: linkData.currency || "UGX",
          description: linkData.description || "",
          reference: linkData.reference || "",
          status: linkData.status || "active",
          expiry_date: linkData.expiry_date || null,
          user_id: linkData.user_id,
        };
      } else {
        const { data: merchantData } = await supabaseAdmin.from("merchant_profiles").select("company_name, merchant_id, user_id").eq("merchant_slug", slug).eq("verification_status", "approved").maybeSingle();
        if (merchantData) {
          merchantUserId = merchantData.user_id;
          merchant = { company_name: merchantData.company_name || "Merchant", merchant_id: merchantData.merchant_id || "", user_id: merchantData.user_id };
        }
      }

      if (!merchantUserId) {
        return new Response(JSON.stringify({ success: false, error: "Merchant not found or not verified." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: psData } = await supabaseAdmin.from("platform_settings").select("platform_fee_percent").limit(1).maybeSingle();
      const feePercent = psData?.platform_fee_percent ?? 5.0;

      return new Response(JSON.stringify({
        success: true,
        data: {
          merchant,
          link,
          platform_fee_percent: feePercent,
        }
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("obpay-public-lookup FATAL:", err.message);
    return new Response(JSON.stringify({ success: false, error: `Internal server error: ${err.message}` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
