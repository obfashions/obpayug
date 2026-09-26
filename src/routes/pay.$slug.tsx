import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/pay/page";

export const Route = createFileRoute("/pay/$slug")({
  head: () => ({
    meta: [
      { title: "Payment Checkout · ObPay" },
      { name: "description", content: "Complete a secure ObPay payment." },
      { property: "og:title", content: "Payment Checkout · ObPay" },
      { property: "og:description", content: "Complete a secure ObPay payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});
