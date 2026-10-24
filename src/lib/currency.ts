export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  locale: string;
  flag: string;
  country: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", locale: "en-UG", flag: "🇺🇬", country: "Uganda", decimals: 0 },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", locale: "en-KE", flag: "🇰🇪", country: "Kenya", decimals: 2 },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", locale: "en-TZ", flag: "🇹🇿", country: "Tanzania", decimals: 2 },
  { code: "RWF", name: "Rwandan Franc", symbol: "RF", locale: "en-RW", flag: "🇷🇼", country: "Rwanda", decimals: 0 },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", locale: "en-GH", flag: "🇬🇭", country: "Ghana", decimals: 2 },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", locale: "en-NG", flag: "🇳🇬", country: "Nigeria", decimals: 2 },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA", locale: "fr-SN", flag: "🌍", country: "Senegal", decimals: 0 },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "K", locale: "en-ZM", flag: "🇿🇲", country: "Zambia", decimals: 0 },
  { code: "SLL", name: "Sierra Leonean Leone", symbol: "Le", locale: "en-SL", flag: "🇸🇱", country: "Sierra Leone", decimals: 0 },
  { code: "CDF", name: "Congolese Franc", symbol: "FC", locale: "fr-CD", flag: "🇨🇩", country: "DR Congo", decimals: 0 },
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA", locale: "fr-CM", flag: "🌍", country: "Cameroon", decimals: 0 },
  { code: "ZAR", name: "South African Rand", symbol: "R", locale: "en-ZA", flag: "🇿🇦", country: "South Africa", decimals: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", flag: "🇺🇸", country: "United States", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", locale: "en-IE", flag: "🇪🇺", country: "Europe", decimals: 2 },
  { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", flag: "🇬🇧", country: "United Kingdom", decimals: 2 },
];

export const DEFAULT_CURRENCY = "UGX";

export function getCurrencyInfo(code: string): CurrencyInfo {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0];
}

export function getCurrencyByCountry(country: string): string {
  const found = SUPPORTED_CURRENCIES.find(
    (c) => c.country.toLowerCase() === country.toLowerCase()
  );
  return found?.code || DEFAULT_CURRENCY;
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const info = getCurrencyInfo(currencyCode || DEFAULT_CURRENCY);
  try {
    return new Intl.NumberFormat(info.locale, {
      style: "currency",
      currency: info.code,
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    }).format(amount);
  } catch {
    return `${info.symbol} ${amount.toLocaleString(info.locale, {
      minimumFractionDigits: info.decimals,
      maximumFractionDigits: info.decimals,
    })}`;
  }
}

export function formatCurrencyRaw(amount: number, currencyCode?: string): string {
  const info = getCurrencyInfo(currencyCode || DEFAULT_CURRENCY);
  return `${info.symbol} ${amount.toLocaleString(info.locale, {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  })}`;
}

export function formatDate(d: string, locale?: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(locale || "en-UG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export function getCountryFromPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("256")) return "Uganda";
  if (clean.startsWith("254")) return "Kenya";
  if (clean.startsWith("255")) return "Tanzania";
  if (clean.startsWith("250")) return "Rwanda";
  if (clean.startsWith("233")) return "Ghana";
  if (clean.startsWith("234")) return "Nigeria";
  if (clean.startsWith("27")) return "South Africa";
  if (clean.startsWith("1")) return "United States";
  if (clean.startsWith("44")) return "United Kingdom";
  return "";
}

export function getCurrencyFromPhone(phone: string): string {
  const country = getCountryFromPhone(phone);
  return getCurrencyByCountry(country);
}

export interface BalancesByCurrency {
  [currencyCode: string]: number;
}