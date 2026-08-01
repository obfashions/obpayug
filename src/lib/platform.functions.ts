import { createServerFn } from "@tanstack/react-start";
import { runPlatformAction } from "./platform.server";

export const platformCall = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; accessToken?: string; body?: Record<string, unknown> }) => ({
    action: String(data?.action || ""),
    accessToken: String(data?.accessToken || ""),
    body: (data?.body || {}) as Record<string, unknown>,
  }))
  .handler(async ({ data }) => runPlatformAction(data.action, data.accessToken, data.body));
