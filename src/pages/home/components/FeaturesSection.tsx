import { useState } from "react";

const features = [
  {
    icon: "ri-download-cloud-line",
    title: "Collections",
    description: "Accept payments via mobile money and bank transfers. Funds settle directly to your merchant account with real-time notifications.",
    color: "bg-primary-100 text-primary-600",
  },
  {
    icon: "ri-upload-cloud-line",
    title: "Payouts",
    description: "Send money to supported mobile money wallets. Bank transfers are assisted by customer service with confirmed fees.",
    color: "bg-accent-100 text-accent-600",
  },
  {
    icon: "ri-link-m",
    title: "Payment Links",
    description: "Create and share payment links in seconds. No code required. Accept payments via WhatsApp, email, or social media.",
    color: "bg-secondary-100 text-secondary-600",
  },
  {
    icon: "ri-code-box-line",
    title: "Developer APIs",
    description: "Robust REST APIs with SDKs in PHP, Laravel, Node.js, Python, and JavaScript. Build custom payment experiences in minutes.",
    color: "bg-primary-100 text-primary-600",
  },
  {
    icon: "ri-webhook-line",
    title: "Webhooks",
    description: "Receive instant event notifications for every transaction. Configure retry logic and monitor webhook delivery status.",
    color: "bg-accent-100 text-accent-600",
  },
  {
    icon: "ri-bar-chart-box-line",
    title: "Analytics",
    description: "Comprehensive dashboards with transaction trends, revenue insights, customer behavior, and downloadable reports.",
    color: "bg-secondary-100 text-secondary-600",
  },
  {
    icon: "ri-shield-keyhole-line",
    title: "Security",
    description: "Bank-level encryption, PCI DSS compliance, two-factor authentication, and advanced fraud detection on every transaction.",
    color: "bg-primary-100 text-primary-600",
  },
  {
    icon: "ri-dashboard-3-line",
    title: "Merchant Dashboard",
    description: "A beautiful, intuitive dashboard to manage transactions, view balances, configure settings, and monitor business growth.",
    color: "bg-accent-100 text-accent-600",
  },
];

export default function FeaturesSection() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section id="features" className="py-20 md:py-28 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-100 text-accent-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-apps-line" />
              Platform Features
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Everything You Need to{" "}
              <span className="text-primary-500">Accept Payments</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              A complete payment infrastructure built for East African businesses. From collections to analytics, we have you covered.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className={`group relative p-5 md:p-6 rounded-xl border transition-all duration-300 cursor-default ${
                  hoveredIndex === index
                    ? "border-primary-300 bg-primary-50/50 shadow-lg shadow-primary-500/5"
                    : "border-background-200/70 bg-background-50 hover:border-background-300/60 hover:shadow-md"
                }`}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={`w-11 h-11 md:w-12 md:h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110`}
                >
                  <i className={`${feature.icon} text-xl md:text-2xl`} />
                </div>
                <h3 className="font-heading font-semibold text-base md:text-lg text-foreground-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-foreground-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}