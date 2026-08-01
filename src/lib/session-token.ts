import { supabase, safeGetSession } from "@/lib/supabase";

/**
 * Returns the signed-in merchant's access token, waiting briefly while the
 * session is still being restored from storage. Pages mount before Supabase
 * finishes hydrating, which used to surface a false "Please sign in again".
 */
export async function getAccessToken(waitMs = 6000): Promise<string> {
  const deadline = Date.now() + waitMs;

  for (;;) {
    try {
      const { data } = await safeGetSession();
      const session = data?.session;
      if (session?.access_token) {
        const expiresAt = (session.expires_at || 0) * 1000;
        if (expiresAt && expiresAt - Date.now() < 30_000) {
          const { data: refreshed } = await supabase.auth.refreshSession();
          return refreshed?.session?.access_token || session.access_token;
        }
        return session.access_token;
      }
    } catch {
      /* retry below */
    }

    if (Date.now() >= deadline) return "";
    await new Promise((r) => setTimeout(r, 250));
  }
}
