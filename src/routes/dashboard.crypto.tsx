import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/crypto/page";

export const Route = createFileRoute("/dashboard/crypto")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Crypto Payments · ObPay" },
      { name: "description", content: "Accept crypto payments and track your USD balance on ObPay." },
      { property: "og:title", content: "Crypto Payments · ObPay" },
      { property: "og:description", content: "Accept crypto payments and track your USD balance on ObPay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
