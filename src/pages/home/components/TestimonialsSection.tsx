const testimonials = [
  {
    quote:
      "ObPay transformed how our e-commerce store accepts payments. Integration took under 3 hours, and our conversion rate improved by 35%. The dashboard is incredibly intuitive.",
    name: "Sarah Nakato",
    role: "CEO, Kampala Mart",
    initials: "SN",
    color: "bg-primary-100 text-primary-600",
  },
  {
    quote:
      "As a fintech startup, we needed a reliable payment partner. ObPay's API is clean, well-documented, and their webhook system is rock solid. Customer support responds within minutes.",
    name: "David Ochieng",
    role: "CTO, FinFlow Kenya",
    initials: "DO",
    color: "bg-accent-100 text-accent-600",
  },
  {
    quote:
      "We process thousands of payouts monthly to our delivery partners. ObPay's bulk payout feature saves us hours every week. The real-time tracking gives us complete visibility.",
    role: "Operations Manager",
    initials: "JM",
    color: "bg-secondary-100 text-secondary-600",
    name: "James Mutebi",
  },
  {
    quote:
      "The payment links feature alone has been a game changer for our consultancy. We create links for invoices in seconds and clients pay instantly. No more follow-up calls.",
    name: "Grace Auma",
    role: "Director, Auma Consulting",
    initials: "GA",
    color: "bg-primary-100 text-primary-600",
  },
  {
    quote:
      "Moving from our previous provider to ObPay was seamless. Their onboarding team guided us through every step. Transaction fees are transparent with no hidden charges.",
    name: "Peter Kagwa",
    role: "Finance Lead, TechHub Uganda",
    initials: "PK",
    color: "bg-accent-100 text-accent-600",
  },
  {
    quote:
      "We built our entire payment infrastructure on ObPay's APIs. The sandbox environment made testing effortless, and going live was just a toggle switch. Highly recommended.",
    name: "Ruth Nalwoga",
    role: "Lead Developer, PaySwift",
    initials: "RN",
    color: "bg-secondary-100 text-secondary-600",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 md:py-28 bg-background-100">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-chat-quote-line" />
              Testimonials
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Trusted by{" "}
              <span className="text-primary-500">2,000+</span> Businesses
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              From startups to enterprises, businesses across East Africa rely on ObPay to power their payments.
            </p>
          </div>

          {/* Testimonials Masonry Grid */}
          <div className="columns-1 md:columns-2 lg:columns-3 gap-4 md:gap-5 space-y-4 md:space-y-5">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="break-inside-avoid bg-background-50 rounded-xl p-5 md:p-6 border border-background-200/70 hover:border-background-300/60 transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-full ${t.color} flex items-center justify-center font-heading font-bold text-sm shrink-0`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-foreground-500">{t.role}</p>
                  </div>
                </div>
                <p className="text-sm text-foreground-700 leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex gap-0.5 mt-4">
                  {[...Array(5)].map((_, j) => (
                    <i
                      key={j}
                      className="ri-star-fill text-accent-500 text-sm"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}