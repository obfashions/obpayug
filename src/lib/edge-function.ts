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

export async function invokeObpay(
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<any> {
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