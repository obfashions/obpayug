import { Link } from "@/lib/router-compat";

const complianceAreas = [
  {
    icon: "ri-user-search-line",
    title: "Mandatory KYC Verification",
    desc: "Every merchant completes identity verification before processing a single transaction. We collect national ID, business registration, and physical address — all reviewed manually by our compliance team.",
  },
  {
    icon: "ri-alert-line",
    title: "AML Transaction Monitoring",
    desc: "Automated systems scan every transaction for suspicious patterns: unusual amounts, frequency anomalies, and rapid successive failures. Flagged transactions are escalated for human review within minutes.",
  },
  {
    icon: "ri-scales-3-line",
    title: "Risk-Based Controls",
    desc: "Configurable transaction limits, platform fee oversight, and maintenance-mode kill switches give us full control. High-risk activities are automatically throttled until verified.",
  },
  {
    icon: "ri-file-search-line",
    title: "Audit Trail & Record Keeping",
    desc: "Complete, immutable logs of every transaction, KYC approval, settings change, and admin action. Exportable reports available for regulatory audits at any time.",
  },
  {
    icon: "ri-government-line",
    title: "Regulatory Alignment",
    desc: "Our framework is designed in alignment with Bank of Uganda AML/CFT guidelines, East African financial regulations, and FATF recommendations for payment service providers.",
  },
  {
    icon: "ri-shield-user-line",
    title: "Fraud & Data Protection",
    desc: "AES-256 encryption, mandatory two-factor authentication on all merchant accounts, HMAC-signed webhooks, and AI-powered fraud detection protect every payment end-to-end.",
  },
];

const processSteps = [
  { step: "01", title: "Registration", desc: "Merchant signs up with email, phone, and business details" },
  { step: "02", title: "KYC Upload", desc: "National ID, business address, and company documents submitted" },
  { step: "03", title: "Manual Review", desc: "Compliance team verifies documents within 24-48 hours" },
  { step: "04", title: "Approval", desc: "Verified merchants receive API keys and can begin collecting payments" },
  { step: "05", title: "Ongoing Monitoring", desc: "All transactions monitored in real-time with automated AML checks" },
];

export default function ComplianceSection() {
  return (
    <section className="py-20 md:py-28 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-file-shield-2-line" />
              Compliance &amp; AML
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Built for <span className="text-primary-500">Regulatory Confidence</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              ObPay operates with a comprehensive compliance framework covering KYC, AML monitoring, risk management, and data protection. Every merchant and every transaction goes through our compliance pipeline.
            </p>
          </div>

          {/* Compliance Process Flow */}
          <div className="relative mb-16 md:mb-20">
            {/* Connecting line — desktop */}
            <div className="hidden lg:block absolute top-11 left-[10%] right-[10%] h-[2px] bg-background-200" />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
              {processSteps.map((step, i) => (
                <div key={step.step} className="relative text-center">
                  {/* Step number badge */}
                  <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-500 text-background-50 font-heading font-bold text-lg mb-4">
                    {step.step}
                  </div>
                  <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-1">
                    {step.title}
                  </h4>
                  <p className="text-xs text-foreground-600 leading-relaxed max-w-[180px] mx-auto">
                    {step.desc}
                  </p>
                  {/* Arrow for mobile/tablet */}
                  {i < processSteps.length - 1 && (
                    <div className="lg:hidden mt-3 flex justify-center">
                      <i className="ri-arrow-down-line text-foreground-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Compliance Areas Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-14">
            {complianceAreas.map((area) => (
              <div
                key={area.title}
                className="flex items-start gap-4 p-5 bg-background-50 rounded-xl border border-background-200/70 hover:border-primary-300/60 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                  <i className={`${area.icon} text-primary-600 text-lg`} />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-1">
                    {area.title}
                  </h3>
                  <p className="text-xs text-foreground-600 leading-relaxed">
                    {area.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Block */}
          <div className="relative overflow-hidden rounded-2xl bg-foreground-900 p-8 md:p-12 text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 via-accent-500/10 to-secondary-500/10" />
            <div className="relative z-10 max-w-2xl mx-auto">
              <h3 className="font-heading font-bold text-2xl md:text-3xl text-background-50 mb-3">
                Compliance documentation available on request
              </h3>
              <p className="text-sm md:text-base text-background-200 leading-relaxed mb-6">
                We provide our full compliance policy, AML procedures, data protection framework, and incident response plan to partners and regulators. Our team is always available to discuss specific requirements.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold text-sm px-6 py-3 rounded-lg transition-all whitespace-nowrap cursor-pointer"
                >
                  Become a Verified Merchant
                  <i className="ri-arrow-right-line" />
                </Link>
                <Link
                  to="/support"
                  className="inline-flex items-center justify-center gap-2 text-background-200 hover:text-background-50 font-medium text-sm px-6 py-3 transition-all whitespace-nowrap cursor-pointer"
                >
                  <i className="ri-mail-line" />
                  Contact Compliance Team
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}