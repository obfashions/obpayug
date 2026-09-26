import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/merchants/page";

export const Route = createFileRoute("/admin/merchants")({
  head: () => ({
    meta: [
      { title: "Merchant Accounts · ObPay" },
      { name: "description", content: "Review and manage merchant accounts and balances." },
      { property: "og:title", content: "Merchant Accounts · ObPay" },
      { property: "og:description", content: "Review and manage merchant accounts and balances." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
