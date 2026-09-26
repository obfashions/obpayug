import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/email-campaigns/page";

export const Route = createFileRoute("/admin/email-campaigns")({
  head: () => ({
    meta: [
      { title: "Email Campaigns · ObPay" },
      { name: "description", content: "Send notices and updates to registered merchants." },
      { property: "og:title", content: "Email Campaigns · ObPay" },
      { property: "og:description", content: "Send notices and updates to registered merchants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
