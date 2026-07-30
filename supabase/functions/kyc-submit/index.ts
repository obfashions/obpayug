
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE = 4 * 1024 * 1024;

function decodeBase64(base64Str: string): { data: Uint8Array; mime: string } | null {
  try {
    const match = base64Str.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const clean = match[2];
    const binaryStr = atob(clean);
    const data = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      data[i] = binaryStr.charCodeAt(i);
    }
    return { data, mime };
  } catch {
    return null;
  }
}

async function sendKycConfirmationEmail(supabaseUrl: string, serviceRoleKey: string, email: string, data: Record<string, any>) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        type: "kyc_documents_submitted",
        data,
      }),
    });
  } catch (e) {
    console.error("[kyc-submit] Confirmation email failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server misconfiguration: missing service key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      frontBase64,
      backBase64,
      frontFileName,
      backFileName,
      company_name,
      country,
      business_address,
      national_id,
    } = body;

    if (!frontBase64 || !backBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Both front and back ID images are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!company_name || !country || !business_address || !national_id) {
      return new Response(
        JSON.stringify({ success: false, error: "All business information fields are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const frontDecoded = decodeBase64(frontBase64);
    const backDecoded = decodeBase64(backBase64);

    if (!frontDecoded) {
      return new Response(
        JSON.stringify({ success: false, error: "Front ID image is invalid or corrupted." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!backDecoded) {
      return new Response(
        JSON.stringify({ success: false, error: "Back ID image is invalid or corrupted." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (frontDecoded.data.length > MAX_FILE_SIZE || backDecoded.data.length > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ success: false, error: "Image file is too large. Maximum 4MB per image." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const timestamp = Date.now();

    const frontExt = (frontFileName || "front.jpg").split(".").pop()?.toLowerCase() || "jpg";
    const backExt = (backFileName || "back.jpg").split(".").pop()?.toLowerCase() || "jpg";

    const frontPath = `${user.id}/front_${timestamp}.${frontExt}`;
    const backPath = `${user.id}/back_${timestamp}.${backExt}`;

    const { error: frontErr } = await adminClient.storage
      .from("kyc-documents")
      .upload(frontPath, frontDecoded.data, {
        upsert: true,
        contentType: frontDecoded.mime,
      });

    if (frontErr) {
      console.error("[kyc-submit] Front upload failed:", frontErr.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload front of ID. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: backErr } = await adminClient.storage
      .from("kyc-documents")
      .upload(backPath, backDecoded.data, {
        upsert: true,
        contentType: backDecoded.mime,
      });

    if (backErr) {
      await adminClient.storage.from("kyc-documents").remove([frontPath]);
      console.error("[kyc-submit] Back upload failed:", backErr.message);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload back of ID. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: frontUrlData } = adminClient.storage.from("kyc-documents").getPublicUrl(frontPath);
    const { data: backUrlData } = adminClient.storage.from("kyc-documents").getPublicUrl(backPath);

    const { error: dbError } = await adminClient
      .from("merchant_profiles")
      .upsert(
        {
          user_id: user.id,
          company_name,
          country,
          business_address,
          national_id,
          id_front_url: frontUrlData.publicUrl,
          id_back_url: backUrlData.publicUrl,
          verification_status: "pending",
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      console.error("[kyc-submit] DB upsert failed:", dbError.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Images uploaded but failed to save profile: " + dbError.message,
          partial: true,
          frontUrl: frontUrlData.publicUrl,
          backUrl: backUrlData.publicUrl,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send confirmation email to the user (non-blocking)
    const userEmail = user.email;
    if (userEmail) {
      EdgeRuntime.waitUntil(
        sendKycConfirmationEmail(supabaseUrl, serviceRoleKey, userEmail, {
          company_name,
          country,
          national_id,
          submitted_at: new Date().toISOString(),
        })
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Verification documents submitted successfully. Check your email for confirmation.",
        frontUrl: frontUrlData.publicUrl,
        backUrl: backUrlData.publicUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[kyc-submit] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || "An unexpected error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
