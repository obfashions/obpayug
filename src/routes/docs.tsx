import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/docs/page";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "ObPay API Documentation" },
      { name: "description", content: "ObPay REST API for payments, airtime, data, utility bills, card collections, separate balances and verified transaction status." },
      { property: "og:title", content: "ObPay API Documentation" },
      { property: "og:description", content: "ObPay REST API for payments, airtime, data, utility bills, card collections, separate balances and verified transaction status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
