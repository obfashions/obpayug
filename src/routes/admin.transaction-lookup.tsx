import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/transaction-lookup/page";

export const Route = createFileRoute("/admin/transaction-lookup")({
  head: () => ({
    meta: [
      { title: "Transaction Lookup · ObPay" },
      { name: "description", content: "Find and review payment references." },
      { property: "og:title", content: "Transaction Lookup · ObPay" },
      { property: "og:description", content: "Find and review payment references." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
