import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/settings/page";

export const Route = createFileRoute("/dashboard/settings")({
  component: Page,
});
