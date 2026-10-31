import { MONEY_COUNTRIES } from "@/lib/countries";

export default function CountriesSection() {
  return (
    <section aria-labelledby="countries-heading" className="bg-muted/50 border-y border-border py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-primary-600 text-sm font-semibold uppercase tracking-wider mb-3">Supported markets</p>
          <h2 id="countries-heading" className="font-heading text-3xl md:text-4xl font-semibold text-foreground-900 mb-4">ObPay operates internationally</h2>
          <p className="text-foreground-600 text-base leading-relaxed">Keep each currency in its own wallet. Payment methods and availability depend on the destination market.</p>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {MONEY_COUNTRIES.map((country) => (
            <li key={country.currency} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0 border-b border-border bg-transparent px-3 py-4 md:px-4">
              <span aria-hidden="true" className="text-3xl shrink-0">{country.currency === "XOF" ? "🇸🇳" : country.currency === "XAF" ? "🇨🇲" : country.flag}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground-900 break-words">{country.country.split(" / ")[0]}</p>
                <p className="text-xs text-foreground-500 mt-1">{country.currency === "SLL" ? "SLE" : country.currency}</p>
              </div>
            </li>
          ))}
          <li className="flex flex-col sm:flex-row items-start sm:items-center gap-3 min-w-0 border-b border-border bg-transparent px-3 py-4 md:px-4">
            <span aria-hidden="true" className="text-3xl shrink-0">🇺🇸</span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground-900">US dollar wallet</p>
              <p className="text-xs text-foreground-500 mt-1">USD · Card & crypto</p>
            </div>
          </li>
        </ul>
        <p className="mt-5 text-sm text-foreground-500">Payment methods, fees and availability vary by country. USD is available for card and crypto wallets, not local US mobile-money payouts.</p>
      </div>
    </section>
  );
}