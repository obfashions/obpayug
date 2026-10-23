import { useState } from "react";

const faqs = [
  {
    question: "What payment methods does ObPay support?",
    answer:
      "ObPay supports MTN Mobile Money, Airtel Money, and direct bank transfers across East Africa. We are connected to major banks including GTBank, Stanbic Bank, Equity Bank, Absa, DFCU Bank, Centenary Bank, PostBank, and Housing Finance Bank. Additional mobile networks and banking partners are being added regularly.",
  },
  {
    question: "How long does it take to integrate the ObPay API?",
    answer:
      "Most developers complete a basic integration within 2 hours. We provide SDKs for PHP, Laravel, Node.js, JavaScript, and Python, along with comprehensive documentation, request/response examples, and a sandbox environment for testing before going live.",
  },
  {
    question: "What are the transaction fees?",
    answer:
      "ObPay uses simple tiered pricing on payouts and withdrawals — no setup fees, no monthly minimums. For amounts between 500 and 70,000 UGX, the fee is a flat 2,000 UGX. For amounts between 70,001 and 5,000,000 UGX, the fee is 3%. Receiving payments has a small platform fee shown before each payment. Volume discounts are available for businesses processing over UGX 50 million monthly. Contact our sales team for custom enterprise pricing.",
  },
  {
    question: "How do I get verified as a merchant?",
    answer:
      "After registration, you will be redirected to the KYC page where you provide your company name, country, business address, and national ID number. You will also upload the front and back of your national ID. Our team reviews applications within 24-48 hours. Once approved, all payment features are unlocked automatically.",
  },
  {
    question: "Is my data and my customers' data secure?",
    answer:
      "Absolutely. ObPay uses bank-level AES-256 encryption for all data in transit and at rest. We are PCI DSS compliant, implement two-factor authentication, advanced fraud detection, and regular security audits. API credentials are hashed and never stored in plain text.",
  },
  {
    question: "How does ObPay handle compliance and anti-money laundering (AML)?",
    answer:
      "ObPay has a comprehensive compliance framework. Every merchant must complete mandatory KYC verification — including national ID upload and business address confirmation — before processing any transactions. All documents are manually reviewed by our compliance team. We run automated AML monitoring on every transaction to detect suspicious patterns, maintain complete audit trails of all financial activity, and operate in alignment with Bank of Uganda AML/CFT guidelines and FATF recommendations for payment service providers.",
  },
  {
    question: "Can I create payment links without writing code?",
    answer:
      "Yes! Our Payment Links feature lets you create secure payment URLs directly from your dashboard in seconds. Simply enter the amount, currency, description, and optional redirect URL. Share the link via WhatsApp, email, SMS, or social media. No coding required.",
  },
  {
    question: "How do webhooks work on ObPay?",
    answer:
      "Webhooks allow your application to receive real-time notifications when events occur, such as successful payments, failed transactions, or completed payouts. You configure a webhook URL in your dashboard, and we send signed POST requests with event data. Each webhook includes a signature for verification using your webhook secret.",
  },
  {
    question: "What currencies does ObPay support?",
    answer:
      "ObPay currently supports Ugandan Shilling (UGX), Kenyan Shilling (KES), Ghanaian Cedi (GHS), and Central African CFA Franc (XAF). We are actively working to add more currencies as we expand across the African continent.",
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-20 md:py-28 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-100 text-secondary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-question-line" />
              FAQ
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl text-foreground-900 mb-4">
              Frequently Asked{" "}
              <span className="text-primary-500">Questions</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600">
              Everything you need to know about ObPay. Can not find what you are looking for? Contact our support team.
            </p>
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`rounded-xl border transition-all duration-300 ${
                  openIndex === index
                    ? "border-primary-300 bg-primary-50/30 shadow-sm"
                    : "border-background-200/70 bg-background-50 hover:border-background-300/60"
                }`}
              >
                <button
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                  className="w-full flex items-center justify-between gap-4 p-4 md:p-5 text-left cursor-pointer"
                >
                  <span className="font-heading font-semibold text-sm md:text-base text-foreground-900">
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      openIndex === index
                        ? "bg-primary-500 text-background-50 rotate-180"
                        : "bg-background-200/70 text-foreground-600"
                    }`}
                  >
                    <i className="ri-arrow-down-s-line text-lg" />
                  </div>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openIndex === index ? "max-h-96" : "max-h-0"
                  }`}
                >
                  <p className="px-4 md:px-5 pb-4 md:pb-5 text-sm md:text-base text-foreground-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}