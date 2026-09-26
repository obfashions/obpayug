import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/transactions/page";

export const Route = createFileRoute("/admin/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions · ObPay" },
      { name: "description", content: "Monitor ObPay merchant transactions." },
      { property: "og:title", content: "Transactions · ObPay" },
      { property: "og:description", content: "Monitor ObPay merchant transactions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
