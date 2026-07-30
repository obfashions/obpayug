import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/transaction-lookup/page";

export const Route = createFileRoute("/admin/transaction-lookup")({
  component: Page,
});
