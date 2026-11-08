import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { accountClient } from "../access";
import { WALLET_CURRENCIES } from "../../countries";

export default defineTool({
  name: "list_transactions",
  title: "List recent transactions",
  description: "Read your recent ObPay dashboard transactions, optionally filtered by currency, without customer contact details or payment credentials.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum recent transactions, from 1 to 50."),
    currency: z.string().refine((value) => WALLET_CURRENCIES.includes(value as typeof WALLET_CURRENCIES[number]), "Unsupported wallet currency").optional().describe("Optional stored wallet currency, such as UGX or RWF; use SLL for Sierra Leone."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, currency }, ctx) => {
    const { client, owner } = await accountClient(ctx);
    let query = client.from("transactions").select("id,reference,type,amount,currency,status,fee_amount,net_amount,created_at").eq("user_id", owner).order("created_at", { ascending: false }).limit(limit);
    if (currency) query = query.eq("currency", currency);
    const { data, error } = await query;
    if (error) throw new ToolError("Transaction history is unavailable. Try again later.");
    return { content: [{ type: "text", text: data?.map((row) => `${row.id} | ${row.reference} | ${row.type} | ${row.amount} ${row.currency} | ${row.status} | fee ${row.fee_amount ?? "unavailable"} | net ${row.net_amount ?? "unavailable"} | ${row.created_at}`).join("\n") || "No matching transactions." }] };
  },
});