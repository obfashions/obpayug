import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/api/ApiEndpointInfo";

export const Route = createFileRoute("/functions/v1/$")({
  component: Page,
});
