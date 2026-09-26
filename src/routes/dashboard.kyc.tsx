import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/kyc/page";

export const Route = createFileRoute("/dashboard/kyc")({
  head: () => ({
    meta: [
      { title: "Account Verification · ObPay" },
      { name: "description", content: "Submit identity or business documents for review." },
      { property: "og:title", content: "Account Verification · ObPay" },
      { property: "og:description", content: "Submit identity or business documents for review." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
