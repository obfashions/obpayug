import { Link } from "@/lib/router-compat";

const actions = [
  {
    icon: "ri-bank-card-line",
    title: "I want to Accept Payments",
    desc: "Mobile money & bank transfers",
    link: "/register",
    color: "bg-primary-100 text-primary-600",
  },
  {
    icon: "ri-hand-coin-line",
    title: "I need a Business Loan",
    desc: "Up to UGX 500M, same-day approval",
    link: "/register",
    color: "bg-accent-100 text-accent-600",
  },
  {
    icon: "ri-send-plane-line",
    title: "I want to Send Payouts",
    desc: "Bulk staff & supplier payments",
    link: "/register",
    color: "bg-secondary-100 text-secondary-600",
  },
  {
    icon: "ri-code-s-slash-line",
    title: "I need API Integration",
    desc: "REST APIs with SDKs & webhooks",
    link: "/docs",
    color: "bg-primary-100 text-primary-600",
  },
];

export default function QuickActionsSection() {
  return (
    <section className="relative z-10 -mt-8 md:-mt-12 px-4 md:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {actions.map((action) => (
            <Link
              key={action.title}
              to={action.link}
              className="group flex items-center gap-4 bg-background-50 rounded-xl p-4 md:p-5 border border-background-200/70 hover:border-primary-300/60 hover:shadow-lg hover:shadow-foreground-900/5 transition-all duration-300 cursor-pointer"
            >
              <div
                className={`w-11 h-11 md:w-12 md:h-12 rounded-lg ${action.color} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}
              >
                <i className={`${action.icon} text-xl`} />
              </div>
              <div className="min-w-0">
                <p className="font-heading font-semibold text-sm md:text-base text-foreground-900 whitespace-nowrap">
                  {action.title}
                </p>
                <p className="text-xs text-foreground-500 mt-0.5">
                  {action.desc}
                </p>
              </div>
              <i className="ri-arrow-right-s-line text-foreground-400 ml-auto shrink-0 text-lg group-hover:text-primary-500 transition-colors" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}