import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/marz-api/page";

export const Route = createFileRoute("/admin/marz-api")({
  component: Page,
  head: () => ({
    meta: [
      { title: "MarzPay API Keys · ObPay Admin" },
      { name: "description", content: "Update and verify the MarzPay credentials that process ObPay collections and payouts." },
      { property: "og:title", content: "MarzPay API Keys · ObPay Admin" },
      { property: "og:description", content: "Update and verify the MarzPay credentials that process ObPay collections and payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});
