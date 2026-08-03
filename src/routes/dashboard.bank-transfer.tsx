import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/bank-transfer/page";

export const Route = createFileRoute("/dashboard/bank-transfer")({
  head: () => ({
    meta: [
      { title: "Bank Transfer — ObPay" },
      { name: "description", content: "Send money from your ObPay wallet to any supported Ugandan bank account." },
      { property: "og:title", content: "Bank Transfer — ObPay" },
      { property: "og:description", content: "Send money from your ObPay wallet to any supported Ugandan bank account." },
    ],
  }),
  component: Page,
});
