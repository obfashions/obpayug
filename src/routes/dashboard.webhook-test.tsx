import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/webhook-test/page";

export const Route = createFileRoute("/dashboard/webhook-test")({
  component: Page,
});
