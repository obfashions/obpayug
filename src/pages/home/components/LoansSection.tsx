import { Link } from "@/lib/router-compat";

const loanProducts = [
  {
    icon: "ri-briefcase-4-line",
    title: "Business Growth Loan",
    amount: "UGX 1M - 50M",
    rate: "From 12% per annum",
    term: "3 - 24 months",
    desc: "Expand your inventory, open a new location, or invest in equipment. Designed for established businesses processing payments through ObPay.",
    color: "bg-primary-100 text-primary-600",
  },
  {
    icon: "ri-smartphone-line",
    title: "Working Capital Loan",
    amount: "UGX 500K - 20M",
    rate: "From 10% per annum",
    term: "1 - 12 months",
    desc: "Bridge cash flow gaps between payables and receivables. Get quick access to funds based on your ObPay transaction history.",
    color: "bg-accent-100 text-accent-600",
  },
  {
    icon: "ri-store-2-line",
    title: "Merchant Advance",
    amount: "UGX 200K - 10M",
    rate: "From 8% per annum",
    term: "1 - 6 months",
    desc: "Instant advances based on your daily transaction volume. Repay automatically from a percentage of your incoming payments.",
    color: "bg-secondary-100 text-secondary-600",
  },
  {
    icon: "ri-building-4-line",
    title: "Enterprise Loan",
    amount: "UGX 50M - 500M",
    rate: "Custom rates",
    term: "6 - 60 months",
    desc: "Large-scale financing for established enterprises. Custom repayment structures, dedicated account manager, and priority processing.",
    color: "bg-primary-100 text-primary-600",
  },
];

export default function LoansSection() {
  return (
    <section id="loans" className="py-20 md:py-28 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-funds-line" />
              Business Financing
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Grow Your Business with{" "}
              <span className="text-primary-500">ObPay Loans</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              Access fast, flexible business financing based on your transaction history. No collateral required for qualified merchants. Apply in minutes, receive funds in hours.
            </p>
          </div>

          {/* Loan Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-12">
            {loanProducts.map((loan) => (
              <div
                key={loan.title}
                className="group bg-background-50 rounded-xl p-5 md:p-6 border border-background-200/70 hover:border-primary-300 hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-11 h-11 md:w-12 md:h-12 rounded-lg ${loan.color} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}>
                  <i className={`${loan.icon} text-xl md:text-2xl`} />
                </div>
                <h3 className="font-heading font-semibold text-base md:text-lg text-foreground-900 mb-1">
                  {loan.title}
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-bold text-primary-500">{loan.amount}</span>
                </div>
                <div className="space-y-1.5 mb-3 text-xs text-foreground-600">
                  <div className="flex items-center gap-1.5">
                    <i className="ri-percent-line text-foreground-400" />
                    <span>{loan.rate}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <i className="ri-calendar-line text-foreground-400" />
                    <span>{loan.term}</span>
                  </div>
                </div>
                <p className="text-sm text-foreground-600 leading-relaxed">
                  {loan.desc}
                </p>
              </div>
            ))}
          </div>

          {/* How It Works */}
          <div className="bg-background-100 rounded-2xl p-6 md:p-10 border border-background-200/70">
            <h3 className="font-heading font-semibold text-xl text-foreground-900 text-center mb-8">
              How ObPay Loans Work
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: "01",
                  title: "Check Eligibility",
                  desc: "Login to your ObPay dashboard and visit the Loans section. Your eligibility is automatically calculated based on your transaction volume and history.",
                  icon: "ri-check-double-line",
                },
                {
                  step: "02",
                  title: "Apply in Minutes",
                  desc: "Select your loan product, enter the amount, and submit. No paperwork — we use your ObPay transaction data for instant assessment.",
                  icon: "ri-file-text-line",
                },
                {
                  step: "03",
                  title: "Receive Funds",
                  desc: "Once approved, funds are credited directly to your ObPay wallet or bank account within hours. Repayment is automated from your daily collections.",
                  icon: "ri-bank-card-line",
                },
              ].map((item) => (
                <div key={item.step} className="text-center group">
                  <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-200 transition-colors">
                    <i className={`${item.icon} text-primary-600 text-xl`} />
                  </div>
                  <span className="inline-block text-xs font-bold text-primary-500 bg-primary-50 px-2.5 py-1 rounded-full mb-2">
                    Step {item.step}
                  </span>
                  <h4 className="font-heading font-semibold text-foreground-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-foreground-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-10">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-7 py-3.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-funds-line" />
              Apply for a Business Loan
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}