import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/verify-email/page";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { next?: string; email?: string; userId?: string } => ({ next: typeof search.next === "string" ? search.next : undefined, email: typeof search.email === "string" ? search.email : undefined, userId: typeof search.userId === "string" ? search.userId : undefined }),
  head: () => ({
    meta: [
      { title: "Verify your email — ObPay" },
      { name: "description", content: "Confirm your email address to activate your ObPay merchant account." },
      { property: "og:title", content: "Verify your email — ObPay" },
      { property: "og:description", content: "Confirm your email address to activate your ObPay merchant account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
