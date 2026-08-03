import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/airtime-data/page";

export const Route = createFileRoute("/dashboard/airtime-data")({
  head: () => ({
    meta: [
      { title: "Airtime & Data — ObPay" },
      { name: "description", content: "Buy MTN, Airtel and Lyca airtime and data bundles directly from your ObPay wallet." },
      { property: "og:title", content: "Airtime & Data — ObPay" },
      { property: "og:description", content: "Buy MTN, Airtel and Lyca airtime and data bundles directly from your ObPay wallet." },
    ],
  }),
  component: Page,
});
