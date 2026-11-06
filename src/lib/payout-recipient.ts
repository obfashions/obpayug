/** Normalise recipient names without inventing one or borrowing another account's identity. */
export function payoutRecipientName(body: Record<string, any>): string {
  const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
  for (const value of [body.customer_name, body.customerName, body.recipient_name, body.recipientName, body.account_name, body.accountName, customer.name, customer.customer_name]) {
    if (typeof value === "string" && value.trim()) return value.trim().replace(/\s+/g, " ");
  }
  return "";
}