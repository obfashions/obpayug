import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/pricing/page";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "ObPay Pricing & Fees" },
      { name: "description", content: "Transparent per-transaction pricing for collections, payouts and payment links." },
      { property: "og:title", content: "ObPay Pricing & Fees" },
      { property: "og:description", content: "Transparent per-transaction pricing for collections, payouts and payment links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
