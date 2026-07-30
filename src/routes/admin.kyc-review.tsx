import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/kyc-review/page";

export const Route = createFileRoute("/admin/kyc-review")({
  component: Page,
});
