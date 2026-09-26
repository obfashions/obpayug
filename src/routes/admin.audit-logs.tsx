import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/audit-logs/page";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit Logs · ObPay" },
      { name: "description", content: "Review administrator and merchant account activity." },
      { property: "og:title", content: "Audit Logs · ObPay" },
      { property: "og:description", content: "Review administrator and merchant account activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
