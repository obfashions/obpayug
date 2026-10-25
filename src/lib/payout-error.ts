/** Preserve money-safety instructions; connectivity is not a payment-network rule. */
export function payoutError(message: string): string {
  if (/do not retry|no money was sent|use (UGX|RWF|KES|NGN|XOF|USD|ZMW|SLL|CDF|XAF)\b/i.test(message)) return message;
  if (/failed to fetch|networkerror|network request failed|network error\.|err_internet|connection (failed|refused|lost)/i.test(message)) {
    return "Connection issue. Check your internet and retry.";
  }
  if (/session|expired|authentication/i.test(message)) return "Session expired. Please log in again.";
  return message || "Withdrawal could not be processed. Please try again shortly.";
}