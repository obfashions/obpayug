import { getAccessToken } from "@/lib/session-token";

export interface PlatformResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Calls ObPay's own managed backend. Merchant accounts and balances still live
 * on the original backend — this only covers API keys, payment links,
 * webhooks, logs, verification files and payment records.
 */
export async function platform<T = any>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<PlatformResult<T>> {
  try {
    const { platformCall } = await import("@/lib/platform.functions");
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { success: false, error: "Your session has expired. Please sign in again to continue." };
    }
    return (await platformCall({ data: { action, accessToken, body } })) as PlatformResult<T>;
  } catch (err: any) {
    return { success: false, error: err?.message || "Could not reach ObPay. Check your connection." };
  }
}
