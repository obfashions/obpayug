import { createServerFn } from "@tanstack/react-start";

let cache: { at: number; list: string[] } | null = null;

/** Currencies the payment partner account has switched on (checked live, cached 5 min). */
export const getEnabledCurrencies = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < 5 * 60_000) return { currencies: cache.list };
  try {
    const { getGatewayCreds, gatewayPayoutMethods } = await import("./gateway.server");
    const creds = await getGatewayCreds();
    if (!creds) return { currencies: ["UGX"] };
    const all = ["UGX", "KES", "RWF", "USD"];
    const results = await Promise.all(all.map((c) => gatewayPayoutMethods(creds, c).catch(() => null)));
    const list = all.filter((_, i) => results[i]?.available);
    if (!list.includes("UGX")) list.unshift("UGX");
    cache = { at: Date.now(), list };
    return { currencies: list };
  } catch {
    return { currencies: ["UGX"] };
  }
});
