import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/docs/page";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "ObPay API Documentation" },
      { name: "description", content: "REST API reference and integration guides for collections, payouts, balances and webhooks." },
      { property: "og:title", content: "ObPay API Documentation" },
      { property: "og:description", content: "REST API reference and integration guides for collections, payouts, balances and webhooks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
