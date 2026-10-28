import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/airtime-data/page";
export const Route = createFileRoute("/dashboard/airtime")({
 head: () => ({ meta: [{ title: "Airtime — ObPay" }, { name: "description", content: "Airtime payments in Uganda with current prices and verified confirmation." }, { property: "og:title", content: "Airtime — ObPay" }, { property: "og:description", content: "Airtime payments in Uganda with current prices and verified confirmation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
 component: () => <Page initialMode="airtime"/>,
});
