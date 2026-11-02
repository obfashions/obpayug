import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function normalizeContactPhone(value: string): string {
  const phone = value.trim().replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{9,15}$/.test(phone) || /^\+?0+$/.test(phone)) {
    throw new Error("Enter a valid phone number, including the country code for international numbers.");
  }
  return phone;
}

/** Use the signed-in identity, never a form-supplied account ID. RLS remains in force. */
export async function saveMerchantPhone(client: SupabaseClient<Database>, value: string) {
  const phone = normalizeContactPhone(value);
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in again before changing your phone number.");

  const { data, error } = await client.from("profiles")
    .update({ phone_number: phone })
    .eq("id", auth.user.id)
    .select("id, phone_number")
    .single();
  if (error || !data || data.phone_number !== phone) {
    throw new Error("Your phone number could not be saved. Please try again.");
  }
  return data.phone_number;
}