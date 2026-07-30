export default function PartnersSection() {
  const partnerBanks = [
    { name: "Stanbic Bank", category: "Commercial Bank" },
    { name: "Equity Bank", category: "Commercial Bank" },
    { name: "GTBank", category: "Commercial Bank" },
    { name: "Absa Bank Uganda", category: "Commercial Bank" },
    { name: "DFCU Bank", category: "Commercial Bank" },
    { name: "Centenary Bank", category: "Commercial Bank" },
    { name: "PostBank Uganda", category: "Commercial Bank" },
    { name: "Housing Finance Bank", category: "Commercial Bank" },
    { name: "MTN Uganda", category: "Mobile Network" },
    { name: "Airtel Uganda", category: "Mobile Network" },
    { name: "Standard Chartered", category: "Commercial Bank" },
    { name: "Bank of Baroda", category: "Commercial Bank" },
  ];

  const testimonials = [
    {
      quote: "ObPay has been instrumental in scaling our retail operations. Their loan program helped us open three new locations in Kampala within six months.",
      name: "Patrick Tumwine",
      role: "Managing Director, Fresh Mart Uganda",
      location: "Kampala, Uganda",
    },
    {
      quote: "We switched from our previous payment provider to ObPay and saw an immediate 40% reduction in failed transactions. The API integration was seamless and their support team is exceptional.",
      name: "Dr. Amina Hassan",
      role: "CEO, MedPay East Africa",
      location: "Nairobi, Kenya",
    },
    {
      quote: "As a growing logistics company, ObPay's working capital loans have been a game changer. We can now pay our drivers instantly and scale operations without cash flow stress.",
      name: "Samuel Owino",
      role: "Founder, Swift Logistics",
      location: "Kampala, Uganda",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-team-line" />
              Our Partners
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Connected to Every{" "}
              <span className="text-primary-500">Major Bank</span> in East Africa
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              ObPay is integrated with all major banks and mobile networks across Uganda and East Africa. Your customers can pay from any bank account or mobile wallet.
            </p>
          </div>

          {/* Partner Banks Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-14">
            {partnerBanks.map((bank) => (
              <div
                key={bank.name}
                className="flex flex-col items-center justify-center p-4 md:p-5 bg-background-100 rounded-xl border border-background-200/70 hover:border-primary-300 hover:shadow-md transition-all duration-300 text-center group cursor-default"
              >
                <div className="w-12 h-12 rounded-full bg-background-50 border border-background-200/70 flex items-center justify-center mb-2 group-hover:border-primary-300 group-hover:scale-110 transition-all">
                  <i
                    className={`${
                      bank.category === "Mobile Network"
                        ? "ri-smartphone-line text-accent-500"
                        : "ri-bank-line text-primary-500"
                    } text-lg`}
                  />
                </div>
                <p className="text-xs font-semibold text-foreground-800 whitespace-nowrap">
                  {bank.name}
                </p>
                <p className="text-[10px] text-foreground-500 mt-0.5">
                  {bank.category}
                </p>
              </div>
            ))}
          </div>

          {/* Partner Testimonials */}
          <div className="mb-10">
            <h3 className="font-heading font-semibold text-xl text-foreground-900 text-center mb-8">
              What Business Leaders Say
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
              {testimonials.map((t, i) => (
                <div
                  key={i}
                  className="bg-background-100 rounded-xl p-5 md:p-6 border border-background-200/70 hover:border-primary-300/60 transition-all duration-300"
                >
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(5)].map((_, j) => (
                      <i key={j} className="ri-star-fill text-accent-500 text-sm" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground-700 leading-relaxed mb-4 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div>
                    <p className="font-heading font-semibold text-sm text-foreground-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-foreground-500">{t.role}</p>
                    <p className="text-xs text-foreground-400 mt-0.5">{t.location}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="text-center mt-8">
            <p className="text-sm text-foreground-500">
              <i className="ri-add-circle-line text-primary-500 mr-1" />
              Plus 15+ more banks and mobile money networks — and we are adding more every quarter
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}