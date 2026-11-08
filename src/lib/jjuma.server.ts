import { requireAdmin } from "./identity.server";
import { bankCapabilities } from "./bank-capabilities";

/** Admin-only health check: pooled transactions and API key metadata never leave this module. */
export async function jjumaConnectionStatus(accessToken: string) {
  await requireAdmin(accessToken, "settings");
  const key = process.env["UDC_JJUMA_PAY_3_API_KEY"];
  const auth = process.env["LOVABLE_API_KEY"];
  if (!key || !auth) return { success: true, data: { ...bankCapabilities, connected: false, connection_status: "not_configured" } };
  try {
    const response = await fetch("https://connector-gateway.lovable.dev/udc_jjuma_pay_3/api/v1/transactions", {
      headers: { Authorization: `Bearer ${auth}`, "X-Connection-Api-Key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json() as { success?: boolean };
    const connected = response.ok && body.success === true;
    return { success: true, data: { ...bankCapabilities, connected, connection_status: connected ? "connected" : "connection_check_failed" } };
  } catch {
    return { success: true, data: { ...bankCapabilities, connected: false, connection_status: "connection_check_failed" } };
  }
}