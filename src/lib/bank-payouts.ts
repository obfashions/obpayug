/** ObPay bank payout fee: 4.5% of the amount sent, rounded up to a whole unit. */
export const BANK_PAYOUT_FEE_PERCENT = 4.5;
export const BANK_PAYOUT_CURRENCIES = ["UGX", "KES", "RWF", "NGN", "XOF", "ZMW", "SLL", "CDF", "XAF"] as const;
export const BANK_PAYOUT_MINIMUM = 10000; // UGX-equivalent floor only applied to UGX
export const BANK_PAYOUT_TIMELINE = "12 to 24 hours";

export function bankPayoutQuote(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Enter a whole amount greater than zero.");
  const fee = Math.ceil((amount * BANK_PAYOUT_FEE_PERCENT) / 100);
  return { amount, fee, total: amount + fee };
}

export type BankPayoutInput = { amount: number; currency: string; bank_name: string; account_number: string; account_name: string; branch?: string; note?: string };

export function bankPayoutError(i: BankPayoutInput): string | null {
  if (!(BANK_PAYOUT_CURRENCIES as readonly string[]).includes(i.currency)) return "Choose a supported wallet currency.";
  if (!Number.isInteger(i.amount) || i.amount <= 0) return "Enter a whole amount greater than zero.";
  if (i.currency === "UGX" && i.amount < BANK_PAYOUT_MINIMUM) return `The minimum bank withdrawal is ${BANK_PAYOUT_MINIMUM.toLocaleString()} UGX.`;
  if (i.bank_name.trim().length < 2) return "Enter the bank name.";
  if (!/^[0-9A-Za-z-]{5,34}$/.test(i.account_number.trim())) return "Enter a valid account number.";
  if (i.account_name.trim().length < 3) return "Enter the account holder's name as registered at the bank.";
  return null;
}
