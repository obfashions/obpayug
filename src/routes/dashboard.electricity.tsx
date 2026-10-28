import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/bill-payments/page";
export const Route = createFileRoute("/dashboard/electricity")({
 head: () => ({ meta: [{ title: "Electricity — ObPay" }, { name: "description", content: "Electricity payments in Uganda with current prices and verified confirmation." }, { property: "og:title", content: "Electricity — ObPay" }, { property: "og:description", content: "Electricity payments in Uganda with current prices and verified confirmation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
 component: () => <Page initialUtility="LIGHT"/>,
});
