import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/payment-links/page";

export const Route = createFileRoute("/dashboard/payment-links")({
  component: Page,
});
