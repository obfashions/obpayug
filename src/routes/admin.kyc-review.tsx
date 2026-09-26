import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/kyc-review/page";

export const Route = createFileRoute("/admin/kyc-review")({
  head: () => ({
    meta: [
      { title: "Verification Review · ObPay" },
      { name: "description", content: "Review merchant identity and business documents." },
      { property: "og:title", content: "Verification Review · ObPay" },
      { property: "og:description", content: "Review merchant identity and business documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
