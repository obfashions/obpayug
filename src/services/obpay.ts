// ObPay payment service (browser side).
//
// Everything money-related runs on the ObPay server; the browser only asks
// whether payments are live. Banking-partner credentials are managed by the
// ObPay team in the admin panel and are never exposed here.

import { invokeObpay } from "@/lib/edge-function";

export interface ProviderConnectionStatus {
  connected: boolean;
  accountNumber: string | null;
  environment: string | null;
  lastChecked: string | null;
  status: string | null;
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  data?: unknown;
}

/** Is the ObPay payment engine live right now? */
export async function getProviderConnectionStatus(): Promise<ProviderConnectionStatus> {
  try {
    const res: any = await invokeObpay({ action: "test-connection" });
    const live = res?.success === true;
    return {
      connected: live,
      accountNumber: live ? "ObPay payments" : null,
      environment: "live",
      lastChecked: new Date().toISOString(),
      status: live ? "active" : null,
    };
  } catch {
    return { connected: false, accountNumber: null, environment: null, lastChecked: null, status: null };
  }
}

/** Confirms the payment engine can reach the banking network. */
export async function testProviderConnection(): Promise<TestConnectionResult> {
  try {
    const res: any = await invokeObpay({ action: "test-connection" });
    if (res?.success) {
      return { ok: true, message: "Payments are live and connected.", data: res.data };
    }
    return { ok: false, message: res?.error || "Payments are temporarily unavailable. Please try again shortly." };
  } catch (err: any) {
    return { ok: false, message: err?.message || "Failed to run the connection test." };
  }
}
