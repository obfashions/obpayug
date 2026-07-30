
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, accept",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/functions/v1/obpay-api-no-jwt`;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (!["host", "connection", "content-encoding"].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  headers["X-Forwarded-From"] = "obpay-gateway-v3";

  try {
    const body = req.method !== "GET" ? await req.text() : undefined;
    const resp = await fetch(targetUrl, { method: req.method, headers, body: body || undefined });
    const respBody = await resp.text();
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "content-encoding") respHeaders[key] = value;
    });
    Object.entries(corsHeaders).forEach(([k, v]) => { respHeaders[k] = v; });
    return new Response(respBody, { status: resp.status, headers: respHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: `Gateway error: ${err.message}` }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
