import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/refunds/page";

export const Route = createFileRoute("/admin/refunds")({
  head: () => ({
    meta: [
      { title: "Refunds · ObPay Admin" },
      { name: "description", content: "Return money to senders after a fraud review." },
      { property: "og:title", content: "Refunds · ObPay Admin" },
      { property: "og:description", content: "Return money to senders after a fraud review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
