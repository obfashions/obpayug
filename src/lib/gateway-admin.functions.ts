import { createServerFn } from "@tanstack/react-start";
import { runGatewayAdminAction } from "./gateway-admin.server";

export const gatewayAdminCall = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; accessToken?: string; body?: Record<string, unknown> }) => ({
    action: String(data?.action || ""),
    accessToken: String(data?.accessToken || ""),
    body: (data?.body || {}) as Record<string, unknown>,
  }))
  .handler(async ({ data }) => {
    try {
      return await runGatewayAdminAction(data.action, data.accessToken, data.body);
    } catch (err: any) {
      return { success: false, error: err?.message || "Something went wrong." };
    }
  });
