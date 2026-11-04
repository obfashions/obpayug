import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/docs/page";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "MTN & Airtel Mobile Money API Docs — ObPay" },
      { name: "description", content: "REST API to collect and send MTN Mobile Money, Airtel Money and M-Pesa payments, with webhooks, payouts, balances and a no-money test mode." },
      { property: "og:title", content: "MTN & Airtel Mobile Money API Docs — ObPay" },
      { property: "og:description", content: "REST API to collect and send MTN Mobile Money, Airtel Money and M-Pesa payments, with webhooks, payouts, balances and a no-money test mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
