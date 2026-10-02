import { Link } from "@/lib/router-compat";
import { Book, CheckCircle2, ShieldAlert, Key } from "lucide-react";

interface MerchantGuidanceProps {
  kycStatus?: string;
  hasTransactions: boolean;
}

export default function MerchantGuidance({ kycStatus, hasTransactions }: MerchantGuidanceProps) {
  const steps = [
    {
      title: "Complete Verification",
      desc: "Submit your business documents to enable higher limits.",
      link: "/dashboard/kyc",
      icon: <ShieldAlert className="h-5 w-5 text-amber-500" />,
      done: kycStatus === "verified",
      action: "Verify Now"
    },
    {
      title: "Get API Keys",
      desc: "Generate your keys to start integrating ObPay into your site.",
      link: "/dashboard/api-keys",
      icon: <Key className="h-5 w-5 text-primary-500" />,
      done: false, // We'd need to check if keys exist
      action: "Get Keys"
    },
    {
      title: "View Documentation",
      desc: "Learn how to collect payments and send payouts.",
      link: "/docs",
      icon: <Book className="h-5 w-5 text-secondary-500" />,
      done: false,
      action: "Read Docs"
    }
  ];

  if (hasTransactions && kycStatus === "verified") return null;

  return (
    <div className="bg-background-50 rounded-3xl border border-background-200/70 p-5 mb-6">
      <h3 className="font-heading font-bold text-lg tracking-tight text-foreground-900 mb-4 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-xs">?</span>
        Getting started with ObPay
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div key={i} className="relative flex flex-col p-4 rounded-2xl bg-white border border-background-100 hover:border-primary-200 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 rounded-xl bg-background-50">
                {step.icon}
              </div>
              {step.done && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            </div>
            <h4 className="text-sm font-bold text-foreground-900 mb-1">{step.title}</h4>
            <p className="text-xs text-foreground-500 mb-4 flex-grow">{step.desc}</p>
            {!step.done && (
              <Link
                to={step.link}
                className="text-xs font-semibold text-primary-500 hover:text-primary-600 flex items-center gap-1"
              >
                {step.action} <i className="ri-arrow-right-s-line" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
