import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/settings/page";

export const Route = createFileRoute("/admin/settings")({
  component: Page,
});
