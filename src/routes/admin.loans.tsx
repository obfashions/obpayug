import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/loans/page";

export const Route = createFileRoute("/admin/loans")({
  head: () => ({
    meta: [
      { title: "Loans · ObPay" },
      { name: "description", content: "Review loan records and requests." },
      { property: "og:title", content: "Loans · ObPay" },
      { property: "og:description", content: "Review loan records and requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
