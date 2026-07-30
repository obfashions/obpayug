import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/api-monitoring/page";

export const Route = createFileRoute("/admin/api-monitoring")({
  component: Page,
});
