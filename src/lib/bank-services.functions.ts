import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const bankConnectionCheck = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { jjumaConnectionStatus } = await import("./jjuma.server");
    return jjumaConnectionStatus(data.accessToken);
  });