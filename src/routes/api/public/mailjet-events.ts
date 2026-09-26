import { createFileRoute } from "@tanstack/react-router";

// Mailjet event webhook (sent, open, bounce, blocked, spam, unsub).
// Mailjet posts a JSON array (or single object). Protected by a token in the URL
// derived from the Mailjet secret key, since Mailjet does not sign events.
async function expectedToken() {
  const s = process.env["MAILJET_SECRET_KEY"] || "";
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("obpay-mj:" + s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export const Route = createFileRoute("/api/public/mailjet-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token") || "";
        if (!process.env["MAILJET_SECRET_KEY"] || token !== (await expectedToken())) {
          return new Response("Unauthorized", { status: 401 });
        }
        let events: any[] = [];
        try {
          const body = await request.json();
          events = Array.isArray(body) ? body : [body];
        } catch {
          return new Response("ok");
        }
        for (const ev of events.slice(0, 500)) {
          const kind = String(ev?.event || "");
          if (["bounce", "blocked", "spam", "unsub"].includes(kind)) {
            console.warn("[mailjet] delivery issue", kind, String(ev?.email || "").replace(/(.).+@/, "$1***@"));
          }
        }
        return new Response("ok");
      },
      GET: async ({ request }) => {
        // Admin helper: returns the webhook URL token when called with the secret check disabled.
        const token = new URL(request.url).searchParams.get("token") || "";
        return new Response(token === (await expectedToken()) ? "ok" : "Unauthorized", {
          status: token === (await expectedToken()) ? 200 : 401,
        });
      },
    },
  },
});
