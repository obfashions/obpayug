import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/email-campaigns/page";

export const Route = createFileRoute("/admin/email-campaigns")({
  component: Page,
});
