import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/cards/page";
export const Route = createFileRoute("/dashboard/cards")({
  head: () => ({ meta: [{ title: "Card Payments — ObPay" }, { name: "description", content: "Accept card payments in UGX, view restricted card proceeds and confirmed payment history." }, { property: "og:title", content: "Card Payments — ObPay" }, { property: "og:description", content: "Accept card payments in UGX, view restricted card proceeds and confirmed payment history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
