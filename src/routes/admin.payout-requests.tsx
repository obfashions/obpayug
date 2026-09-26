import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/payout-requests/page";

export const Route = createFileRoute("/admin/payout-requests")({
  head: () => ({
    meta: [
      { title: "Payout Requests · ObPay" },
      { name: "description", content: "Review merchant withdrawal requests." },
      { property: "og:title", content: "Payout Requests · ObPay" },
      { property: "og:description", content: "Review merchant withdrawal requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
