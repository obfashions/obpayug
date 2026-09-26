import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/payment-links/page";

export const Route = createFileRoute("/dashboard/payment-links")({
  head: () => ({
    meta: [
      { title: "Payment Links · ObPay" },
      { name: "description", content: "Create and manage links to collect payments." },
      { property: "og:title", content: "Payment Links · ObPay" },
      { property: "og:description", content: "Create and manage links to collect payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
