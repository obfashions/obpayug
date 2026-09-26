import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/reports/page";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Reports · ObPay" },
      { name: "description", content: "Review ObPay account and transaction reports." },
      { property: "og:title", content: "Reports · ObPay" },
      { property: "og:description", content: "Review ObPay account and transaction reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
