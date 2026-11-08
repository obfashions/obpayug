import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/cards/page";
export const Route = createFileRoute("/dashboard/cards")({
  head: () => ({ meta: [{ title: "Card Payments — ObPay" }, { name: "description", content: "Create hosted card checkout in USD, KES and NGN and track verified same-currency proceeds." }, { property: "og:title", content: "Card Payments — ObPay" }, { property: "og:description", content: "Create hosted card checkout in USD, KES and NGN and track verified same-currency proceeds." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
