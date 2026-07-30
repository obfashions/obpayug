import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/webhooks/page";

export const Route = createFileRoute("/dashboard/webhooks")({
  component: Page,
});
