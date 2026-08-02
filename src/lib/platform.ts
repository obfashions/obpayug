import { getAccessToken } from "@/lib/session-token";
import { supabase } from "@/lib/supabase";

export interface PlatformResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Actions a signed-out visitor is allowed to run (public payment pages). */
const PUBLIC_ACTIONS = new Set(["public-link"]);

function looksLikeAuthError(error?: string): boolean {
  return /sign in again|not authenticated|jwt|unauthor/i.test(String(error || ""));
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

    if (PUBLIC_ACTIONS.has(action)) {
      return (await platformCall({ data: { action, accessToken: "", body } })) as PlatformResult<T>;
    }

    let accessToken = await getAccessToken();
    if (!accessToken) {
      // One last attempt: force a refresh before telling the user to sign in.
      try {
        const { data } = await supabase.auth.refreshSession();
        accessToken = data?.session?.access_token || "";
      } catch {
        /* handled below */
      }
    }
    if (!accessToken) {
      return { success: false, error: "Your session has expired. Please sign in again to continue." };
    }

    let res = (await platformCall({ data: { action, accessToken, body } })) as PlatformResult<T>;

    // The token may have expired between hydration and this call — refresh once
    // and retry rather than bouncing the merchant to the login screen.
    if (!res.success && looksLikeAuthError(res.error)) {
      try {
        const { data } = await supabase.auth.refreshSession();
        const fresh = data?.session?.access_token || "";
        if (fresh && fresh !== accessToken) {
          res = (await platformCall({ data: { action, accessToken: fresh, body } })) as PlatformResult<T>;
        }
      } catch {
        /* fall through with the original error */
      }
    }

    return res;
  } catch (err: any) {
    return { success: false, error: err?.message || "Could not reach ObPay. Check your connection." };
  }
}
