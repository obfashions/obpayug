import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/page";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({
    meta: [
      { title: "Dashboard · ObPay" },
      { name: "description", content: "Review balances and recent account activity." },
      { property: "og:title", content: "Dashboard · ObPay" },
      { property: "og:description", content: "Review balances and recent account activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
