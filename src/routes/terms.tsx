import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/terms/page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | ObPay" },
      { name: "description", content: "ObPay account and payment terms, fees, transaction disputes and contact details in Fort Portal, Uganda." },
      { property: "og:title", content: "Terms of Service | ObPay" },
      { property: "og:description", content: "Read the terms for ObPay accounts and payment services, including fees and complaints." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});