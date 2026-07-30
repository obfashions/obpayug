import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/transactions/page";

export const Route = createFileRoute("/admin/transactions")({
  component: Page,
});
