import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/privacy/page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | ObPay" },
      { name: "description", content: "How ObPay handles account, identity and payment information, with contact details for privacy requests in Uganda." },
      { property: "og:title", content: "Privacy Policy | ObPay" },
      { property: "og:description", content: "Read how ObPay uses information and how to make a privacy request." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});