import { createServerFn } from "@tanstack/react-start";
import { runPlatformAction } from "./platform.server";

export const platformCall = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; accessToken?: string; body?: Record<string, unknown> }) => ({
    action: String(data?.action || ""),
    accessToken: String(data?.accessToken || ""),
    body: (data?.body || {}) as Record<string, unknown>,
  }))
  .handler(async ({ data }) => {
    try {
      return await runPlatformAction(data.action, data.accessToken, data.body);
    } catch (err: any) {
      console.error("platformCall failed", data.action, err?.message);
      return { success: false, error: err?.message || "Something went wrong. Please try again." } as any;
    }
  });
