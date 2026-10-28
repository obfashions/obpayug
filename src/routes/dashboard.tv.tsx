import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/bill-payments/page";
export const Route = createFileRoute("/dashboard/tv")({
 head: () => ({ meta: [{ title: "TV Subscriptions — ObPay" }, { name: "description", content: "TV Subscriptions payments in Uganda with current prices and verified confirmation." }, { property: "og:title", content: "TV Subscriptions — ObPay" }, { property: "og:description", content: "TV Subscriptions payments in Uganda with current prices and verified confirmation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
 component: () => <Page initialUtility="DSTV"/>,
});
