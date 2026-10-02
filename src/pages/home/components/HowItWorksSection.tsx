export default function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Choose Your Country",
      description: "Create your account and choose where your business operates. That country's currency becomes your main wallet.",
      icon: "ri-user-add-line",
      color: "bg-primary-100 text-primary-600",
    },
    {
      number: "02",
      title: "Complete KYC",
      description: "Choose personal or business verification, then upload the requested clear and valid documents for review.",
      icon: "ri-shield-check-line",
      color: "bg-accent-100 text-accent-600",
    },
    {
      number: "03",
      title: "Choose How to Collect",
      description: "Request a mobile money payment, share a payment link, or create an API key for your website.",
      icon: "ri-key-2-line",
      color: "bg-secondary-100 text-secondary-600",
    },
    {
      number: "04",
      title: "Track and Withdraw",
      description: "Follow each payment to confirmation, see the correct wallet balance, then withdraw available funds.",
      icon: "ri-rocket-line",
      color: "bg-primary-100 text-primary-600",
    },
  ];

  return (
    <section className="py-20 md:py-28 bg-background-100">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-14 md:mb-18">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider mb-4">
              <i className="ri-route-line" />
              How It Works
            </span>
            <h2 className="font-heading font-bold text-3xl md:text-4xl lg:text-5xl text-foreground-900 mb-4">
              Get Started in{" "}
              <span className="text-primary-500">4 Simple Steps</span>
            </h2>
            <p className="text-base md:text-lg text-foreground-600 leading-relaxed">
              Open the right currency wallet, complete verification, receive money and follow every transaction from one account.
            </p>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-4">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative group"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[60%] right-[-20%] h-px bg-background-300/60" />
                )}

                <div className="bg-background-50 rounded-xl p-6 md:p-7 border border-background-200/70 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 h-full">
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className={`w-12 h-12 rounded-lg ${step.color} flex items-center justify-center`}
                    >
                      <i className={`${step.icon} text-xl`} />
                    </div>
                    <span className="font-heading font-bold text-2xl text-foreground-200">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-foreground-600 leading-relaxed">
                    {step.description}
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