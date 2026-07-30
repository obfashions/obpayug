import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req: Request) => {
  try {
    const { method } = req;
    const body = method === "POST" ? await req.json() : {};
    const action = body.action || "seed";

    if (action === "seed") {
      // Create test merchant auth users
      const testUsers = [
        { email: "jane@obfashions.com", password: "Test1234!", full_name: "Jane Mukasa", phone: "+256 700 111222", company: "ObFashions Ltd", country: "Uganda", address: "Plot 24, Kampala Road, Kampala", national_id: "UG12345678" },
        { email: "peter@kampalastore.ug", password: "Test1234!", full_name: "Peter Okello", phone: "+256 700 333444", company: "Kampala Store", country: "Uganda", address: "Shop 12, Acacia Mall, Kampala", national_id: "UG87654321" },
        { email: "grace@nilepay.co.ug", password: "Test1234!", full_name: "Grace Auma", phone: "+256 700 555666", company: "NilePay Solutions", country: "Uganda", address: "Suite 5, Jinja Road, Kampala", national_id: "UG11223344" },
      ];

      const results = [];

      for (const u of testUsers) {
        // Create auth user
        const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.full_name, phone_number: u.phone },
        });

        if (authErr) {
          results.push({ email: u.email, status: "skipped", reason: authErr.message });
          continue;
        }

        const userId = authUser.user.id;

        // Create profile
        await adminClient.from("profiles").insert({
          id: userId,
          email: u.email,
          full_name: u.full_name,
          phone_number: u.phone,
          role: "merchant",
          status: "active",
        });

        // Create merchant profile (KYC submission)
        await adminClient.from("merchant_profiles").insert({
          user_id: userId,
          company_name: u.company,
          country: u.country,
          business_address: u.address,
          national_id: u.national_id,
          verification_status: "pending",
        });

        results.push({ email: u.email, status: "created" });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, message: "Unknown action" }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});