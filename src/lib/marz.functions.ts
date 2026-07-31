import { createServerFn } from "@tanstack/react-start";
import { pushMarzCredentialsToDb, runMarzAction } from "./marz.server";

export const syncMarzCredentials = createServerFn({ method: "POST" })
  .inputValidator((data: { accessToken: string }) => ({
    accessToken: String(data?.accessToken || ""),
  }))
  .handler(async ({ data }) => pushMarzCredentialsToDb(data.accessToken));

export const marzCall = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; payload?: Record<string, unknown> }) => ({
    action: String(data?.action || ""),
    payload: data?.payload || {},
  }))
  .handler(async ({ data }) => runMarzAction(data.action, data.payload));
