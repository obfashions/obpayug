import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/support/page";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "ObPay Support — Payment Gateway Help Uganda" },
      { name: "description", content: "Get help with mobile money payments, payouts, KYC documents, API integration and your ObPay merchant account." },
      { property: "og:title", content: "ObPay Support — Payment Gateway Help Uganda" },
      { property: "og:description", content: "Get help with mobile money payments, payouts, KYC documents, API integration and your ObPay merchant account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
