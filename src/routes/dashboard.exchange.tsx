import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/exchange/page";

export const Route = createFileRoute("/dashboard/exchange")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Currency Exchange · ObPay" },
      { name: "description", content: "Live rates and balance conversion between UGX, KES, RWF, NGN, XOF, USD, ZMW, SLE, CDF and XAF on ObPay." },
      { property: "og:title", content: "Currency Exchange · ObPay" },
      { property: "og:description", content: "Live rates and balance conversion between UGX, KES, RWF, NGN, XOF, USD, ZMW, SLE, CDF and XAF on ObPay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
