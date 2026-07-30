import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/loans/page";

export const Route = createFileRoute("/dashboard/loans")({
  component: Page,
});
