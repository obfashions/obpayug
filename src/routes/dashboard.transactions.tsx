import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/transactions/page";

export const Route = createFileRoute("/dashboard/transactions")({
  component: Page,
});
