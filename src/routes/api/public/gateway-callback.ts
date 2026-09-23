import { createFileRoute } from "@tanstack/react-router";

/**
 * Banking-partner result notifications.
 *
 * The partner POSTs a JSON body with an `X-Sign` header (HMAC-SHA512 of the raw
 * body, keyed with our application key). We verify the signature against the RAW
 * body, settle the matching payment exactly once, and always answer the literal
 * uppercase `SUCCESS` so the notification is not retried.
 */

/** Notification source addresses used by our banking partner. */
const KNOWN_NOTIFY_IPS = new Set(["8.208.34.242", "8.208.84.60"]);

function sourceIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || request.headers.get("cf-connecting-ip") || "").trim();
}

async function handle(request: Request): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("x-sign") || "";
  const ip = sourceIp(request);
  if (ip && !KNOWN_NOTIFY_IPS.has(ip)) {
    console.warn("[gateway-callback] notification from unexpected address", ip);
  }

  const gateway = await import("@/lib/gateway.server");
  const creds = await gateway.getGatewayCreds();
  if (!creds) return new Response("SUCCESS", { status: 200 });

  const valid = await gateway.verifyCallbackSignature(raw, signature, creds.secret);
  if (!valid) return new Response("INVALID SIGNATURE", { status: 401 });

  let payload: any = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("SUCCESS", { status: 200 });
  }

  const event = String(payload?.eventType || "").toUpperCase();
  const data = payload?.eventData || {};
  const reference = String(data?.merchantReference || "").trim();
  const platformReference = String(data?.platformReference || "").trim();
  const status = gateway.mapStatus(String(data?.status || ""));

  if (!reference || !status || status === "pending") return new Response("SUCCESS", { status: 200 });

  // A short payment is never a full success.
  const amount = Number(data?.amount ?? 0);
  const amountPaid = data?.amountPaid != null ? Number(data.amountPaid) : amount;
  const isCollection = event.startsWith("COLLECTION");
  const settledStatus: "success" | "failed" =
    status === "success" && isCollection && amountPaid > 0 && amount > 0 && amountPaid < amount ? "failed" : status;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record } = await (supabaseAdmin as any)
      .from("payment_records")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (record && record.status === "pending") {
      const { settlePaymentRecord } = await import("@/lib/settle.server");
      await settlePaymentRecord(record, settledStatus, { providerReference: platformReference || null });
    }
  } catch {
    /* never fail the notification — the dashboard reconciles on its next sync */
  }

  try {
    const { applyCallbackToDashboard } = await import("@/lib/obpay.server");
    await applyCallbackToDashboard(reference, settledStatus);
  } catch {
    /* optional: only possible when a merchant-database service key is configured */
  }

  return new Response("SUCCESS", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export const Route = createFileRoute("/api/public/gateway-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async () =>
        new Response(JSON.stringify({ ok: true, note: "ObPay payment notification endpoint." }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
