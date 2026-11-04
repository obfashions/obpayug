import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/pricing/page";
import { getPublicFees } from "@/lib/public-fees.server";

export const Route = createFileRoute("/pricing")({
  loader: () => getPublicFees(),
  head: () => ({
    meta: [
      { title: "Mobile Money Payment Gateway Fees Uganda — ObPay Pricing" },
      { name: "description", content: "ObPay fees per currency: 2% to collect and 2% to pay out mobile money, plus the network charge. 1.5% currency exchange. Rates shown live for every currency." },
      { property: "og:title", content: "Mobile Money Payment Gateway Fees Uganda — ObPay Pricing" },
      { property: "og:description", content: "ObPay fees per currency: 2% to collect and 2% to pay out mobile money, plus the network charge. 1.5% currency exchange. Rates shown live for every currency." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: function PricingRoute() {
    const fees = Route.useLoaderData();
    return <Page fees={fees} />;
  },
});
