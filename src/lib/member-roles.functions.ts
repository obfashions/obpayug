import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MEMBER_ROLES } from "./member-permissions";

export const saveMemberRoles = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(10), userId: z.string().uuid(), roles: z.array(z.enum(MEMBER_ROLES)).max(4) }).parse(d))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken, "roles");
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const client = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });
    const { error } = await client.rpc("set_member_roles", { p_user_id: data.userId, p_roles: data.roles });
    if (error) throw new Error(error.message);
    return { success: true };
  });