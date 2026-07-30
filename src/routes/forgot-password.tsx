import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/forgot-password/page";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your ObPay password" },
      { name: "description", content: "Request a secure password reset link for your ObPay merchant account." },
      { property: "og:title", content: "Reset your ObPay password" },
      { property: "og:description", content: "Request a secure password reset link for your ObPay merchant account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
