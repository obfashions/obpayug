import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/support/page";

export const Route = createFileRoute("/admin/support")({
  component: Page,
});
