
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function triggerCampaign(campaigns: string[]): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-automated-emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ campaigns }),
  });
  const data = await res.text();
  console.log(`[${new Date().toISOString()}] Triggered ${campaigns.join(",")}: ${res.status} - ${data}`);
}

// Morning greeting: 5 AM UTC = 8 AM EAT
Deno.cron("morning-greeting", "0 5 * * *", async () => {
  console.log("Running morning greeting cron...");
  await triggerCampaign(["greeting"]);
});

// Afternoon greeting: 11 AM UTC = 2 PM EAT
Deno.cron("afternoon-greeting", "0 11 * * *", async () => {
  console.log("Running afternoon greeting cron...");
  await triggerCampaign(["greeting"]);
});

// Evening greeting: 5 PM UTC = 8 PM EAT
Deno.cron("evening-greeting", "0 17 * * *", async () => {
  console.log("Running evening greeting cron...");
  await triggerCampaign(["greeting"]);
});

// Referral nudge: every 8 hours (at 0:00, 8:00, 16:00 UTC)
Deno.cron("referral-nudge", "0 */8 * * *", async () => {
  console.log("Running referral nudge cron...");
  await triggerCampaign(["referral"]);
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Email scheduler is running",
      schedules: [
        { name: "morning-greeting", cron: "0 5 * * *", description: "8 AM EAT daily" },
        { name: "afternoon-greeting", cron: "0 11 * * *", description: "2 PM EAT daily" },
        { name: "evening-greeting", cron: "0 17 * * *", description: "8 PM EAT daily" },
        { name: "referral-nudge", cron: "0 */8 * * *", description: "Every 8 hours" },
      ],
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
