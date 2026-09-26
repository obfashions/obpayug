import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/settings/page";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings · ObPay" },
      { name: "description", content: "Manage your ObPay account preferences." },
      { property: "og:title", content: "Settings · ObPay" },
      { property: "og:description", content: "Manage your ObPay account preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
