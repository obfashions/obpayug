import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/login/page";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in to ObPay" },
      { name: "description", content: "Access your ObPay merchant dashboard to manage collections, payouts and API keys." },
      { property: "og:title", content: "Sign in to ObPay" },
      { property: "og:description", content: "Access your ObPay merchant dashboard to manage collections, payouts and API keys." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
