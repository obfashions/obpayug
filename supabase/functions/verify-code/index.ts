
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user_id, email, type, code } = await req.json();

    if (!user_id || !email || !type || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type !== "registration" && type !== "login") {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the most recent unused code for this user+email+type
    const { data: codes, error: fetchErr } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("user_id", user_id)
      .eq("email", email)
      .eq("type", type)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchErr) {
      console.error("Failed to fetch codes:", fetchErr);
      return new Response(
        JSON.stringify({ success: false, error: "Verification failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!codes || codes.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No verification code found. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const record = codes[0];

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Verification code has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check code match
    if (record.code !== code) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid verification code. Please try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used
    await supabaseAdmin
      .from("verification_codes")
      .update({ used: true })
      .eq("id", record.id);

    // Update profile based on type
    if (type === "registration") {
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", user_id);

      if (profileErr) {
        console.error("Failed to update profile email_verified:", profileErr);
      }
    } else {
      // login verification
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .update({ login_verified_at: new Date().toISOString() })
        .eq("id", user_id);

      if (profileErr) {
        console.error("Failed to update profile login_verified_at:", profileErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Verification successful" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
