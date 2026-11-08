/** No bank rail is enabled until its account, fee and settlement contract exists. */
export const bankCapabilities = {
  bank_collection_available: false,
  bank_disbursement_available: false,
  account_verification_available: false,
  automatic_wallet_credit: false,
  status: "awaiting_bank_contract",
  message: "Bank payments are being configured. Bank collections, transfers and account verification are not enabled yet. No money has been moved.",
} as const;
export function blockedBankOperation() {
  return { success: false as const, error: bankCapabilities.message, code: "bank_contract_required" };
}