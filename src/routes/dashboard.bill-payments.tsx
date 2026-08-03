import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/dashboard/bill-payments/page";

export const Route = createFileRoute("/dashboard/bill-payments")({
  head: () => ({
    meta: [
      { title: "Bill Payments — ObPay" },
      { name: "description", content: "Pay LIGHT/UMEME electricity, NWSC water, DSTV and GOTV bills from your ObPay wallet." },
      { property: "og:title", content: "Bill Payments — ObPay" },
      { property: "og:description", content: "Pay LIGHT/UMEME electricity, NWSC water, DSTV and GOTV bills from your ObPay wallet." },
    ],
  }),
  component: Page,
});
