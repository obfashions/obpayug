import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/settings/page";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Admin Settings · ObPay" },
      { name: "description", content: "Manage ObPay platform settings." },
      { property: "og:title", content: "Admin Settings · ObPay" },
      { property: "og:description", content: "Manage ObPay platform settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
