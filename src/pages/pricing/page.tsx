import { useState, useEffect } from "react";
import { Link } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";

export default function PricingPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("obpay-theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("obpay-theme", newTheme);
  };

  return (
    <div className="min-h-screen bg-background-50">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "ObPay Pricing & Fees - Transparent East African Payment Platform",
          description: "ObPay charges tiered fees on payouts and withdrawals: a flat 2,000 UGX for amounts 500–70,000 UGX, and 3% for amounts 70,001–5M UGX. Collections are free. No hidden fees, no monthly charges — just straightforward pricing for businesses across East Africa.",
          url: import.meta.env.VITE_SITE_URL ? `${import.meta.env.VITE_SITE_URL}/pricing` : "/pricing",
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "What are ObPay collection fees?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "ObPay does not charge merchants a fee to collect payments from customers. You receive the full amount your customer sends. There are no hidden fees or deductions on collections.",
              },
            },
            {
              "@type": "Question",
              name: "How much does it cost to send a payout through ObPay?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Sending a payout costs a flat 2,000 UGX for amounts between 500 and 70,000 UGX. For amounts between 70,001 and 5,000,000 UGX, a 3% fee applies. The recipient receives the full amount you specify — the fee is billed to your ObPay wallet separately.",
              },
            },
            {
              "@type": "Question",
              name: "What is the withdrawal fee on ObPay?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Withdrawing to your personal mobile money account uses the same tiered pricing as payouts: a flat 2,000 UGX for amounts between 500 and 70,000 UGX, and 3% for amounts between 70,001 and 5,000,000 UGX. The fee is deducted before the money reaches your mobile wallet.",
              },
            },
            {
              "@type": "Question",
              name: "Is there a minimum amount for collections or payouts?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. The minimum amount for both collections and payouts is 500 UGX. Transactions below this threshold cannot be processed.",
              },
            },
            {
              "@type": "Question",
              name: "Are there any monthly fees or setup costs?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. ObPay has zero setup fees, zero monthly charges, and zero hidden costs. You only pay when you use the platform — tiered pricing on payouts and withdrawals: 2,000 UGX flat for amounts 500–70,000 UGX, and 3% for amounts 70,001–5M UGX. That's it.",
              },
            },
            {
              "@type": "Question",
              name: "Does ObPay support Airtel Money and MTN Mobile Money?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. ObPay supports both Airtel Money and MTN Mobile Money across Uganda and East Africa. You can collect from and send to both networks through the platform.",
              },
            },
          ],
        }}
      />

      <Navbar onToggleTheme={toggleTheme} theme={theme} />

      <main>
        {/* Hero Section */}
        <section className="relative w-full min-h-[520px] md:min-h-[600px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0">
            <img loading="lazy" decoding="async"
              src="https://readdy.ai/api/search-image?query=Abstract%20geometric%20composition%20with%20warm%20amber%20and%20deep%20emerald%20green%20accents%20on%20a%20soft%20cream%20background%2C%20overlapping%20organic%20shapes%20with%20smooth%20gradients%2C%20minimalist%20and%20elegant%20financial%20technology%20aesthetic%2C%20clean%20lines%2C%20subtle%20texture%2C%20modern%20professional%20design%2C%20no%20text%20or%20typography%2C%20abstract%20flow%20shapes%2C%20light%20airy%20atmosphere&width=1920&height=1080&seq=pricing-hero-2026-x1&orientation=landscape"
              alt="ObPay pricing background"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/20"></div>
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto px-4 md:px-6 text-center py-16 md:py-20">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-background-50/20 backdrop-blur-sm border border-background-50/30 mb-6">
              <span className="w-2 h-2 rounded-full bg-accent-500 animate-pulse"></span>
              <span className="text-xs font-medium text-background-50 font-label tracking-wide uppercase">
                Transparent Pricing
              </span>
            </div>

            <h1 className="font-heading font-bold text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-background-50 mb-5 leading-tight">
              Simple, Transparent
              <br />
              <span className="text-accent-400">Fee Structure</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-background-50/80 max-w-2xl mx-auto leading-relaxed mb-8">
              No hidden charges. No monthly subscriptions. No setup costs. Just pay for what you use — simple tiered pricing on payouts and withdrawals. Collections are always free.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-6 py-3 rounded-lg text-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Get Started Free
                <i className="ri-arrow-right-line"></i>
              </Link>
              <a
                href="#fee-breakdown"
                className="inline-flex items-center gap-2 bg-background-50/15 hover:bg-background-50/25 text-background-50 font-medium px-6 py-3 rounded-lg text-sm backdrop-blur-sm border border-background-50/20 transition-colors whitespace-nowrap cursor-pointer"
              >
                View Full Breakdown
                <i className="ri-arrow-down-line"></i>
              </a>
            </div>
          </div>
        </section>

        {/* How Payments Work */}
        <section className="w-full py-16 md:py-24 bg-background-50" id="how-it-works">
          <div className="max-w-7xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12 md:mb-16">
              <span className="inline-block text-xs font-semibold font-label tracking-wider uppercase text-accent-600 bg-accent-100/80 px-3 py-1 rounded-full mb-4">
                How ObPay Works
              </span>
              <h2 className="font-heading font-bold text-2xl md:text-4xl text-foreground-950 mb-4">
                Three Ways to Move Money
              </h2>
              <p className="text-sm md:text-base text-foreground-600 max-w-2xl mx-auto leading-relaxed">
                ObPay gives you everything you need to manage business payments — collect from customers, send money to anyone, and withdraw to your own mobile wallet. Each is simple and transparent.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Collect */}
              <div className="bg-background-100 rounded-xl p-6 md:p-8 border border-background-200/70 relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500 rounded-t-xl"></div>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary-100 flex items-center justify-center mb-5">
                  <i className="ri-download-cloud-2-line text-xl md:text-2xl text-primary-600"></i>
                </div>
                <h3 className="font-heading font-bold text-lg md:text-xl text-foreground-950 mb-2">
                  Collect Payments
                </h3>
                <p className="text-sm text-foreground-600 leading-relaxed mb-4">
                  Collect money from your customers via mobile money or bank transfer. You receive the full amount — no deductions, no hidden charges.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-primary-700 bg-primary-100/70 rounded-lg px-3 py-2">
                  <i className="ri-check-line text-primary-600"></i>
                  <span>Free — no fee</span>
                </div>
              </div>

              {/* Send Payout */}
              <div className="bg-background-100 rounded-xl p-6 md:p-8 border border-background-200/70 relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-secondary-500 rounded-t-xl"></div>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-secondary-100 flex items-center justify-center mb-5">
                  <i className="ri-send-plane-2-line text-xl md:text-2xl text-secondary-600"></i>
                </div>
                <h3 className="font-heading font-bold text-lg md:text-xl text-foreground-950 mb-2">
                  Send Payout
                </h3>
                <p className="text-sm text-foreground-600 leading-relaxed mb-4">
                  Send money to anyone — employees, suppliers, or partners. The recipient gets the full amount you specify. You pay a small flat fee.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-secondary-700 bg-secondary-100/70 rounded-lg px-3 py-2">
                  <i className="ri-money-dollar-circle-line text-secondary-600"></i>
                  <span>From 2,000 UGX</span>
                </div>
              </div>

              {/* Withdraw */}
              <div className="bg-background-100 rounded-xl p-6 md:p-8 border border-background-200/70 relative overflow-hidden group">
                <div className="absolute top-0 left-0 right-0 h-1 bg-accent-500 rounded-t-xl"></div>
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-xl bg-accent-100 flex items-center justify-center mb-5">
                  <i className="ri-smartphone-line text-xl md:text-2xl text-accent-600"></i>
                </div>
                <h3 className="font-heading font-bold text-lg md:text-xl text-foreground-950 mb-2">
                  Withdraw to Mobile
                </h3>
                <p className="text-sm text-foreground-600 leading-relaxed mb-4">
                  Move your ObPay balance to your personal Airtel or MTN mobile wallet whenever you need it. Fast and straightforward.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-accent-700 bg-accent-100/70 rounded-lg px-3 py-2">
                  <i className="ri-percent-line text-accent-600"></i>
                  <span>Tiered — see breakdown</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fee Breakdown Table */}
        <section className="w-full py-16 md:py-24 bg-background-100" id="fee-breakdown">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12 md:mb-16">
              <span className="inline-block text-xs font-semibold font-label tracking-wider uppercase text-primary-600 bg-primary-100/80 px-3 py-1 rounded-full mb-4">
                Full Breakdown
              </span>
              <h2 className="font-heading font-bold text-2xl md:text-4xl text-foreground-950 mb-4">
                Every Fee, Explained
              </h2>
              <p className="text-sm md:text-base text-foreground-600 max-w-2xl mx-auto leading-relaxed">
                No surprises. No asterisks. Here is exactly what ObPay charges for each type of transaction.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-background-200/70 bg-background-50">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-background-100 border-b border-background-200/70">
                      <th className="text-left py-4 px-5 md:px-6 font-heading font-semibold text-sm text-foreground-900 whitespace-nowrap">
                        Transaction Type
                      </th>
                      <th className="text-left py-4 px-5 md:px-6 font-heading font-semibold text-sm text-foreground-900 whitespace-nowrap">
                        Who Pays the Fee
                      </th>
                      <th className="text-right py-4 px-5 md:px-6 font-heading font-semibold text-sm text-foreground-900 whitespace-nowrap">
                        Fee Amount
                      </th>
                      <th className="text-right py-4 px-5 md:px-6 font-heading font-semibold text-sm text-foreground-900 whitespace-nowrap">
                        Min Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-200/60">
                    <tr className="hover:bg-background-50 transition-colors">
                      <td className="py-4 px-5 md:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                            <i className="ri-download-cloud-2-line text-primary-600 text-sm"></i>
                          </div>
                          <span className="font-medium text-sm text-foreground-900 whitespace-nowrap">Collect Payment</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 md:px-6">
                        <span className="text-sm text-foreground-600">Merchant</span>
                      </td>
                      <td className="py-4 px-5 md:px-6 text-right">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 bg-primary-100/70 px-3 py-1 rounded-full">
                          <i className="ri-check-line text-xs"></i>
                          Free
                        </span>
                      </td>
                      <td className="py-4 px-5 md:px-6 text-right">
                        <span className="text-sm text-foreground-600">500 UGX</span>
                      </td>
                    </tr>

                    <tr className="hover:bg-background-50 transition-colors">
                      <td className="py-4 px-5 md:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                            <i className="ri-send-plane-2-line text-secondary-600 text-sm"></i>
                          </div>
                          <span className="font-medium text-sm text-foreground-900 whitespace-nowrap">Send Payout</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 md:px-6">
                        <span className="text-sm text-foreground-600">Sender (Merchant)</span>
                      </td>
                      <td className="py-4 px-5 md:px-6 text-right">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary-700 bg-secondary-100/70 px-3 py-1 rounded-full">
                          See tiers
                          <span className="text-xs font-normal text-secondary-500">500–70K: 2K / 70K+–5M: 3%</span>
                        </span>
                      </td>
                      <td className="py-4 px-5 md:px-6 text-right">
                        <span className="text-sm text-foreground-600">500 UGX</span>
                      </td>
                    </tr>

                    <tr className="hover:bg-background-50 transition-colors">
                      <td className="py-4 px-5 md:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
                            <i className="ri-smartphone-line text-accent-600 text-sm"></i>
                          </div>
                          <span className="font-medium text-sm text-foreground-900 whitespace-nowrap">Withdraw to Mobile</span>
                        </div>
                      </td>
                      <td className="py-4 px-5 md:px-6">
                        <span className="text-sm text-foreground-600">Merchant</span>
                      </td>
                      <td className="py-4 px-5 md:px-6 text-right">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 bg-accent-100/70 px-3 py-1 rounded-full">
                          See tiers
                          <span className="text-xs font-normal text-accent-500">500–70K: 2K / 70K+–5M: 3%</span>
                        </span>
                      </td>
                      <td className="py-4 px-5 md:px-6 text-right">
                        <span className="text-sm text-foreground-600">500 UGX</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-background-50 border-t border-background-200/70 px-5 md:px-6 py-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-500">
                  <i className="ri-information-line"></i>
                  <span>Fees are applied at the time of transaction. All amounts shown in Ugandan Shillings (UGX).</span>
                </div>
              </div>
            </div>

            {/* Example Calculations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-6 md:p-7">
                <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-4 flex items-center gap-2">
                  <i className="ri-send-plane-2-line text-secondary-600"></i>
                  Payout Example (Small Amount)
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground-600">You want to send</span>
                    <span className="font-semibold text-foreground-900">50,000 UGX</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground-600">Recipient receives</span>
                    <span className="font-semibold text-primary-700">50,000 UGX</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground-600">Fee (flat — under 70K)</span>
                    <span className="font-semibold text-secondary-700">2,000 UGX</span>
                  </div>
                  <div className="border-t border-background-200/70 pt-3 flex justify-between items-center text-sm">
                    <span className="font-medium text-foreground-900">Total deducted from wallet</span>
                    <span className="font-bold text-foreground-950">52,000 UGX</span>
                  </div>
                </div>
              </div>

              <div className="bg-background-50 rounded-xl border border-background-200/70 p-6 md:p-7">
                <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-4 flex items-center gap-2">
                  <i className="ri-smartphone-line text-accent-600"></i>
                  Withdrawal Example (Large Amount)
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground-600">You want to withdraw</span>
                    <span className="font-semibold text-foreground-900">200,000 UGX</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-foreground-600">3% fee (over 70K)</span>
                    <span className="font-semibold text-accent-700">- 6,000 UGX</span>
                  </div>
                  <div className="border-t border-background-200/70 pt-3 flex justify-between items-center text-sm">
                    <span className="font-medium text-foreground-900">You receive on mobile</span>
                    <span className="font-bold text-foreground-950">194,000 UGX</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="w-full py-16 md:py-24 bg-background-50">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
            <span className="inline-block text-xs font-semibold font-label tracking-wider uppercase text-secondary-600 bg-secondary-100/80 px-3 py-1 rounded-full mb-4">
              Why ObPay
            </span>
            <h2 className="font-heading font-bold text-2xl md:text-4xl text-foreground-950 mb-4">
              No Hidden Fees, Ever
            </h2>
            <p className="text-sm md:text-base text-foreground-600 max-w-2xl mx-auto leading-relaxed mb-10">
              We built ObPay because we were tired of payment platforms with confusing pricing. Here is what you will never pay for.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
              {[
                { icon: "ri-close-circle-line", text: "No setup fees" },
                { icon: "ri-close-circle-line", text: "No monthly charges" },
                { icon: "ri-close-circle-line", text: "No hidden deductions" },
                { icon: "ri-close-circle-line", text: "No minimum balance" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-3 bg-background-100 rounded-lg px-4 py-3 border border-background-200/70"
                >
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <i className={`${item.icon} text-primary-600 text-sm`}></i>
                  </div>
                  <span className="text-sm font-medium text-foreground-800 whitespace-nowrap">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Supported Networks */}
        <section className="w-full py-16 md:py-24 bg-background-100">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold font-label tracking-wider uppercase text-accent-600 bg-accent-100/80 px-3 py-1 rounded-full mb-4">
                Supported Networks
              </span>
              <h2 className="font-heading font-bold text-2xl md:text-4xl text-foreground-950 mb-4">
                Works With Your Network
              </h2>
              <p className="text-sm md:text-base text-foreground-600 max-w-2xl mx-auto leading-relaxed">
                ObPay connects to the mobile money networks your customers and business already use.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-6 md:p-8 flex items-center gap-5">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-accent-100 flex items-center justify-center shrink-0">
                  <i className="ri-signal-tower-line text-2xl text-accent-600"></i>
                </div>
                <div>
                  <h4 className="font-heading font-bold text-lg text-foreground-950">Airtel Money</h4>
                  <p className="text-sm text-foreground-600 mt-1">Collect, send, and withdraw to Airtel mobile wallets across Uganda.</p>
                </div>
              </div>

              <div className="bg-background-50 rounded-xl border border-background-200/70 p-6 md:p-8 flex items-center gap-5">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary-100 flex items-center justify-center shrink-0">
                  <i className="ri-smartphone-line text-2xl text-primary-600"></i>
                </div>
                <div>
                  <h4 className="font-heading font-bold text-lg text-foreground-950">MTN Mobile Money</h4>
                  <p className="text-sm text-foreground-600 mt-1">Collect, send, and withdraw to MTN mobile wallets across Uganda.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full py-16 md:py-24 bg-background-50">
          <div className="max-w-3xl mx-auto px-4 md:px-6">
            <div className="text-center mb-12 md:mb-16">
              <span className="inline-block text-xs font-semibold font-label tracking-wider uppercase text-primary-600 bg-primary-100/80 px-3 py-1 rounded-full mb-4">
                Common Questions
              </span>
              <h2 className="font-heading font-bold text-2xl md:text-4xl text-foreground-950 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-sm md:text-base text-foreground-600 max-w-xl mx-auto leading-relaxed">
                Got questions about ObPay fees and how payments work? We have answers.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  q: "What are ObPay collection fees?",
                  a: "ObPay does not charge merchants a fee to collect payments from customers. You receive the full amount your customer sends. There are no hidden fees or deductions on collections — what the customer pays is what lands in your ObPay wallet.",
                },
                {
                  q: "How much does it cost to send a payout through ObPay?",
                  a: "Sending a payout uses simple tiered pricing. For amounts between 500 and 70,000 UGX, the fee is a flat 2,000 UGX. For amounts between 70,001 and 5,000,000 UGX, the fee is 3% of the amount. The recipient receives the full amount you specify — the fee is billed to your ObPay wallet separately.",
                },
                {
                  q: "What is the withdrawal fee on ObPay?",
                  a: "Withdrawals use the same tiered pricing as payouts. For amounts between 500 and 70,000 UGX, you pay a flat 2,000 UGX. For amounts between 70,001 and 5,000,000 UGX, the fee is 3%. For example, withdrawing 50,000 UGX costs 2,000 UGX (you receive 48,000 UGX), while withdrawing 200,000 UGX costs 6,000 UGX (you receive 194,000 UGX).",
                },
                {
                  q: "Is there a minimum amount for collections or payouts?",
                  a: "Yes. The minimum amount for both collections and payouts is 500 UGX. Transactions below this threshold cannot be processed through the platform.",
                },
                {
                  q: "Are there any monthly fees, subscription costs, or setup charges?",
                  a: "No. ObPay has zero setup fees, zero monthly charges, and zero subscription costs. You only pay when you use the platform — tiered pricing on payouts and withdrawals: 2,000 UGX flat for amounts 500–70,000 UGX, and 3% for amounts 70,001–5M UGX. Collections are always free. There are no contracts, no commitments, and no surprises.",
                },
                {
                  q: "Does ObPay support both Airtel Money and MTN Mobile Money?",
                  a: "Yes. ObPay fully supports both Airtel Money and MTN Mobile Money across Uganda. You can collect payments from customers on either network, send payouts to recipients on either network, and withdraw your funds to either Airtel or MTN mobile wallets.",
                },
                {
                  q: "Can I use ObPay for my business without writing code?",
                  a: "Absolutely. ObPay provides a full-featured web dashboard where you can manage collections, send payouts, withdraw funds, create payment links, and view transaction history — all without writing a single line of code. For developers, we also provide a comprehensive API.",
                },
                {
                  q: "How fast are withdrawals processed?",
                  a: "Withdrawals to your mobile wallet are processed immediately. Once you confirm the withdrawal from your dashboard, the funds are sent and should arrive on your mobile money account within a few minutes. Network delays may occasionally extend this, but it is typically near-instant.",
                },
              ].map((faq, i) => (
                <details
                  key={i}
                  className="group bg-background-100 rounded-xl border border-background-200/70 overflow-hidden"
                >
                  <summary className="flex items-center justify-between px-5 md:px-6 py-4 cursor-pointer select-none">
                    <span className="font-medium text-sm md:text-base text-foreground-900 pr-4">
                      {faq.q}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-background-200/70 flex items-center justify-center shrink-0 group-open:rotate-45 transition-transform">
                      <i className="ri-add-line text-foreground-600 text-sm"></i>
                    </div>
                  </summary>
                  <div className="px-5 md:px-6 pb-4">
                    <p className="text-sm text-foreground-600 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-16 md:py-24 bg-background-100">
          <div className="max-w-3xl mx-auto px-4 md:px-6 text-center">
            <div className="bg-background-50 rounded-2xl border border-background-200/70 p-8 md:p-12">
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-6">
                <i className="ri-rocket-2-line text-2xl text-primary-600"></i>
              </div>
              <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-950 mb-4">
                Ready to Start Accepting Payments?
              </h2>
              <p className="text-sm md:text-base text-foreground-600 max-w-lg mx-auto leading-relaxed mb-8">
                Create your free ObPay account today. No setup fees, no monthly charges — just straightforward mobile money payments for your business.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-8 py-3.5 rounded-lg text-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  Create Free Account
                  <i className="ri-arrow-right-line"></i>
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-800 font-medium px-8 py-3.5 rounded-lg text-sm border border-background-200/70 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Read API Docs
                  <i className="ri-book-open-line"></i>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}