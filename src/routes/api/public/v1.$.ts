import { createFileRoute } from "@tanstack/react-router";

/**
 * ObPay public merchant API (v1).
 *
 * Authentication: `Authorization: Bearer sk_live_...` (create keys in the
 * dashboard under API keys). Collections are executed against ObPay's mobile
 * money provider and recorded in the merchant's ObPay payment records.
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function secretFrom(request: Request): string {
  const header = request.headers.get("authorization") || "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

// Lightweight per-key throttle so a leaked or looping key cannot hammer the
// payment provider. Best-effort (per server instance), not a billing control.
const RATE_LIMIT = 90; // requests
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (hits.size > 5000) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

async function handle(request: Request, params: Record<string, string>) {
  const path = String((params as any)._splat || "").replace(/^\/+|\/+$/g, "");
  const { merchantForSecret, apiCollect, apiTransaction, apiPayments } = await import(
    "@/lib/public-api.server"
  );

  const merchantId = await merchantForSecret(secretFrom(request));
  if (!merchantId) return json({ success: false, error: "Invalid or missing API secret key." }, 401);
  if (rateLimited(merchantId)) {
    return json({ success: false, error: "Too many requests. Try again in a minute." }, 429);
  }


  let body: Record<string, any> = {};
  if (request.method === "POST") {
    try {
      body = (await request.json()) as Record<string, any>;
    } catch {
      return json({ success: false, error: "Request body must be valid JSON." }, 400);
    }
  }

  if (path === "collect" && request.method === "POST") return json(await apiCollect(merchantId, body));
  if (path === "payments" && request.method === "GET") return json(await apiPayments(merchantId));
  if (path.startsWith("transactions/")) {
    return json(await apiTransaction(merchantId, decodeURIComponent(path.slice("transactions/".length))));
  }

  return json({ success: false, error: `Unknown endpoint: /${path}` }, 404);
}

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => json({ ok: true }),
      GET: async ({ request, params }) => handle(request, params as any),
      POST: async ({ request, params }) => handle(request, params as any),
    },
  },
});
