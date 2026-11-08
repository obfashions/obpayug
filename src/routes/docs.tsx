import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/docs/page";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "Payments & Service API Documentation — ObPay" },
      { name: "description", content: "Integrate ObPay mobile money and hosted cards; review bank setup capabilities, saved accounts, verified payment status and fee safeguards." },
      { property: "og:title", content: "Payments & Service API Documentation — ObPay" },
      { property: "og:description", content: "Integrate ObPay mobile money and hosted cards; review bank setup capabilities, saved accounts, verified payment status and fee safeguards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
