import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const results: Record<string, unknown> = {};

  // 1. Check secrets
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN");

  results.secrets = {
    RESEND_API_KEY_exists: !!apiKey,
    RESEND_API_KEY_prefix: apiKey ? apiKey.substring(0, 6) + "..." : "MISSING",
    RESEND_API_KEY_length: apiKey ? apiKey.length : 0,
    RESEND_FROM_DOMAIN_exists: !!fromDomain,
    RESEND_FROM_DOMAIN_value: fromDomain || "MISSING",
    RESEND_FROM_DOMAIN_length: fromDomain ? fromDomain.length : 0,
  };

  // 2. Try sending a test email
  if (apiKey && fromDomain) {
    const fromAddress = `ObPay <noreply@${fromDomain}>`;
    const testEmail = `test-${Date.now()}@obpay.online`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [testEmail],
          subject: "ObPay Resend Connection Test",
          html: "<p>This is a diagnostic test from ObPay.</p>",
        }),
      });

      const body = await res.text();
      results.test_email = {
        status: res.status,
        ok: res.ok,
        body: body,
        from_used: fromAddress,
      };
    } catch (sendErr) {
      results.test_email = { error: String(sendErr) };
    }

    // 3. List domains
    try {
      const domainsRes = await fetch("https://api.resend.com/domains", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });
      const domainsBody = await domainsRes.text();
      results.domains = {
        status: domainsRes.status,
        ok: domainsRes.ok,
        body: domainsBody,
      };
    } catch (domainsErr) {
      results.domains = { error: String(domainsErr) };
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
