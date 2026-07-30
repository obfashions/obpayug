import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/payout-requests/page";

export const Route = createFileRoute("/admin/payout-requests")({
  component: Page,
});
