import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/home/page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mobile Money Payment Gateway Uganda | MTN & Airtel API — ObPay" },
      { name: "description", content: "Accept MTN Mobile Money and Airtel Money in Uganda, Kenya, Rwanda and more with payment links or one REST API. 2% fee plus network charge, separate wallets per currency." },
      { property: "og:title", content: "Mobile Money Payment Gateway Uganda | MTN & Airtel API — ObPay" },
      { property: "og:description", content: "Accept MTN Mobile Money and Airtel Money in Uganda, Kenya, Rwanda and more with payment links or one REST API. 2% fee plus network charge, separate wallets per currency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
