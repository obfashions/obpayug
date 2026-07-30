import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/page";

export const Route = createFileRoute("/admin/")({
  component: Page,
});
