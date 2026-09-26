import { createFileRoute } from "@tanstack/react-router";

/**
 * ObPay public merchant API (v1).
 *
 * Authentication: `Authorization: Bearer sk_live_...` (create keys in the
 * dashboard under API keys). Collections and payouts are executed against
 * ObPay's mobile money provider and recorded in the merchant's ObPay records.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function secretFrom(request: Request): string {
  const header = request.headers.get("authorization") || "";
  if (header) return header.replace(/^Bearer\s+/i, "").trim();
  return (request.headers.get("x-api-key") || "").trim();
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
  const started = Date.now();
  const url = new URL(request.url);
  const path = String((params as any)._splat || "").replace(/^\/+|\/+$/g, "");
  const api = await import("@/lib/public-api.server");
  const { logApiRequest } = await import("@/lib/platform.server");

  const merchantId = await api.merchantForSecret(secretFrom(request));
  if (!merchantId) return json({ success: false, error: "Invalid or missing API secret key." }, 401);
  if (rateLimited(merchantId)) {
    return json({ success: false, error: "Too many requests. Try again in a minute." }, 429);
  }

  let body: Record<string, any> = {};
  if (request.method === "POST" || request.method === "PATCH") {
    const raw = await request.text();
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as Record<string, any>;
      } catch {
        return json({ success: false, error: "Request body must be valid JSON." }, 400);
      }
    }
  }

  const method = request.method;
  const seg = path.split("/").filter(Boolean);
  const result = await route();
  const status = (result as any)?.status ?? 200;
  const payload = (result as any)?.payload;

  void logApiRequest({
    merchant_id: merchantId,
    method,
    path: `/${path}`,
    action: seg[0] || "root",
    status_code: payload?.success === false ? (status === 200 ? 200 : status) : status,
    duration_ms: Date.now() - started,
    error_message: payload?.success === false ? String(payload.error).slice(0, 500) : null,
  });

  return json(payload, status);

  async function route(): Promise<{ payload: any; status?: number }> {
    // health / account
    if ((path === "" || path === "ping") && method === "GET") return { payload: await api.apiPing(merchantId!) };
    if (path === "account" && method === "GET") return { payload: await api.apiAccount(merchantId!) };
    if (path === "balance" && method === "GET") return { payload: await api.apiBalance(merchantId!) };

    // money movement
    if ((path === "collect" || path === "collections") && method === "POST") {
      return { payload: await api.apiCollect(merchantId!, body) };
    }
    if ((path === "payouts" || path === "send" || path === "send-money" || path === "withdraw") && method === "POST") {
      return { payload: await api.apiPayout(merchantId!, body) };
    }

    // refunds, rates, payout methods
    {
      const m = await import("@/lib/money.server");
      const who = { userId: merchantId!, email: "", isAdmin: false } as any;
      if ((path === "refund" || path === "refunds") && method === "POST") return { payload: await m.createRefund(who, body) };
      if (path === "refunds" && method === "GET") return { payload: await m.listRefundable(who) };
      if (path === "rates" && method === "GET") return { payload: await m.getRates() };
      if (path === "payout-methods" && method === "GET") {
        return { payload: await m.payoutMethods(url.searchParams.get("currency") || "UGX") };
      }
    }

    // transactions
    if (seg[0] === "transactions" && seg.length === 1 && method === "GET") {
      return { payload: await api.apiTransactions(merchantId!, url.searchParams) };
    }
    if (seg[0] === "transactions" && seg.length > 1 && method === "GET") {
      const ref = decodeURIComponent(seg.slice(1).join("/"));
      const payload = await api.apiTransaction(merchantId!, ref);
      return { payload, status: payload.success ? 200 : 404 };
    }
    if (path === "payments" && method === "GET") return { payload: await api.apiPayments(merchantId!) };

    // payment links
    if (seg[0] === "payment-links" && seg.length === 1) {
      if (method === "GET") return { payload: await api.apiListLinks(merchantId!) };
      if (method === "POST") return { payload: await api.apiCreateLink(merchantId!, body) };
    }
    if (seg[0] === "payment-links" && seg.length === 2) {
      if (method === "PATCH") return { payload: await api.apiUpdateLink(merchantId!, seg[1]!, body) };
      if (method === "DELETE") return { payload: await api.apiDeleteLink(merchantId!, seg[1]!) };
    }

    // webhooks
    if (seg[0] === "webhooks" && seg.length === 1) {
      if (method === "GET") return { payload: await api.apiListWebhooks(merchantId!) };
      if (method === "POST") return { payload: await api.apiCreateWebhook(merchantId!, body) };
    }
    if (seg[0] === "webhooks" && seg.length === 2) {
      if (method === "DELETE") return { payload: await api.apiDeleteWebhook(merchantId!, seg[1]!) };
    }
    if (seg[0] === "webhooks" && seg.length === 3 && seg[2] === "test" && method === "POST") {
      return { payload: await api.apiTestWebhook(merchantId!, seg[1]!) };
    }
    if (path === "webhook-deliveries" && method === "GET") {
      return { payload: await api.apiWebhookDeliveries(merchantId!, Number(url.searchParams.get("limit") || 50)) };
    }

    return {
      payload: { success: false, error: `Unknown endpoint: ${method} /${path}` },
      status: 404,
    };
  }
}

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => handle(request, params as any),
      POST: async ({ request, params }) => handle(request, params as any),
      PATCH: async ({ request, params }) => handle(request, params as any),
      DELETE: async ({ request, params }) => handle(request, params as any),
    },
  },
});
