import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/company-documents/page";

export const Route = createFileRoute("/admin/company-documents")({
  component: Page,
});
