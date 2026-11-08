import { createFileRoute } from "@tanstack/react-router";

/**
 * Payment-partner result notifications.
 *
 * The partner POSTs JSON with an `X-Payza-Signature` header (HMAC-SHA256 of the
 * raw body, keyed with the webhook signing secret). We verify the signature on
 * the RAW body, then re-check the status with the partner's verify endpoint
 * before settling (never trust the notification alone), settle exactly once,
 * and answer 200 quickly so it is not retried.
 */

async function handle(request: Request): Promise<Response> {
  const raw = await request.text();
  const signature = request.headers.get("x-payza-signature") || "";

  const gateway = await import("@/lib/gateway.server");
  const secret = gateway.webhookSecret();
  if (!secret) return new Response("OK", { status: 200 });

  const valid = await gateway.verifyCallbackSignature(raw, signature, secret);
  if (!valid) return new Response("INVALID SIGNATURE", { status: 401 });

  let payload: any = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("OK", { status: 200 });
  }

  const event = String(payload?.event || "").toLowerCase();
  const reference = String(payload?.reference || "").trim();
  if (!reference || !event.startsWith("payment.") || event === "payment.refunded") {
    return new Response("OK", { status: 200 });
  }

  let status = gateway.mapStatus(String(payload?.status || event.replace("payment.", "")));
  const creds = await gateway.getGatewayCreds();
  let partnerFee: number | undefined;
  let verifiedAmount = 0;
  let verifiedCurrency = "";
  let verifiedReference = "";

  // Confirm with the partner before crediting anyone.
  if (status === "success") {
    if (!creds) return new Response("OK", { status: 200 });
    const check = await gateway.gatewayCollectionStatus(creds, reference);
    if (check.ok) {
      status = check.status;
      partnerFee = check.partnerFee;
      verifiedAmount = check.amount;
      verifiedCurrency = check.currency;
      verifiedReference = String(check.res.data?.reference || "");
    } else status = null; // could not confirm now — the dashboard sync retries later
  }
  if (!status || status === "pending") return new Response("OK", { status: 200 });

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: record } = await (supabaseAdmin as any)
      .from("payment_records")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();

    if (record && record.status === "pending") {
      if (record.metadata?.provider === "marz") return new Response("OK", { status: 200 });
      if (record.metadata?.payment_method === "card" && status === "success" && (verifiedAmount !== Number(record.amount) || verifiedCurrency !== record.currency || verifiedReference !== record.reference)) return new Response("OK", { status: 200 });
      // A short payment is never a full success.
      const paid = verifiedAmount;
      const settled: "success" | "failed" =
        status === "success" && paid > 0 && Number(record.amount) > 0 && paid < Number(record.amount) ? "failed" : status;
      const { settlePaymentRecord } = await import("@/lib/settle.server");
      await settlePaymentRecord(record, settled, { providerReference: reference, partnerFee });
    }
  } catch {
    /* never fail the notification — the dashboard reconciles on its next sync */
  }

  try {
    const { applyCallbackToDashboard } = await import("@/lib/obpay.server");
    await applyCallbackToDashboard(reference, status);
  } catch {
    /* optional */
  }

  return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
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
