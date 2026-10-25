import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/home/page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ObPay — International Payments & Currency Wallets" },
      { name: "description", content: "ObPay operates internationally. Explore supported countries, local payment methods and ten separate currency wallets." },
      { property: "og:title", content: "ObPay — International Payments & Currency Wallets" },
      { property: "og:description", content: "ObPay operates internationally. Explore supported countries, local payment methods and ten separate currency wallets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
