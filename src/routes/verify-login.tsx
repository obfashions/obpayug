import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/verify-login/page";

export const Route = createFileRoute("/verify-login")({
  head: () => ({
    meta: [
      { title: "Verify your login — ObPay" },
      { name: "description", content: "Enter the verification code sent to you to finish signing in to ObPay." },
      { property: "og:title", content: "Verify your login — ObPay" },
      { property: "og:description", content: "Enter the verification code sent to you to finish signing in to ObPay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
