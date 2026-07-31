import { supabase, safeGetSession } from "@/lib/supabase";

const baseUrl = (import.meta.env.VITE_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");

export async function invokeEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  try {
    const { data: sessionData } = await safeGetSession();
    const token = sessionData?.session?.access_token || "";
    const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(anonKey ? { apikey: anonKey } : {}),
      ...(extraHeaders || {}),
    };

    const resp = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: text || `Server error (HTTP ${resp.status})` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

// Payment actions run only on this project's server, which holds the MarzPay
// credentials. Never fall back to the uploaded backend for these actions: that
// endpoint still contains the retired provider integration.
const LOCAL_ACTIONS = new Set([
  "collect",
  "payout",
  "balance",
  "transaction-status",
  "check-transaction",
  "sync-all-pending",
  "verify-phone",
  "verify-number",
  "test-connection",
]);

export async function invokeObpay(
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const action = String(body._action || body.action || "").trim();

  if (LOCAL_ACTIONS.has(action)) {
    try {
      const { obpayServerCall } = await import("@/lib/obpay.functions");
      const { data: sessionData } = await safeGetSession();
      const accessToken = sessionData?.session?.access_token || "";
      return await obpayServerCall({ data: { action, accessToken, body } });
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "The MarzPay service is temporarily unavailable. Please try again.",
      };
    }
  }

  return invokeEdgeFunction("obpay-api-no-jwt", body, extraHeaders);
}


export async function invokePublicLookup(body: Record<string, unknown>): Promise<any> {
  const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";
  try {
    const resp = await fetch(`${baseUrl}/functions/v1/obpay-public-lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(anonKey ? { apikey: anonKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, error: text || `Server error (HTTP ${resp.status})` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}