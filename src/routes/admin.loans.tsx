import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/loans/page";

export const Route = createFileRoute("/admin/loans")({
  component: Page,
});
