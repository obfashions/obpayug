import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/refunds/page";

export const Route = createFileRoute("/dashboard/refunds")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Refunds · ObPay" },
      { name: "description", content: "See money returned to senders on your ObPay account." },
      { property: "og:title", content: "Refunds · ObPay" },
      { property: "og:description", content: "See money returned to senders on your ObPay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
