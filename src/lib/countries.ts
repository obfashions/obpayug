// Browser-safe list of the countries/currencies ObPay can move money in.

export interface MoneyCountry {
  currency: "UGX" | "KES" | "RWF" | "USD";
  country: string;
  flag: string;
  dial: string;
  decimals: number;
  networks: { value: string; label: string }[];
  example: string;
}

export const MONEY_COUNTRIES: MoneyCountry[] = [
  {
    currency: "UGX", country: "Uganda", flag: "🇺🇬", dial: "256", decimals: 0, example: "0772123456",
    networks: [{ value: "mtn", label: "MTN Mobile Money" }, { value: "airtel", label: "Airtel Money" }],
  },
  {
    currency: "KES", country: "Kenya", flag: "🇰🇪", dial: "254", decimals: 0, example: "0712345678",
    networks: [{ value: "mpesa", label: "M-Pesa (Safaricom)" }, { value: "airtel_money", label: "Airtel Money" }],
  },
  {
    currency: "RWF", country: "Rwanda", flag: "🇷🇼", dial: "250", decimals: 0, example: "0781234567",
    networks: [{ value: "mtn", label: "MTN Mobile Money" }, { value: "airtel", label: "Airtel Money" }],
  },
];

export const WALLET_CURRENCIES = ["UGX", "KES", "RWF", "USD"] as const;

export function countryFor(currency: string): MoneyCountry | undefined {
  return MONEY_COUNTRIES.find((c) => c.currency === String(currency || "").toUpperCase());
}

/** Local mobile number (0 + 9 digits) → international (dial + 9 digits). "" when invalid. */
export function intlPhone(raw: unknown, currency: string): string {
  const c = countryFor(currency);
  if (!c) return "";
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(c.dial)) d = d.slice(c.dial.length);
  d = d.replace(/^0+/, "");
  if (d.length !== 9) return "";
  return `${c.dial}${d}`;
}
