import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/api-monitoring/page";

export const Route = createFileRoute("/admin/api-monitoring")({
  head: () => ({
    meta: [
      { title: "API Monitoring · ObPay" },
      { name: "description", content: "Review merchant API requests and delivery activity." },
      { property: "og:title", content: "API Monitoring · ObPay" },
      { property: "og:description", content: "Review merchant API requests and delivery activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
