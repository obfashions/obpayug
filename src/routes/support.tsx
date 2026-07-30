import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/support/page";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "ObPay Support" },
      { name: "description", content: "Get help with payments, KYC, integrations and your merchant account." },
      { property: "og:title", content: "ObPay Support" },
      { property: "og:description", content: "Get help with payments, KYC, integrations and your merchant account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
