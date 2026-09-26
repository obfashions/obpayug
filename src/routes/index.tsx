import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/home/page";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ObPay (PawaPay Ptn) — Payment Gateway for East Africa" },
      { name: "description", content: "Collect payments, send payouts and integrate mobile money, bank transfers and payment links with one unified API." },
      { property: "og:title", content: "ObPay (PawaPay Ptn) — Payment Gateway for East Africa" },
      { property: "og:description", content: "Collect payments, send payouts and integrate mobile money, bank transfers and payment links with one unified API." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
