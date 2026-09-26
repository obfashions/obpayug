import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/reset-password/page";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — ObPay" },
      { name: "description", content: "Set a new password for your ObPay merchant account." },
      { property: "og:title", content: "Set a new password — ObPay" },
      { property: "og:description", content: "Set a new password for your ObPay merchant account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});