import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/tickets/page";

export const Route = createFileRoute("/admin/tickets")({
  head: () => ({
    meta: [
      { title: "Support Tickets · ObPay" },
      { name: "description", content: "Manage merchant support tickets." },
      { property: "og:title", content: "Support Tickets · ObPay" },
      { property: "og:description", content: "Manage merchant support tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
