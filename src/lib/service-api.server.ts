import { z } from "zod";
import { secondaryAction, secondaryPurchase } from "./marz-services.server";

/** Caller must already be authenticated by the merchant-secret API boundary. */
export async function serviceApi(method: string, path: string, merchantId: string, body: Record<string, unknown>, query: URLSearchParams) {
  const action = (name: string, data: Record<string, unknown> = {}) => secondaryAction(name, merchantId, data);
  try {
    if (method === "POST" && path === "services/cards") {
      const { cardAction } = await import("./card-payments.server");
      return cardAction("card-create", merchantId, body, "api");
    }
    if (method === "GET") {
      const reads: Record<string, string> = {
        services: "svc-list", "services/airtime/catalog": "airtime-catalog",
        "services/bills/catalog": "bill-services", "services/bills/areas": "bill-areas",
        "services/banks": "bank-banks", "services/banks/catalog": "bank-services",
        "services/banks/accounts": "bank-accounts-list", "services/history": "service-history",
      };
      if (reads[path]) return action(reads[path]);
      if (path === "services/airtime/network") return action("airtime-detect", { msisdn: query.get("msisdn") });
      if (path === "services/bills/packages") return action("bill-bouquets", { utilityCode: query.get("utility_code") });
      const status = /^services\/status\/([^/]+)$/.exec(path);
      if (status) return action("card-status", { reference: z.string().uuid().parse(status[1]) });
    }
    if (method === "POST") {
      if (path === "services/banks/validate") return action("bank-validate", { bankName: body.bank_name, accountNumber: body.account_number });
      if (path === "services/banks/accounts") return action("bank-accounts-create", body);
      if (path === "services/bills/verify") return action("bill-verify", { utilityCode: body.utility_code, meterNumber: body.meter_number, area: body.area });
      const purchases = { "services/airtime": "airtime", "services/bills": "bill", "services/cards": "card", "services/banks/transfers": "bank" } as const;
      const kind = purchases[path as keyof typeof purchases];
      if (kind) return secondaryPurchase(merchantId, kind, body, "api");
    }
    if (method === "DELETE") {
      const account = /^services\/banks\/accounts\/([^/]+)$/.exec(path);
      if (account) return action("bank-accounts-delete", { id: z.string().uuid().parse(account[1]) });
    }
    return null;
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false, error: error.issues[0]?.message || "Check your request details." };
    throw error;
  }
}