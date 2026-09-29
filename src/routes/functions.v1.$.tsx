import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/api/ApiEndpointInfo";

export const Route = createFileRoute("/functions/v1/$")({
  head: () => ({ meta: [
    { title: "ObPay API Endpoint | ObPay (PawaPay Ptn)" },
    { name: "description", content: "Find the correct ObPay API endpoint for your integration." },
    { property: "og:title", content: "ObPay API Endpoint | ObPay (PawaPay Ptn)" },
    { property: "og:description", content: "Find the correct ObPay API endpoint for your integration." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});
