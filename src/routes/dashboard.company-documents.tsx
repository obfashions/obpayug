import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/company-documents/page";

export const Route = createFileRoute("/dashboard/company-documents")({
  component: Page,
});
