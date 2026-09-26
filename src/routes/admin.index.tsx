import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/page";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard · ObPay" },
      { name: "description", content: "Monitor ObPay merchant and payment activity." },
      { property: "og:title", content: "Admin Dashboard · ObPay" },
      { property: "og:description", content: "Monitor ObPay merchant and payment activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
