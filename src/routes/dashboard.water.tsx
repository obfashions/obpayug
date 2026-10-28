import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/bill-payments/page";
export const Route = createFileRoute("/dashboard/water")({
 head: () => ({ meta: [{ title: "Water — ObPay" }, { name: "description", content: "Water payments in Uganda with current prices and verified confirmation." }, { property: "og:title", content: "Water — ObPay" }, { property: "og:description", content: "Water payments in Uganda with current prices and verified confirmation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
 component: () => <Page initialUtility="NWSC"/>,
});
