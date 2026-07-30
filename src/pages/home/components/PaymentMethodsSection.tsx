export default function PaymentMethodsSection() {
  const paymentMethods = [
    { name: "MTN Mobile Money", category: "Mobile Money" },
    { name: "Airtel Money", category: "Mobile Money" },
    { name: "GTBank", category: "Bank" },
    { name: "Stanbic Bank", category: "Bank" },
    { name: "Equity Bank", category: "Bank" },
    { name: "Absa", category: "Bank" },
    { name: "DFCU Bank", category: "Bank" },
    { name: "Centenary Bank", category: "Bank" },
    { name: "PostBank", category: "Bank" },
    { name: "Housing Finance Bank", category: "Bank" },
  ];

  return (
    <section className="py-14 md:py-18 bg-background-50">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 md:mb-10">
            <p className="text-sm font-medium text-foreground-500 uppercase tracking-wider mb-2">
              Supported Payment Methods
            </p>
            <p className="text-base text-foreground-600">
              Accept payments from all major mobile money networks and banks across East Africa
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
            {paymentMethods.map((method) => (
              <div
                key={method.name}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-background-100 border border-background-200/70 hover:border-primary-300 hover:shadow-sm transition-all duration-300"
                title={method.name}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    method.category === "Mobile Money"
                      ? "bg-accent-500"
                      : "bg-primary-500"
                  }`}
                />
                <span className="text-sm font-medium text-foreground-800 whitespace-nowrap">
                  {method.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}