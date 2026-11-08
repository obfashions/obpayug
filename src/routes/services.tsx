import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/services/page";
export const Route = createFileRoute("/services")({
  head: () => ({ meta: [{ title: "Card & Mobile Money Payment Services — ObPay" }, { name: "description", content: "Accept hosted card payments in USD, KES and NGN alongside international mobile-money collections." }, { property: "og:title", content: "Card & Mobile Money Payment Services — ObPay" }, { property: "og:description", content: "Accept hosted card payments in USD, KES and NGN alongside international mobile-money collections." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
