import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/service-history/page";
export const Route = createFileRoute("/dashboard/service-history")({
  head: () => ({ meta: [{ title: "Service History — ObPay" }, { name: "description", content: "Track bill, airtime, data and card payments with verified outcomes and fees." }, { property: "og:title", content: "Service History — ObPay" }, { property: "og:description", content: "Track bill, airtime, data and card payments with verified outcomes and fees." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
