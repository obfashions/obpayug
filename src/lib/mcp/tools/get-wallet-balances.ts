import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { accountClient } from "../access";
import { combinedBalances } from "../../balance-values";

export default defineTool({
  name: "get_wallet_balances",
  title: "Get wallet balances",
  description: "Read your recorded ObPay wallet balances separately by currency; this does not move money or query pooled network funds.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const { client, owner, mainCurrency } = await accountClient(ctx);
    const [wallet, managed] = await Promise.all([
      client.from("merchant_wallets").select("available_balance,currency,balances_by_currency").eq("user_id", owner).maybeSingle(),
      client.from("merchant_balances").select("currency,available_balance").eq("merchant_id", owner).limit(100),
    ]);
    if (wallet.error || managed.error) throw new ToolError("Wallet balances could not be read completely. Try again later.");
    const balances = combinedBalances(wallet.data, managed.data ?? [], mainCurrency);
    return { content: [{ type: "text", text: Object.entries(balances).map(([currency, amount]) => `${currency}: ${amount}`).join("\n") || "No wallets recorded." }] };
  },
});