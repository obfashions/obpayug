import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/bank-transfer/page";

export const Route = createFileRoute("/dashboard/bank-transfer")({
  head: () => ({
    meta: [
      { title: "Bank Payments — ObPay" },
      { name: "description", content: "Manage saved bank details, review bank-payment setup and access historical records in ObPay." },
      { property: "og:title", content: "Bank Payments — ObPay" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:description", content: "Manage saved bank details, review bank-payment setup and access historical records in ObPay." },
    ],
  }),
  component: Page,
});
