import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/api-keys/page";

export const Route = createFileRoute("/dashboard/api-keys")({
  head: () => ({
    meta: [
      { title: "API Keys · ObPay" },
      { name: "description", content: "Manage your ObPay integration keys." },
      { property: "og:title", content: "API Keys · ObPay" },
      { property: "og:description", content: "Manage your ObPay integration keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
