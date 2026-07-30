import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/register/page";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your ObPay merchant account" },
      { name: "description", content: "Sign up in minutes and start collecting mobile money and bank payments across East Africa." },
      { property: "og:title", content: "Create your ObPay merchant account" },
      { property: "og:description", content: "Sign up in minutes and start collecting mobile money and bank payments across East Africa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
