// Browser-safe list of the countries/currencies ObPay can move money in.

export interface MoneyCountry {
  currency: string;
  country: string;
  flag: string;
  dial: string;
  decimals: number;
  /** Digits in a local mobile number after the leading 0 is dropped. */
  localDigits: number;
  networks: { value: string; label: string }[];
  example: string;
}

export const MONEY_COUNTRIES: MoneyCountry[] = [
  {
    currency: "UGX", country: "Uganda", flag: "🇺🇬", dial: "256", decimals: 0, localDigits: 9, example: "0772123456",
    networks: [{ value: "mtn", label: "MTN Mobile Money" }, { value: "airtel", label: "Airtel Money" }],
  },
  {
    currency: "KES", country: "Kenya", flag: "🇰🇪", dial: "254", decimals: 0, localDigits: 9, example: "0712345678",
    networks: [{ value: "mpesa", label: "M-Pesa (Safaricom)" }, { value: "airtel_money", label: "Airtel Money" }],
  },
  {
    currency: "RWF", country: "Rwanda", flag: "🇷🇼", dial: "250", decimals: 0, localDigits: 9, example: "0781234567",
    networks: [{ value: "mtn", label: "MTN Mobile Money" }, { value: "airtel", label: "Airtel Money" }],
  },
  {
    currency: "NGN", country: "Nigeria", flag: "🇳🇬", dial: "234", decimals: 2, localDigits: 10, example: "08012345678",
    networks: [{ value: "opay", label: "OPay" }, { value: "bank_transfer", label: "Bank Transfer" }],
  },
  {
    currency: "XOF", country: "Senegal / West Africa", flag: "🌍", dial: "221", decimals: 0, localDigits: 9, example: "0771234567",
    networks: [{ value: "orange", label: "Orange Money" }, { value: "mtn", label: "MTN Mobile Money" }, { value: "wave", label: "Wave" }, { value: "free", label: "Free Money" }],
  },
  {
    currency: "ZMW", country: "Zambia", flag: "🇿🇲", dial: "260", decimals: 0, localDigits: 9, example: "0971234567",
    networks: [{ value: "airtel", label: "Airtel Money" }, { value: "mtn", label: "MTN Mobile Money" }, { value: "zamtel", label: "Zamtel" }],
  },
  {
    // The partner's API code is SLL; amounts are shown to people as SLE.
    currency: "SLL", country: "Sierra Leone", flag: "🇸🇱", dial: "232", decimals: 0, localDigits: 8, example: "076123456",
    networks: [{ value: "orange", label: "Orange Money" }],
  },
  {
    currency: "CDF", country: "DR Congo", flag: "🇨🇩", dial: "243", decimals: 0, localDigits: 9, example: "0812345678",
    networks: [{ value: "airtel", label: "Airtel Money" }, { value: "mtn", label: "MTN Mobile Money" }, { value: "orange", label: "Orange Money" }],
  },
  {
    currency: "XAF", country: "Cameroon / Central Africa", flag: "🌍", dial: "237", decimals: 0, localDigits: 9, example: "0671234567",
    networks: [{ value: "mtn", label: "MTN Mobile Money" }, { value: "orange", label: "Orange Money" }],
  },
];

/** Every currency ObPay can hold a wallet in, including USD (card/crypto). */
export const WALLET_CURRENCIES = ["UGX", "KES", "RWF", "NGN", "XOF", "USD", "ZMW", "SLL", "CDF", "XAF"] as const;

/** Same list as a plain string array for server-side allowlists. */
export const SUPPORTED_MONEY_CURRENCIES: string[] = [...WALLET_CURRENCIES];

export function countryFor(currency: string): MoneyCountry | undefined {
  return MONEY_COUNTRIES.find((c) => c.currency === String(currency || "").toUpperCase());
}

/** Local mobile number (leading 0 dropped) → international (dial + local digits). "" when invalid. */
export function intlPhone(raw: unknown, currency: string): string {
  const c = countryFor(currency);
  if (!c) return "";
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(c.dial)) d = d.slice(c.dial.length);
  d = d.replace(/^0+/, "");
  if (d.length !== c.localDigits) return "";
  return `${c.dial}${d}`;
}
