import { MONEY_COUNTRIES } from "@/lib/countries";

export default function CountriesSection() {
  return (
    <section aria-labelledby="countries-heading" className="bg-background-100 border-y border-background-200 py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-primary-600 text-sm font-semibold uppercase tracking-wider mb-3">Across borders</p>
          <h2 id="countries-heading" className="font-heading text-3xl md:text-4xl font-bold text-foreground-900 mb-4">ObPay operates internationally</h2>
          <p className="text-foreground-600 text-base leading-relaxed">One account, separate currency wallets. Connect your business to payments in these supported countries.</p>
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {MONEY_COUNTRIES.map((country) => (
            <li key={country.currency} className="flex items-center gap-3 min-w-0 rounded-lg border border-background-200 bg-background-50 px-3 py-4 md:px-4">
              <span aria-hidden="true" className="text-3xl shrink-0">{country.currency === "XOF" ? "🇸🇳" : country.currency === "XAF" ? "🇨🇲" : country.flag}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-foreground-900 break-words">{country.country.split(" / ")[0]}</p>
                <p className="text-xs text-foreground-500 mt-1">{country.currency === "SLL" ? "SLE" : country.currency}</p>
              </div>
            </li>
          ))}
          <li className="flex items-center gap-3 min-w-0 rounded-lg border border-background-200 bg-background-50 px-3 py-4 md:px-4">
            <span aria-hidden="true" className="text-3xl shrink-0">🇺🇸</span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground-900">US dollar wallet</p>
              <p className="text-xs text-foreground-500 mt-1">USD · Card & crypto</p>
            </div>
          </li>
        </ul>
        <p className="mt-5 text-sm text-foreground-500">Payment methods, fees and availability vary by country. USD wallet support does not imply local US mobile-money payouts.</p>
      </div>
    </section>
  );
}