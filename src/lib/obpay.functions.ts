import { createServerFn } from "@tanstack/react-start";
import { runObpayAction } from "./obpay.server";

export const obpayServerCall = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; accessToken?: string; body?: Record<string, unknown> }) => ({
    action: String(data?.action || ""),
    accessToken: String(data?.accessToken || ""),
    body: data?.body || {},
  }))
  .handler(async ({ data }) => runObpayAction(data.action, data.accessToken, data.body));
