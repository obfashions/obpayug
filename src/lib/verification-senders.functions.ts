import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ accessToken: z.string().min(10) });

export const getVerificationSenders = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    await requireAdmin(data.accessToken, "settings");
    const { verificationSenders, selectedVerificationSender } = await import("./verification-senders.server");
    return { senders: verificationSenders(), selected: await selectedVerificationSender() };
  });

export const saveVerificationSender = createServerFn({ method: "POST" })
  .inputValidator((data) => input.extend({ sender: z.string().max(80) }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./identity.server");
    const actor = await requireAdmin(data.accessToken, "settings");
    const { verificationSenders, VERIFICATION_SENDER_SETTING } = await import("./verification-senders.server");
    if (!verificationSenders().some((sender) => sender.id === data.sender && sender.ready)) throw new Error("Choose a configured email account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("site_settings").upsert({ key: VERIFICATION_SENDER_SETTING, value: data.sender, updated_at: new Date().toISOString(), updated_by: actor.email || actor.userId }, { onConflict: "key" });
    if (error) throw new Error("The email account could not be saved.");
    return { success: true };
  });