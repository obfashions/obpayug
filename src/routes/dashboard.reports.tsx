import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/reports/page";

export const Route = createFileRoute("/dashboard/reports")({
  component: Page,
});
