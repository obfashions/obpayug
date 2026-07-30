import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/api-sandbox/page";

export const Route = createFileRoute("/dashboard/api-sandbox")({
  component: Page,
});
