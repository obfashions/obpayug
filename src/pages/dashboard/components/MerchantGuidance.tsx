import { Link } from "@/lib/router-compat";
import { ArrowDownToLine, BookOpen, KeyRound, ShieldCheck } from "lucide-react";

export default function MerchantGuidance() {
  const steps = [
    {
      title: "Verify account",
      desc: "Submit your identity or business documents for review.",
      link: "/dashboard/kyc",
      icon: <ShieldCheck className="h-5 w-5 text-primary-600" />,
      action: "Open verification"
    },
    {
      title: "Receive money",
      desc: "Request a mobile money payment or share a payment link.",
      link: "/dashboard/collections",
      icon: <ArrowDownToLine className="h-5 w-5 text-accent-600" />,
      action: "Collect payment"
    },
    {
      title: "Connect your website",
      desc: "Create a secret key, test safely, then follow the API guide.",
      link: "/dashboard/api-keys",
      icon: <KeyRound className="h-5 w-5 text-secondary-600" />,
      action: "Create API key"
    },
    {
      title: "Track every payment",
      desc: "Wait for confirmation and wallet credit before delivering an order.",
      link: "/dashboard/transactions",
      icon: <BookOpen className="h-5 w-5 text-emerald-600" />,
      action: "View transactions"
    }
  ];

  return (
    <div className="bg-background-50 rounded-3xl border border-background-200/70 p-5 mb-6">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase text-primary-700">Account guide</p>
        <h3 className="mt-1 font-heading font-bold text-lg tracking-tight text-foreground-900">How to operate ObPay</h3>
        <p className="mt-1 text-sm text-foreground-600">Use these steps in order. A payment is complete only after its status is confirmed and the correct currency wallet is credited.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {steps.map((step, i) => (
          <div key={step.title} className="relative flex flex-col p-4 rounded-2xl bg-background-100 border border-background-200 hover:border-primary-300 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-xl bg-background-50">
                {step.icon}
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">{i + 1}</span>
            </div>
            <h4 className="text-sm font-bold text-foreground-900 mb-1">{step.title}</h4>
            <p className="text-xs text-foreground-500 mb-4 flex-grow">{step.desc}</p>
            <Link to={step.link} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
              {step.action} <i className="ri-arrow-right-s-line" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
