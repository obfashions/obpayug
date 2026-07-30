import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/pay/page";

export const Route = createFileRoute("/pay/$slug")({
  component: Page,
});
