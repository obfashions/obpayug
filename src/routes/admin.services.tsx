import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/services/page";
export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: "Additional Services Admin — ObPay" }, { name: "description", content: "Admin service connection, subscriptions and separate provider float monitoring." }, { property: "og:title", content: "Additional Services Admin — ObPay" }, { property: "og:description", content: "Admin service connection, subscriptions and separate provider float monitoring." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
