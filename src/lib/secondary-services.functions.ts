import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const secondaryAdminCall = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { secondaryAdmin } = await import("./marz-services.server");
    try { return await secondaryAdmin(data.accessToken); }
    catch { return { success: false, error: "Connection details are unavailable or you do not have permission." }; }
  });