import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/friendly-error";
import { useAuth } from "@/contexts/AuthContext";

function isNetworkError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("timeout") ||
    lower.includes("abort") ||
    lower.includes("unreachable")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Login() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = (value: string): boolean => /^\+?[\d\s\-()]{7,20}$/.test(value);

  const normalizedIdentifier = () => identifier
    .normalize("NFKC")
    .replace(/[\s\u200B-\u200D\u2060\uFEFF\u00A0]/g, "")
    .toLowerCase();

  const validate = (): boolean => {
    let valid = true;
    const cleaned = normalizedIdentifier();
    if (!cleaned) {
      setIdentifierError("Email or phone number is required");
      valid = false;
    } else if (!isEmail(cleaned) && !isPhone(cleaned)) {
      setIdentifierError("Enter a valid email address or phone number");
      valid = false;
    } else {
      setIdentifierError("");
    }
    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else {
      setPasswordError("");
    }
    return valid;
  };

  const attemptLogin = async (
    email: string,
    pwd: string,
    attempt: number,
    maxAttempts: number,
  ): Promise<{ ok: true; userId: string } | { ok: false; error: string; retryable: boolean }> => {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password: pwd,
        });

      if (authError) {
        const msg = authError.message;
        const retryable = isNetworkError(msg);
        // If it's a network error and we still have retries left, signal retry
        if (retryable && attempt < maxAttempts) {
          return { ok: false, error: msg, retryable: true };
        }
        // Otherwise return the error
        if (msg.toLowerCase().includes("email not confirmed")) {
          return { ok: false, error: "Please confirm your email address before logging in.", retryable: false };
        }
        return { ok: false, error: msg, retryable: false };
      }

      if (!authData?.user) {
        return { ok: false, error: "Login succeeded but no user data returned. Please try again.", retryable: false };
      }

      return { ok: true, userId: authData.user.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      const retryable = isNetworkError(msg);
      if (retryable && attempt < maxAttempts) {
        return { ok: false, error: msg, retryable: true };
      }
      return { ok: false, error: msg, retryable: false };
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (honeypot.trim()) return;
    if (!validate()) return;

    setSubmitting(true);
    setServerError("");

    // Validate and submit the same cleaned address, including pasted invisible characters.
    const email = normalizedIdentifier();
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await attemptLogin(email, password, attempt, maxAttempts);

      if (result.ok) {
        const userId = result.userId;

        // Authentication can succeed for an account that an admin has since blocked.
        const { data: account, error: accountError } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", userId)
          .maybeSingle();
        if (accountError || !account || account.status === "suspended" || account.status === "deactivated") {
          await supabase.auth.signOut({ scope: "local" });
          setServerError(account?.status === "suspended" ? "This account is suspended. Please contact support." : account?.status === "deactivated" ? "This account is no longer available. Please contact support." : "We couldn't check your account right now. Please try again.");
          setSubmitting(false);
          return;
        }

        // Fire-and-forget audit log
        supabase
          .from("audit_logs")
          .insert({
            user_id: userId,
            user_name: email,
            action: "login",
            resource: "session",
            details: {},
          })
          .then(() => {})
          .then(undefined, () => {});

        // Check if login verification is enabled for this merchant
        // 1. Check the global platform setting first (admin master switch)
        // 2. Then check the per-user profile setting
        const { data: platformData } = await supabase
          .from("platform_settings")
          .select("require_login_verification")
          .limit(1)
          .maybeSingle();

        const globalVerificationEnabled = platformData?.require_login_verification ?? true;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("login_verification_enabled, role")
          .eq("id", userId)
          .maybeSingle();

        const userVerificationEnabled = profileData?.login_verification_enabled ?? true;
        const userRole = profileData?.role || "merchant";

        // Verification is required ONLY if BOTH global and user-level settings say so
        const verificationRequired = globalVerificationEnabled && userVerificationEnabled;

        if (verificationRequired) {
          // Go through the verification code flow
          navigate("/verify-login", { replace: true });
        } else {
          // Skip verification — mark as verified in DB, refresh profile in context, then redirect
          await supabase
            .from("profiles")
            .update({ login_verified_at: new Date().toISOString() })
            .eq("id", userId);

          // Force AuthContext to re-fetch the profile so loginVerified becomes true
          // This prevents the layout guards from redirecting back to verify-login
          await refreshProfile();

          if (userRole === "admin") {
            navigate("/admin", { replace: true, state: { skipVerificationGuard: true } });
          } else {
            navigate("/dashboard", { replace: true, state: { skipVerificationGuard: true } });
          }
        }
        setSubmitting(false);
        return;
      }

      // Login failed
      if (result.retryable && attempt < maxAttempts) {
        // Wait with exponential backoff before retrying (500ms, 1000ms)
        await sleep(500 * attempt);
        continue;
      }

      // Non-retryable error or exhausted all retries
      const finalMsg = result.error;
      if (isNetworkError(finalMsg)) {
        setServerError(
          "Network error. Please check your internet connection and try again."
        );
      } else {
        setServerError(friendlyError(finalMsg, "We couldn't sign you in. Please try again."));
      }
      setSubmitting(false);
      return;
    }

    // Should never reach here, but just in case
    setServerError("Unable to log in. Please try again.");
    setSubmitting(false);
  };

  const inputClass = (hasError: boolean) =>
    `w-full px-4 py-2.5 rounded-lg border bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-colors ${
      hasError ? "border-accent-500" : "border-background-300/60"
    }`;

  return (
    <div className="min-h-screen bg-background-50">
      <Navbar />
      <div className="pt-20 md:pt-24 pb-12">
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="bg-background-50 rounded-2xl p-6 md:p-8 border border-background-200/70">
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-login-box-line text-primary-600 text-2xl" />
                </div>
                <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-2">
                  Welcome Back
                </h1>
                <p className="text-sm text-foreground-600">
                  Log in to your merchant account
                </p>
              </div>

              {serverError && (
                <div className="mb-4 p-3 rounded-lg bg-accent-100 border border-accent-200">
                  <p className="text-sm text-accent-800">{serverError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Email or Phone Number
                  </label>
                  <input
                    type="text"
                    name="identifier"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (identifierError) setIdentifierError("");
                    }}
                    className={inputClass(!!identifierError)}
                    placeholder="john@company.com or +1 555 123 4567"
                    autoComplete="username"
                  />
                  {identifierError && (
                    <p className="text-xs text-accent-600 mt-1">{identifierError}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    className={inputClass(!!passwordError)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  {passwordError && (
                    <p className="text-xs text-accent-600 mt-1">
                      {passwordError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-background-300/60 text-primary-500 focus:ring-primary-400"
                    />
                    <label
                      htmlFor="remember"
                      className="text-sm text-foreground-600"
                    >
                      Remember me
                    </label>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary-500 hover:text-primary-600"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Honeypot */}
                <input
                  type="text"
                  name="company_alt"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hp-field"
                />

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <i className="ri-login-box-line" />
                      Log In
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-foreground-600 mt-6">
                Don&apos;t have an account?{" "}
                <Link
                  to="/register"
                  className="text-primary-500 hover:text-primary-600 font-medium"
                >
                  Get Started
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}