import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check VITE_PUBLIC_SUPABASE_URL and VITE_PUBLIC_SUPABASE_ANON_KEY.");
}

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/*
  Safe getSession: wraps supabase.auth.getSession() with a catch for
  the "Invalid Refresh Token" error. When the refresh token is dead,
  we clear the corrupted session from localStorage and return null
  instead of letting the error crash the app.
*/
export async function safeGetSession(): Promise<ReturnType<typeof supabase.auth.getSession>> {
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