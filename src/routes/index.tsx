import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/home/page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ObPay — International Payments & Currency Wallets" },
      { name: "description", content: "ObPay international payments and currency wallets, plus Uganda airtime, data, bills and card collections. Bank transfers are customer-service assisted." },
      { property: "og:title", content: "ObPay — International Payments & Currency Wallets" },
      { property: "og:description", content: "ObPay international payments and currency wallets, plus Uganda airtime, data, bills and card collections. Bank transfers are customer-service assisted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
