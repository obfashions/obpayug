import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/kyc/page";

export const Route = createFileRoute("/dashboard/kyc")({
  component: Page,
});
