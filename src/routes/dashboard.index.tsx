import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/page";

export const Route = createFileRoute("/dashboard/")({
  component: Page,
});
