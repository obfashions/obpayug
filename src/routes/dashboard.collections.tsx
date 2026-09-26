import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/collections/page";

export const Route = createFileRoute("/dashboard/collections")({
  head: () => ({
    meta: [
      { title: "Collections · ObPay" },
      { name: "description", content: "Collect mobile money payments in your ObPay account." },
      { property: "og:title", content: "Collections · ObPay" },
      { property: "og:description", content: "Collect mobile money payments in your ObPay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
