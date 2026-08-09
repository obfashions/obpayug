import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";

const SYSTEM_PROMPT = `You are "Oba", the online support assistant for ObPay — a Ugandan payment gateway that lets businesses collect and send mobile money, run payment links, and integrate a REST API.

How to reply:
- Be warm, concise and practical. Two to five short sentences, or a tight numbered list for steps.
- Answer in the customer's language if they don't write in English.
- Never invent balances, transaction outcomes, fees or account status. You cannot see a customer's account.
- Never ask for or repeat passwords, PINs, OTP codes, full card numbers or API secret keys.
- If the issue needs a human (a stuck transaction, refund, account suspension, KYC rejection, chargeback, or anything money-specific), say so plainly and tell them to open a support ticket lower on this page, or contact support@obpay.online / +256 762 201984 / WhatsApp +256 745 482977.

What you know about ObPay:
- Collections: the merchant enters the customer's mobile money number and amount; the customer gets an approval prompt on their phone. Supported for Uganda (UGX) and Kenya (KES). Numbers should be in international format such as +2567XXXXXXXX.
- Payouts / withdrawals: send money to any mobile money number from the dashboard Payouts page. Usually instant once approved; sometimes queued if the provider is slow.
- Other services: bank transfers (Uganda), bill payments (UMEME, NWSC, TV subscriptions) and airtime/data top-ups from the dashboard Services page.
- Fees: a platform fee is charged on collections (default 5%, set by the ObPay team) and payouts may carry a small fee. Exact figures depend on the merchant's plan — direct customers to the Pricing page rather than quoting numbers as guaranteed.
- KYC: merchants upload an ID and business documents from Dashboard → Verification. Review is usually within one business day. Uploads must be clear photos or PDFs.
- Payment links: created from Dashboard → Payment Links; share the link and the payer completes a mobile money payment on a hosted checkout page.
- API: documented at /docs. Keys are created in Dashboard → API Keys. Requests authenticate with an X-API-Key header; endpoints cover collections, payouts, balance, transactions, payment links and webhooks. Webhooks are signed and can be tested with a test.ping event.
- Sign-in: email plus a verification code. If the code doesn't arrive, ask them to check spam and try resending after a minute.

If you genuinely don't know, say so and point them to a human. Do not guess.`;

// Small per-IP guard so the assistant can't be abused as a free model proxy.
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 20;
}

export const Route = createFileRoute("/api/public/support-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "anonymous";
        if (rateLimited(ip)) {
          return new Response("Too many messages. Please wait a moment and try again.", { status: 429 });
        }

        let messages: unknown;
        try {
          ({ messages } = (await request.json()) as { messages?: unknown });
        } catch {
          return new Response("Invalid request body", { status: 400 });
        }
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("The assistant is not configured yet.", { status: 500 });
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          fetch: runIdFetch.fetch as typeof fetch,
        });

        // Only the last 20 turns are needed for a support conversation.
        const trimmed = (messages as UIMessage[]).slice(-20);

        const result = streamText({
          model: lovable.responses("openai/gpt-5.6-sol"),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(trimmed),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: trimmed,
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
