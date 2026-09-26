import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/payouts/page";

export const Route = createFileRoute("/dashboard/payouts")({
  head: () => ({
    meta: [
      { title: "Payouts · ObPay" },
      { name: "description", content: "Send payouts from your ObPay account." },
      { property: "og:title", content: "Payouts · ObPay" },
      { property: "og:description", content: "Send payouts from your ObPay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
