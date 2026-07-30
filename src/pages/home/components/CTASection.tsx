import { Link } from "@/lib/router-compat";

export default function CTASection() {
  return (
    <section className="py-16 md:py-20 bg-background-100 border-y border-background-200/70">
      <div className="w-full px-4 md:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-primary-500 px-6 py-12 md:px-12 md:py-16 text-center">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-400 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-60" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-400 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 opacity-40" />

            <div className="relative z-10">
              <h2 className="font-heading font-bold text-2xl md:text-3xl lg:text-4xl text-background-50 mb-4">
                Ready to Power Your Payments?
              </h2>
              <p className="text-base md:text-lg text-primary-100 max-w-xl mx-auto mb-8">
                Join 2,000+ businesses already using ObPay to accept payments across East Africa. Start for free today.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center gap-2 bg-background-50 text-primary-600 hover:bg-background-100 font-semibold px-7 py-3.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Create Free Account
                  <i className="ri-arrow-right-line" />
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center justify-center gap-2 bg-primary-600 text-primary-100 hover:bg-primary-700 font-semibold px-7 py-3.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  <i className="ri-book-open-line" />
                  Explore API Docs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}