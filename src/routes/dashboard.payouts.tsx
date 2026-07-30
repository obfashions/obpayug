import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/payouts/page";

export const Route = createFileRoute("/dashboard/payouts")({
  component: Page,
});
