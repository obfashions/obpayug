import { createServerFn } from "@tanstack/react-start";
import { runMarzAdminAction } from "./marz-admin.server";

export const marzAdminCall = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; accessToken?: string; body?: Record<string, unknown> }) => ({
    action: String(data?.action || ""),
    accessToken: String(data?.accessToken || ""),
    body: (data?.body || {}) as Record<string, unknown>,
  }))
  .handler(async ({ data }) => {
    try {
      return await runMarzAdminAction(data.action, data.accessToken, data.body);
    } catch (err: any) {
      return { success: false, error: err?.message || "Something went wrong." };
    }
  });
