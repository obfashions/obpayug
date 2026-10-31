import { createServerFn } from "@tanstack/react-start";

/** Admin-only read: current payout schedule, plus clearly dated settlement evidence. */
export const partnerFeeSchedule = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => ({ accessToken: String(d?.accessToken || "") }))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken);
    const { getGatewayCreds, gatewayPayoutMethods } = await import("./gateway.server");
    const { WALLET_CURRENCIES } = await import("./countries");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const creds = await getGatewayCreds();
    if (!creds) throw new Error("Partner pricing is unavailable. Check the connection first.");
    const rows = await Promise.all(WALLET_CURRENCIES.map(async (currency) => {
      const [payout, collection] = await Promise.all([
        gatewayPayoutMethods(creds, currency),
        supabaseAdmin.from("payment_records").select("amount,metadata,created_at").eq("currency", currency).eq("type", "collection").eq("status", "success").order("created_at", { ascending: false }).limit(20),
      ]);
      const evidence = collection.error ? null : (collection.data || []).find((r) => {
        const m = r.metadata as Record<string, unknown> | null;
        return m?.provider !== "marz" && m?.partner_fee != null && Number.isFinite(Number(m.partner_fee)) && Number(r.amount) > 0;
      });
      const metadata = evidence?.metadata as Record<string, unknown> | null;
      return { currency, payout: payout.ok ? { available: payout.available, fee: payout.fee, minimum: payout.minimum } : null,
        collection: evidence ? { percent: Number(metadata?.partner_fee) / Number(evidence.amount) * 100, at: evidence.created_at } : null };
    }));
    return { checkedAt: new Date().toISOString(), rows };
  });