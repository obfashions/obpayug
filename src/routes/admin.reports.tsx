import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/reports/page";

export const Route = createFileRoute("/admin/reports")({
  component: Page,
});
