import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/business/page";
export const Route = createFileRoute("/dashboard/business")({
  head: () => ({ meta: [
    { title: "Business Account & Statements · ObPay" },
    { name: "description", content: "Business verification details and currency-separated monthly statements for your ObPay account." },
    { property: "og:title", content: "Business Account & Statements · ObPay" },
    { property: "og:description", content: "Manage verified business details and monthly payment statements." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Page,
});