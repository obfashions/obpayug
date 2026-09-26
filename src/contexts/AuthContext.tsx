import { createContext, useContext, useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, safeGetSession, clearCorruptedSession } from "@/lib/supabase";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  role: "merchant" | "admin";
  status: "active" | "pending" | "suspended" | "deactivated";
  email_verified: boolean;
  login_verified_at: string | null;
  login_verification_enabled: boolean;
  support_agent: boolean;
  default_currency?: string | null;
  merchant_profiles?: Array<Record<string, unknown> & { company_name?: string }> | null;
  role_tag: string | null;
  created_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  authError: string | null;
  loginVerified: boolean;
  globalVerificationEnabled: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/*
  Run a promise with a timeout so the UI never freezes.
*/
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([
    promise.then((v) => v as T | "timeout"),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
  ]);
}

/*
  Sleep helper for retry delays.
*/
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [globalVerificationEnabled, setGlobalVerificationEnabled] = useState(true);
  const signOutInProgress = useRef(false);
  // Mirror of `profile` readable from the auth-state listener without
  // re-subscribing on every profile change.
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Derive loginVerified from profile's login_verified_at.
  // Once a user verifies their login, they stay verified until they explicitly
  // sign out (which clears login_verified_at in the database). No 24-hour window
  // — closing the browser or app does NOT require re-verification.
  // MUST be computed synchronously (useMemo) so layout guards never see a stale
  // false value on the same render where profile loads.
  const loginVerified = useMemo(() => {
    return !!profile?.login_verified_at;
  }, [profile?.login_verified_at]);

  const fetchProfile = async (userId: string, retryCount = 0): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data && (data as any).status === "deactivated") {
        await supabase.auth.signOut().catch(() => {});
        if (typeof window !== "undefined") window.location.replace("/login?removed=1");
        return null;
      }
      if (data) return data as Profile;

      // No profile — auto-create with plain INSERT
      if (retryCount > 0) return null; // already tried creating, don't loop

      let authUser: User | null = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        authUser = authData?.user ?? null;
      } catch (err: unknown) {
        // Invalid refresh token or auth error — proceed with what we have
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Invalid Refresh Token") || msg.includes("Refresh Token Not Found")) {
          console.warn("[AuthContext] Refresh token invalid during profile fetch, clearing session.");
          clearCorruptedSession();
        }
      }

      if (!authUser && !retryCount) {
        // Try to get session user as fallback
        const { data: sessionData } = await safeGetSession();
        authUser = sessionData?.session?.user ?? null;
      }

      if (!authUser) return null;

      const email = authUser.email || "";

      const { error: insertErr } = await supabase.from("profiles").insert({
        id: userId,
        email,
        full_name: authUser.user_metadata?.full_name || email.split("@")[0] || "User",
        phone_number: authUser.user_metadata?.phone_number || "",
        role: "merchant",
        status: "active",
      });

      if (insertErr) {
        // Might be a race — try fetching one more time
        const { data: retryData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (retryData) return retryData as Profile;

        console.error("Failed to auto-create profile:", insertErr);
        return null;
      }

      // Fetch the freshly created profile
      const { data: newData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      return (newData as Profile) || null;
    } catch (err) {
      if (retryCount < 2) {
        const delay = 600 * Math.pow(2, retryCount);
        await new Promise((r) => setTimeout(r, delay));
        return fetchProfile(userId, retryCount + 1);
      }
      console.error("Failed to fetch profile:", err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const p = await fetchProfile(user.id);
      if (p) {
        setProfile(p);
      } else {
        setProfileError("Profile not found");
      }
    } catch {
      setProfileError("Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const retryAuth = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await withTimeout(safeGetSession(), 25000);
      if (result === "timeout") {
        setAuthError("Connection timed out. Please check your network and retry.");
        setLoading(false);
        return;
      }
      const s = result?.data?.session ?? null;
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        const p = await withTimeout(fetchProfile(s.user.id), 10000);
        if (p !== "timeout" && p) setProfile(p);
      }
    } catch {
      setAuthError("Unable to connect to authentication service. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch global verification toggle from platform_settings on mount
  // This lets the layout guards know if the admin has disabled verification for everyone
  useEffect(() => {
    const fetchGlobalSetting = () => {
      supabase
        .from("platform_settings")
        .select("require_login_verification")
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setGlobalVerificationEnabled(data.require_login_verification ?? true);
          }
        })
        .then(undefined, () => {}); // silent — default stays true
    };

    fetchGlobalSetting();

    // Refresh every 60 seconds so an admin toggle takes effect without page reload
    const interval = setInterval(fetchGlobalSetting, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Get initial session — with generous timeout so mobile/slow networks don't fail
    withTimeout(safeGetSession(), 25000)
      .then((result) => {
        if (cancelled) return;

        if (result === "timeout") {
          // Don't block the app — just log it and let pages handle auth themselves
          console.warn("[AuthContext] Initial session fetch timed out. User can still log in manually.");
          setAuthError("Connection is slow. You can still log in below.");
          setLoading(false);
          return;
        }

        const initialSession = result?.data?.session ?? null;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setAuthError(null);

        if (initialSession?.user) {
          const uid = initialSession.user.id;
          setTimeout(() => {
            if (cancelled) return;
            withTimeout(fetchProfile(uid), 10000).then((p) => {
              if (cancelled) return;
              if (p !== "timeout" && p) setProfile(p);
            });
          }, 150);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // Supabase unreachable — don't freeze the app, just clear loading
        console.warn("[AuthContext] Initial session fetch failed. App will render anyway.");
        setAuthError("Unable to reach servers. You can still try to log in.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Listen for auth changes — callback must be synchronous (no async/await)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;

      // SIGNED_OUT fires when the refresh token is dead, user explicitly logs out,
      // or the server invalidates the session. Clear everything immediately.
      if (event === "SIGNED_OUT") {
        console.log("[AuthContext] Received SIGNED_OUT event. Clearing auth state.");
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }

      // TOKEN_REFRESHED: session updated internally, just sync the new session
      // INITIAL_SESSION / SIGNED_IN: user just logged in or page loaded with a session
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (!newSession?.user) {
        setProfile(null);
        return;
      }

      // Token refreshes fire roughly hourly and on every tab focus. Re-fetching
      // the profile there caused needless load, and a slow/failed fetch wiped a
      // perfectly good profile — which logged the user out of guarded pages.
      const uid = newSession.user.id;
      if (event === "TOKEN_REFRESHED" && profileRef.current?.id === uid) return;

      withTimeout(fetchProfile(uid), 10000).then((p) => {
        if (cancelled) return;
        if (p !== "timeout" && p) setProfile(p);
        else if (p !== "timeout" && profileRef.current?.id !== uid) setProfile(null);
        // On timeout: keep whatever profile we already have instead of clearing it.
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Prevent double-clicks or concurrent sign-out calls
    if (signOutInProgress.current) {
      console.warn("[AuthContext] Sign-out already in progress, skipping.");
      return;
    }
    signOutInProgress.current = true;

    // Clear login verification timestamp
    if (user?.id) {
      supabase
        .from("profiles")
        .update({ login_verified_at: null })
        .eq("id", user.id)
        .then(() => {})
        .then(undefined, () => {});
    }

    try {
      // Try global sign-out first (invalidates session server-side)
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        console.warn("[AuthContext] Global sign-out failed:", error.message);
        // Fallback: local sign-out just clears local state without server call
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch (err) {
      console.warn("[AuthContext] Sign-out threw, forcing local clear:", err);
      // Force clear local session as last resort
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // If even local fails, manually nuke stored session
        try { localStorage.removeItem("sb-" + import.meta.env.VITE_PUBLIC_SUPABASE_URL + "-auth-token"); } catch { /* noop */ }
      }
    } finally {
      // Always clear React state regardless of network success
      setUser(null);
      setSession(null);
      setProfile(null);
      // loginVerified auto-computes to false when profile becomes null
      // Give the auth client a moment to settle before allowing new operations
      await sleep(300);
      signOutInProgress.current = false;
    }
  };

  // Memoised so every consumer of useAuth() does not re-render on each
  // AuthProvider render (this provider wraps the entire app).
  const value = useMemo<AuthState>(
    () => ({
      user,
      session,
      profile,
      loading,
      profileLoading,
      profileError,
      authError,
      loginVerified,
      globalVerificationEnabled,
      signOut,
      refreshProfile,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user,
      session,
      profile,
      loading,
      profileLoading,
      profileError,
      authError,
      loginVerified,
      globalVerificationEnabled,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}