// Truthful merchant tagging for every payment sent to the payment partner.
// Each payment says it is an ObPay payment and which ObPay merchant it is for,
// so the platform account can show exactly who every transaction belongs to.

export interface MerchantTag {
  id: string;
  name: string;
  kyc: string;
}

const cache = new Map<string, { at: number; tag: MerchantTag }>();

export async function merchantTag(merchantId: string, fallbackName?: string | null): Promise<MerchantTag> {
  const hit = cache.get(merchantId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.tag;
  let name = (fallbackName || "").trim();
  let kyc = "unverified";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("kyc_submissions")
      .select("business_name, full_name, status")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      name = name || String(data.business_name || data.full_name || "").trim();
      kyc = String(data.status || "pending");
    }
  } catch {
    /* keep defaults */
  }
  const tag = { id: merchantId, name: (name || "ObPay merchant").slice(0, 50), kyc };
  cache.set(merchantId, { at: Date.now(), tag });
  return tag;
}

/** "ObPay – Business name – reference/description", max 120 chars. */
export function tagDescription(tag: MerchantTag | undefined, detail: string) {
  const parts = ["ObPay", tag?.name, detail].filter(Boolean).map((s) => String(s).trim());
  return parts.join(" – ").slice(0, 120);
}

export function tagMetadata(tag: MerchantTag | undefined, channel: string) {
  return {
    platform: "ObPay",
    platform_site: "obpay.online",
    channel,
    ...(tag ? { merchant_id: tag.id, merchant_name: tag.name, merchant_kyc_status: tag.kyc } : {}),
  };
}
