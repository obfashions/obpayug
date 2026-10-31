export interface BusinessPayment { reference: string; amount: number; fee_amount?: number; net_amount?: number | null; currency: string; status: string; type: string; created_at: string; source?: string; description?: string }

export function businessTotals(rows: BusinessPayment[]) {
  const totals: Record<string, { received: number; sent: number; fees: number }> = {};
  for (const row of rows) {
    if (!["success", "successful", "completed", "settled"].includes(row.status)) continue;
    const currency = String(row.currency).toUpperCase();
    const total = totals[currency] || { received: 0, sent: 0, fees: 0 };
    if (["collection", "deposit", "transfer_in"].includes(row.type)) total.received += Number(row.amount) || 0;
    if (["payout", "withdrawal", "transfer_out"].includes(row.type)) total.sent += Number(row.amount) || 0;
    total.fees += Number(row.fee_amount) || 0;
    totals[currency] = total;
  }
  return totals;
}

export function businessCsv(rows: BusinessPayment[]) {
  const escape = (v: unknown) => {
    const raw = String(v ?? "");
    const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [["Date", "Reference", "Type", "Currency", "Amount", "Fee", "Recipient / credited amount", "Status", "Channel", "Description"], ...rows.map((r) => [r.created_at, r.reference, r.type, r.currency, r.amount, r.fee_amount ?? "", r.net_amount ?? "", r.status, r.source || "dashboard", r.description || ""])].map((r) => r.map(escape).join(",")).join("\r\n");
}