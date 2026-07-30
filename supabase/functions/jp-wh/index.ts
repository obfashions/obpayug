import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-julypay-signature, x-julypay-event, x-julypay-delivery, x-julypay-timestamp, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bodyText = await req.text();
  let payload: any;
  try { payload = JSON.parse(bodyText); } catch {
    return new Response(JSON.stringify({ received: false, error: "Invalid JSON" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Insert into julypay_hooks — the DB trigger handles everything
  const { error } = await supabase.from("julypay_hooks").insert({
    id: String(payload.id || ""),
    type: String(payload.type || ""),
    created: Number(payload.created || 0),
    data: payload.data || null,
    api_version: String(payload.api_version || ""),
    processed: false,
  });

  if (error) {
    console.error("Insert failed:", error.message);
    return new Response(JSON.stringify({ received: false, error: error.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
