import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/refunds/page";

export const Route = createFileRoute("/dashboard/refunds")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Refunds · ObPay" },
      { name: "description", content: "Send money back to customers for successful ObPay payments." },
      { property: "og:title", content: "Refunds · ObPay" },
      { property: "og:description", content: "Send money back to customers for successful ObPay payments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
