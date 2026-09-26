import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/company-documents/page";

export const Route = createFileRoute("/admin/company-documents")({
  head: () => ({
    meta: [
      { title: "Company Documents · ObPay" },
      { name: "description", content: "Manage ObPay company documents." },
      { property: "og:title", content: "Company Documents · ObPay" },
      { property: "og:description", content: "Manage ObPay company documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
