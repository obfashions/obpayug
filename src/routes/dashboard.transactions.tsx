import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/transactions/page";

export const Route = createFileRoute("/dashboard/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · ObPay" },
      { name: "description", content: "View your ObPay payment history." },
      { property: "og:title", content: "Transactions · ObPay" },
      { property: "og:description", content: "View your ObPay payment history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
