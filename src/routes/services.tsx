import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/services/page";
export const Route = createFileRoute("/services")({
  head: () => ({ meta: [{ title: "ObPay Services — ObPay" }, { name: "description", content: "Uganda airtime, data, electricity, water, TV and card payments; customer-service assisted bank transfers." }, { property: "og:title", content: "ObPay Services — ObPay" }, { property: "og:description", content: "Uganda airtime, data, electricity, water, TV and card payments; customer-service assisted bank transfers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
