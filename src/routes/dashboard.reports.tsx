import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/reports/page";

export const Route = createFileRoute("/dashboard/reports")({
  head: () => ({
    meta: [
      { title: "Reports · ObPay" },
      { name: "description", content: "Review your ObPay payments and account activity." },
      { property: "og:title", content: "Reports · ObPay" },
      { property: "og:description", content: "Review your ObPay payments and account activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
