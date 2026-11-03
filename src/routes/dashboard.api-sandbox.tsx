import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/api-sandbox/page";

export const Route = createFileRoute("/dashboard/api-sandbox")({
  head: () => ({
    meta: [
      { title: "Integration testing · ObPay" },
      { name: "description", content: "Simulate Uganda payment flows without moving money, or explicitly approve live ObPay API requests." },
      { property: "og:title", content: "Integration testing · ObPay" },
      { property: "og:description", content: "No-money simulation and approved live API testing for ObPay merchants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
