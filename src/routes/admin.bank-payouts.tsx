import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/admin/bank-payouts/page";
export const Route = createFileRoute("/admin/bank-payouts")({
  head: () => ({ meta: [{ title: "Bank Withdrawals Admin — ObPay" }, { name: "description", content: "Process merchant bank withdrawal requests and record transfer references." }, { property: "og:title", content: "Bank Withdrawals Admin — ObPay" }, { property: "og:description", content: "Process merchant bank withdrawal requests and record transfer references." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});
