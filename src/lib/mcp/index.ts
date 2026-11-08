import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getWalletBalances from "./tools/get-wallet-balances";
import listTransactions from "./tools/list-transactions";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";
export default defineMcp({
  name: "obpay",
  title: "Obpay",
  version: "0.1.0",
  instructions: "Read your ObPay wallet balances and recent dashboard transactions. Currency balances are separate and must not be summed. Reads return recorded ledger state, not fresh network reconciliation. No payments, withdrawals, transfers, account changes or database administration are exposed.",
  auth: auth.oauth.issuer({ issuer: `https://${projectRef}.supabase.co/auth/v1`, acceptedAudiences: "authenticated" }),
  tools: [getWalletBalances, listTransactions],
});