import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/airtime-data/page";
export const Route = createFileRoute("/dashboard/data")({
 head: () => ({ meta: [{ title: "Data Bundles — ObPay" }, { name: "description", content: "Data Bundles payments in Uganda with current prices and verified confirmation." }, { property: "og:title", content: "Data Bundles — ObPay" }, { property: "og:description", content: "Data Bundles payments in Uganda with current prices and verified confirmation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
 component: () => <Page initialMode="bundle"/>,
});
