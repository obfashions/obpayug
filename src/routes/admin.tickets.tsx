import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/tickets/page";

export const Route = createFileRoute("/admin/tickets")({
  component: Page,
});
