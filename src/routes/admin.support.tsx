import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/support/page";

export const Route = createFileRoute("/admin/support")({
  head: () => ({
    meta: [
      { title: "Support Chat · ObPay" },
      { name: "description", content: "Respond to merchant support conversations." },
      { property: "og:title", content: "Support Chat · ObPay" },
      { property: "og:description", content: "Respond to merchant support conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
