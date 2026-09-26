import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/company-documents/page";

export const Route = createFileRoute("/dashboard/company-documents")({
  head: () => ({
    meta: [
      { title: "Company Documents · ObPay" },
      { name: "description", content: "View your ObPay account documents." },
      { property: "og:title", content: "Company Documents · ObPay" },
      { property: "og:description", content: "View your ObPay account documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
