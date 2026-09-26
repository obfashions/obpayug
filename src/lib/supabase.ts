import { supabase as cloudClient } from "@/integrations/supabase/client";

export function clearCorruptedSession() {
  // Nuke the stored session when the refresh token is dead
  // Supabase stores tokens in localStorage under a key like "sb-<project-ref>-auth-token"
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage may be unavailable in some environments
  }
}

// All accounts and data now live in this project's own backend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = cloudClient;

/*
  Safe getSession: wraps supabase.auth.getSession() with a catch for
  the "Invalid Refresh Token" error. When the refresh token is dead,
  we clear the corrupted session from localStorage and return null
  instead of letting the error crash the app.
*/
export async function safeGetSession(): Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>> {
  try {
    return await supabase.auth.getSession();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Invalid Refresh Token") || message.includes("Refresh Token Not Found")) {
      console.warn("[supabase] Refresh token is invalid or expired. Clearing session.");
      clearCorruptedSession();
      // Return a "no session" result so the app treats the user as logged out
      return { data: { session: null }, error: null };
    }
    // Re-throw other errors (network issues, etc.)
    throw err;
  }
}