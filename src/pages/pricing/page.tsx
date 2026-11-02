import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { ArrowRight, Plus } from "lucide-react";
import type { PublicFees } from "@/lib/public-fees.server";

/** Currency codes the partner stores under an older code are shown as their redenominated label. */
const DISPLAY_CURRENCY: Record<string, string> = { SLL: "SLE" };

function currencyLabel(code: string) {
  return DISPLAY_CURRENCY[code] ?? code;
}

const serviceFees = [
  { name: "Collections", charge: "Network cost + ObPay collection fee", detail: "The verified network charge and the ObPay collection fee shown below are deducted once before the payment is credited to your wallet." },
  { name: "Payouts & withdrawals", charge: "Network quote + ObPay payout fee", detail: "The quote separates the network and ObPay charges. Your saved fee preference determines the recipient amount and the total wallet deduction." },
  { name: "Currency exchange", charge: "Exchange rate + ObPay exchange fee", detail: "The fee is deducted from what you receive. Review the destination amount and the fee before confirming. Exchanges are subject to available funds and account eligibility." },
  { name: "Bills, airtime & data", charge: "Service price + applicable charges", detail: "The total amount to be deducted is confirmed before submission. Available services and packages depend on the selected service." },
];

const questions = [
  { q: "Why does the charge vary by currency?", a: "Payment networks have different percentage charges, fee floors and transaction limits. The selected currency, network and amount determine the quote, and the ObPay fee is shown above per currency." },
  { q: "Who pays payout fees?", a: "In account mode, fees are charged in addition to your entered amount and the recipient receives the full entered amount. In submitted-amount mode, fees are deducted from the entered amount. Change your preference in account Settings." },
  { q: "Does an account exemption remove every charge?", a: "An ObPay fee exemption removes the applicable ObPay collection or payout fee shown above, not the payment network's own charge." },
  { q: "What happens if a payment is still pending?", a: "A pending payment is not a confirmed outcome. Check its status and reference before trying again. Contact support if you need help reconciling it." },
];

export default function PricingPage({ fees }: { fees?: PublicFees }) {
  const available = fees?.available && fees.currencies.length > 0;
  return <div className="min-h-screen bg-background"><Navbar /><main className="pt-[72px]">
    <header className="border-b border-border"><div className="mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-20"><p className="text-sm font-medium text-primary">ObPay pricing</p><h1 className="mt-4 text-4xl font-semibold md:text-5xl">Understand your payment charges.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground">Each payment has a network cost and, where applicable, an ObPay fee. The table below lists the current ObPay fee for every currency. Charges depend on your currency, payment method and account terms.</p><Button asChild className="mt-8"><Link to="/login">Review your account fees <ArrowRight /></Link></Button></div></header>
    {available ? (
      <section className="mx-auto max-w-7xl px-6 py-16 md:px-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><h2 className="text-2xl font-semibold">Current ObPay fees</h2><span className="text-sm text-muted-foreground">ObPay's own charges, per currency</span></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><th className="py-3 pr-4 font-medium">Currency</th><th className="py-3 pr-4 font-medium">Market</th><th className="py-3 pr-4 font-medium">Collection fee</th><th className="py-3 pr-4 font-medium">Payout fee</th><th className="py-3 font-medium">Exchange fee</th></tr></thead>
          <tbody>{fees!.currencies.map((row) => (
            <tr key={row.currency} className="border-b border-border last:border-0">
              <td className="py-4 pr-4 font-semibold">{currencyLabel(row.currency)}</td>
              <td className="py-4 pr-4 text-muted-foreground">{row.country}</td>
              <td className="py-4 pr-4">{row.legacyCollection ? "Included in network cost" : `${row.collectionPercent}%`} <span className="text-muted-foreground">+ network charge</span></td>
              <td className="py-4 pr-4">{row.payoutPercent}% <span className="text-muted-foreground">+ network charge</span></td>
              <td className="py-4">{fees!.exchangeFeePercent}%</td>
            </tr>
          ))}</tbody></table></div>
        <p className="mt-6 text-sm leading-6 text-muted-foreground">The collection and payout fees above are ObPay's own charges. The payment network also applies its own charge, which is quoted and confirmed before each transaction. Accounts with an ObPay fee exemption pay the network charge only. Whole-number currencies are UGX, KES, RWF, XOF, XAF, ZMW, CDF and SLE.</p>
      </section>
    ) : null}
    <section className={available ? "border-y border-border bg-muted/40" : "mx-auto max-w-7xl px-6 py-16 md:px-10"}><div className={available ? "mx-auto max-w-7xl px-6 py-16 md:px-10" : ""}><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><h2 className="text-2xl font-semibold">How charges are applied</h2><span className="text-sm text-muted-foreground">Account-specific terms and exemptions apply</span></div><div>{serviceFees.map(f=><article key={f.name} className="grid gap-4 border-t border-border py-8 md:grid-cols-[1fr_1.3fr_1.7fr]"><h3 className="font-semibold">{f.name}</h3><p className="text-sm font-medium text-primary">{f.charge}</p><p className="text-sm leading-7 text-muted-foreground">{f.detail}</p></article>)}</div><p className="border-t border-border pt-6 text-sm leading-6 text-muted-foreground">The applicable account settings and live network quote determine the final charge. Transaction records retain the fees applied at the time; later pricing changes do not alter completed payments.</p></div></section>
    <section className="border-y border-border bg-muted/40"><div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-2 md:px-10"><h2 className="text-3xl font-semibold">Before you confirm.</h2><div className="space-y-5">{["Check the currency and recipient details.","Review the recipient amount and all charges.","Confirm the total wallet deduction.","Keep the reference for reconciliation."].map((v,i)=><div key={v} className="flex gap-5 border-b border-border pb-5"><span className="font-mono text-sm text-muted-foreground">0{i+1}</span><p className="text-sm">{v}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-4xl px-6 py-16 md:px-10"><h2 className="mb-8 text-2xl font-semibold">Pricing questions</h2>{questions.map(f=><details key={f.q} className="group border-t border-border py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">{f.q}<Plus className="h-4 w-4 shrink-0 transition-transform group-open:rotate-45" /></summary><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{f.a}</p></details>)}<Link to="/support" className="mt-8 inline-flex items-center gap-3 text-sm font-medium text-primary">Ask about your account pricing <ArrowRight className="h-4 w-4" /></Link></section>
  </main><Footer /></div>;
}
