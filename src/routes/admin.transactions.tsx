import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/transactions/page";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({
    meta: [
      { title: "Merchant Transactions · ObPay Admin" },
      { name: "description", content: "Monitor ObPay merchant transactions." },
      { property: "og:title", content: "Merchant Transactions · ObPay Admin" },
      { property: "og:description", content: "Monitor ObPay merchant transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
