import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/api-sandbox/page";

export const Route = createFileRoute("/dashboard/api-sandbox")({
  head: () => ({
    meta: [
      { title: "API Sandbox · ObPay" },
      { name: "description", content: "Try ObPay payment API requests." },
      { property: "og:title", content: "API Sandbox · ObPay" },
      { property: "og:description", content: "Try ObPay payment API requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
