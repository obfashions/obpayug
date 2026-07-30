import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/api-keys/page";

export const Route = createFileRoute("/dashboard/api-keys")({
  component: Page,
});
