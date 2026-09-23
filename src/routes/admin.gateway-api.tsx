import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/gateway-api/page";

export const Route = createFileRoute("/admin/gateway-api")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Gateway API Keys · ObPay Admin" },
      { name: "description", content: "Update and verify the banking credentials that process ObPay collections and payouts." },
      { property: "og:title", content: "Gateway API Keys · ObPay Admin" },
      { property: "og:description", content: "Update and verify the banking credentials that process ObPay collections and payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
