import { supabase, safeGetSession } from "@/lib/supabase";

// OBPay Payment Service — connects to LivePay (livepay.me) as the payment provider.
// All calls go through the obpay-api Supabase Edge Function for security.

export interface ProviderCredentials {
  accountNumber: string;
  apiKey: string;
  environment: "sandbox" | "live";
}

export interface ProviderConnectionStatus {
  connected: boolean;
  accountNumber: string | null;
  environment: string | null;
  lastChecked: string | null;
  status: string | null;
}

export interface CollectMoneyPayload {
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  network?: string;
}

export interface SendMoneyPayload {
  phoneNumber: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  network?: string;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

function getBaseUrl(): string {
  return (import.meta.env.VITE_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
}

async function callEdgeFunction(body: Record<string, unknown>): Promise<any> {
  const { data: sessionData } = await safeGetSession();
  const token = sessionData?.session?.access_token || "";
  const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY || "";
  const resp = await fetch(`${getBaseUrl()}/functions/v1/obpay-api-no-jwt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(anonKey ? { "apikey": anonKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: text || `Server error (HTTP ${resp.status})` };
  }
}

// ─── Connection Status ────────────────────────────────────────

export async function getProviderConnectionStatus(): Promise<ProviderConnectionStatus> {
  // PRIMARY: Check platform-wide LivePay API key — this is what ALL APIs use
  const { data: psData } = await supabase
    .from("platform_settings")
    .select("livepay_api_key, livepay_account_number, julypay_api_key, updated_at")
    .limit(1)
    .maybeSingle();

  const hasPlatformKey = (psData?.livepay_api_key && psData.livepay_api_key.length > 10) ||
    (psData?.julypay_api_key && psData.julypay_api_key.length > 10);

  // SECONDARY: Also check livepay_credentials for per-user overrides
  const { data: lpData } = await supabase
    .from("livepay_credentials")
    .select("account_number, environment, status, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (hasPlatformKey) {
    return {
      connected: true,
      accountNumber: psData?.livepay_account_number || lpData?.account_number || "platform",
      environment: lpData?.environment || "live",
      lastChecked: lpData?.updated_at || psData?.updated_at || null,
      status: "active",
    };
  }

  if (lpData) {
    return {
      connected: lpData.status === "active",
      accountNumber: lpData.account_number,
      environment: lpData.environment,
      lastChecked: lpData.updated_at,
      status: lpData.status,
    };
  }

  return {
    connected: false,
    accountNumber: null,
    environment: null,
    lastChecked: null,
    status: null,
  };
}

// Legacy alias — keep existing code working
export const getLivePayConnectionStatus = getProviderConnectionStatus;
export type LivePayConnectionStatus = ProviderConnectionStatus;

// ─── Test Connection (via Edge Function) ──────────────────────

export async function testProviderConnection(): Promise<TestConnectionResult> {
  try {
    const data = await callEdgeFunction({ _action: "test-connection" });

    // Edge function wraps EVERYTHING in apiSuccess (success:true at top level).
    // The REAL connection status is inside data.data.status — check that.
    if (data?.data?.status === "connected") {
      return {
        ok: true,
        message: `Connected to LivePay as ${data.data.accountNumber || "unknown"}. Balance: ${JSON.stringify(data.data.balance)}`,
        data: data.data,
      };
    }

    if (data?.data?.status === "partial") {
      return {
        ok: false,
        message: data.data.error || "Account number not configured.",
        data: data.data,
      };
    }

    if (data?.data?.status === "disconnected") {
      return {
        ok: false,
        message: data.data.error || "No LivePay API key configured. Enter one in the field above.",
        data: data.data,
      };
    }

    // status === "error" or anything else — LivePay rejected the key
    const livePayError = data?.data?.error || data?.error || "";
    return {
      ok: false,
      message: livePayError
        ? `LivePay says: "${livePayError}". Double-check your API key and account number, then save and test again.`
        : "Connection test failed — provider may be unreachable.",
      data: data?.data,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || "Failed to reach the edge function. Check your Supabase connection.",
    };
  }
}

// Legacy alias
export const testLivePayConnection = testProviderConnection;

// ─── Save Credentials to Database ─────────────────────────────

export async function saveProviderCredentials(
  creds: {
    accountNumber: string;
    environment: "sandbox" | "live";
    apiKey?: string;
  },
  userId: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const upsertData: Record<string, unknown> = {
      account_number: creds.accountNumber,
      user_id: userId,
      environment: creds.environment,
      status: "active",
      updated_at: new Date().toISOString(),
    };

    if (creds.apiKey) {
      upsertData.api_key = creds.apiKey;
      // Also update the platform-wide LivePay key so ALL users can use it
      const { data: psRow } = await supabase.from("platform_settings").select("id").limit(1).maybeSingle();
      await supabase.from("platform_settings").update({
        livepay_api_key: creds.apiKey,
        livepay_account_number: creds.accountNumber,
        updated_at: new Date().toISOString(),
      }).eq("id", psRow?.id || "");
    }

    const { error } = await supabase
      .from("livepay_credentials")
      .upsert(upsertData, { onConflict: "account_number" });

    if (error) {
      return { ok: false, message: `Database error: ${error.message}` };
    }

    return { ok: true, message: "Credentials saved. Test the connection to verify they work." };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to save credentials." };
  }
}

// Legacy alias
export const saveLivePayCredentialsToDB = saveProviderCredentials;

// ─── Collect Money (via Edge Function) ────────────────────────

export async function collectMoney(
  secretKey: string,
  payload: CollectMoneyPayload
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      _action: "collect",
      phoneNumber: payload.phoneNumber,
      amount: payload.amount,
      currency: payload.currency,
      reference: payload.reference,
      description: payload.description,
      network: payload.network,
    };
    if (secretKey) body._api_key = secretKey;

    const data = await callEdgeFunction(body);

    return {
      ok: data?.success ?? false,
      data: data?.data ?? data,
      error: data?.error,
    };
  } catch (err: any) {
    return { ok: false, data: null, error: err?.message || "Request failed" };
  }
}

// ─── Send Money / Payout (via Edge Function) ──────────────────

export async function sendMoney(
  secretKey: string,
  payload: SendMoneyPayload
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      _action: "payout",
      phoneNumber: payload.phoneNumber,
      amount: payload.amount,
      currency: payload.currency,
      reference: payload.reference,
      description: payload.description,
      network: payload.network,
    };
    if (secretKey) body._api_key = secretKey;

    const data = await callEdgeFunction(body);

    return {
      ok: data?.success ?? false,
      data: data?.data ?? data,
      error: data?.error,
    };
  } catch (err: any) {
    return { ok: false, data: null, error: err?.message || "Request failed" };
  }
}

// ─── Check Balance (via Edge Function) ────────────────────────

export async function checkBalance(
  secretKey: string,
  currency: string = "UGX"
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
    const body: Record<string, unknown> = { _action: "balance" };
    if (secretKey) body._api_key = secretKey;

    const data = await callEdgeFunction(body);

    return { ok: true, data: data?.data ?? data, error: data?.error };
  } catch (err: any) {
    return { ok: false, data: null, error: err?.message || "Request failed" };
  }
}

// ─── Transaction Status (via Edge Function) ───────────────────

export async function checkTransactionStatus(
  secretKey: string,
  reference: string
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  try {
    const body: Record<string, unknown> = { _action: "transaction-status", reference };
    if (secretKey) body._api_key = secretKey;

    const data = await callEdgeFunction(body);

    return {
      ok: data?.success ?? false,
      data: data?.data ?? data,
      error: data?.error,
    };
  } catch (err: any) {
    return { ok: false, data: null, error: err?.message || "Request failed" };
  }
}