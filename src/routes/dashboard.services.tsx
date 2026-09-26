import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/services/page";

export const Route = createFileRoute("/dashboard/services")({
  head: () => ({
    meta: [
      { title: "Services — ObPay" },
      { name: "description", content: "All ObPay services: collections, payouts, bank transfers, bill payments, airtime and data." },
      { property: "og:title", content: "Services — ObPay" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "All ObPay services: collections, payouts, bank transfers, bill payments, airtime and data." },
    ],
  }),
  component: Page,
});
