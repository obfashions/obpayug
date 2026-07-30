import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/merchants/page";

export const Route = createFileRoute("/admin/merchants")({
  component: Page,
});
