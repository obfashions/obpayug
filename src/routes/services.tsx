import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/services/page";
export const Route = createFileRoute("/services")({
  head: () => ({ meta: [{ title: "Airtime, Data & Bill Payments API Uganda — ObPay" }, { name: "description", content: "Sell airtime and data and pay electricity, water and TV bills in Uganda from your ObPay account or API." }, { property: "og:title", content: "Airtime, Data & Bill Payments API Uganda — ObPay" }, { property: "og:description", content: "Sell airtime and data and pay electricity, water and TV bills in Uganda from your ObPay account or API." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
