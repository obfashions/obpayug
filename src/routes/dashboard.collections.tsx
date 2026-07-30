import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/collections/page";

export const Route = createFileRoute("/dashboard/collections")({
  component: Page,
});
