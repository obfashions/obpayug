import { sendVerificationCode, checkVerificationCode } from "@/lib/verification.functions";
import { getAccessToken } from "@/lib/session-token";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "@/lib/router-compat";
import { oauthReturnPath, withOAuthNext } from "@/lib/oauth-return-path";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/friendly-error";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = oauthReturnPath(searchParams.get("next"));
  const { user, profile, refreshProfile } = useAuth();

  const email = profile?.email || "";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  // True when the code was emailed by the account service instead of the
  // legacy mailer — verification then goes through the auth OTP endpoint.
  const [otpMode, setOtpMode] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeSentRef = useRef(false);

  // If no user session, redirect to login
  useEffect(() => {
    if (!user && !codeSentRef.current) {
      // Give AuthContext a moment to load
      const t = setTimeout(() => {
        if (!user) {
          navigate(withOAuthNext("/login", next), { replace: true });
        }
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [user, navigate]);

  // Check global verification toggle — if admin turned it off, skip this page entirely
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("platform_settings")
      .select("require_login_verification")
      .limit(1)
      .maybeSingle()
      .then(({ data: platformData }) => {
        const globalEnabled = platformData?.require_login_verification ?? true;
        if (!globalEnabled) {
          // Global verification is OFF — mark as verified and redirect
          supabase
            .from("profiles")
            .update({ login_verified_at: new Date().toISOString() })
            .eq("id", user.id)
            .then(() => refreshProfile())
            .then(() => {
              supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle()
                .then(async () => {
                  const [base, members] = await Promise.all([supabase.from("user_roles").select("role").eq("user_id", user.id), supabase.from("member_roles").select("role").eq("user_id", user.id)]);
                  const { staffHome } = await import("@/lib/member-permissions");
                  const dest = staffHome([...(base.data || []), ...(members.data || [])].map((r: { role: string }) => r.role));
                  navigate(next !== "/" ? next : dest, { replace: true, state: { skipVerificationGuard: true } });
                });
            });
        }
      });
  }, [user?.id, navigate, refreshProfile]);

  // Auto-send code on mount
  useEffect(() => {
    if (codeSentRef.current || !user?.id || !email) return;
    codeSentRef.current = true;
    sendCode();
  }, [user?.id, email]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  /**
   * Sends the 6-digit login code. The mailer function on the old backend is
   * unreliable, so if it fails we fall back to the account service's own
   * one-time-code email, which always works.
   */
  const sendCode = async () => {
    if (!user?.id || !email) return;
    setSendingCode(true);
    setError("");

    try {
      const { data, error: fnError } = await (async () => { try { const data = await sendVerificationCode({ data: { accessToken: await getAccessToken(), type: "login" } }); return { data, error: null }; } catch (e: any) { return { data: null, error: e }; } })();

      if (!fnError && data?.success) {
        setOtpMode(false);
        setCodeSent(true);
        setResendCooldown(60);
        return;
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      if (otpError) {
        setError(friendlyError(otpError.message || data?.error || fnError?.message, "We couldn't send the verification code right now. Please try again."));
        return;
      }

      setOtpMode(true);
      setCodeSent(true);
      setResendCooldown(60);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSendingCode(false);
    }
  };


  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (error) setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pasted)) return;
    setCode(pasted.split(""));
    setError("");
    inputRefs.current[5]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    if (!user?.id || !email) {
      setError("Session expired. Please log in again.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (otpMode) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          email,
          token: fullCode,
          type: "email",
        });
        if (otpError) {
          setError(friendlyError(otpError.message, "That code didn't work. Please check it and try again."));
          setSubmitting(false);
          return;
        }
        await supabase.from("profiles").update({ login_verified_at: new Date().toISOString() }).eq("id", user.id);
      } else {
        const { data, error: fnError } = await (async () => { try { const data = await checkVerificationCode({ data: { accessToken: await getAccessToken(), type: "login", code: fullCode } }); return { data, error: null }; } catch (e: any) { return { data: null, error: e }; } })();

        if (fnError || !data?.success) {
          setError(friendlyError(data?.error || fnError?.message, "That code didn't work. Please check it and try again."));
          setSubmitting(false);
          return;
        }
      }

      // Refresh profile so AuthContext picks up login_verified_at
      await refreshProfile();


      // Determine redirect
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const [baseRoles, memberRoles] = await Promise.all([supabase.from("user_roles").select("role").eq("user_id", user.id), supabase.from("member_roles").select("role").eq("user_id", user.id)]);
      const { staffHome } = await import("@/lib/member-permissions");
      navigate(next !== "/" ? next : staffHome([...(baseRoles.data || []), ...(memberRoles.data || [])].map((r: { role: string }) => r.role)), { replace: true });
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  const fullCode = code.join("");

  // Show loading while waiting for session
  if (!user || !email) {
    return (
      <div className="min-h-screen bg-background-50">
        <Navbar />
        <div className="pt-24 flex items-center justify-center">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-primary-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <Navbar />
      <div className="pt-20 md:pt-24 pb-12">
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="bg-background-50 rounded-2xl p-6 md:p-8 border border-background-200/70">
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-shield-keyhole-line text-primary-600 text-2xl" />
                </div>
                <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-2">
                  Verify Your Login
                </h1>
                <p className="text-sm text-foreground-600">
                  For security, we&apos;ve sent a 6-digit code to{" "}
                  <strong className="text-foreground-900">{email}</strong>
                </p>
                {!codeSent && !sendingCode && (
                  <p className="text-xs text-foreground-500 mt-2">
                    Check your spam folder if you don&apos;t see it.
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-accent-100 border border-accent-200">
                  <p className="text-sm text-accent-800">{error}</p>
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-5">
                <div className="flex justify-center gap-2">
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      onPaste={i === 0 ? handlePaste : undefined}
                      className="w-12 h-14 text-center text-xl font-bold text-foreground-900 bg-background-50 border-2 border-background-300/60 rounded-lg focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-400/30 transition-all"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={submitting || fullCode.length !== 6}
                  className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  {submitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="ri-shield-check-line" />
                      Verify &amp; Continue
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-4">
                {sendingCode ? (
                  <p className="text-sm text-foreground-500 flex items-center justify-center gap-1.5">
                    <i className="ri-loader-4-line animate-spin" />
                    Sending code...
                  </p>
                ) : resendCooldown > 0 ? (
                  <p className="text-sm text-foreground-500">
                    Resend code in {resendCooldown}s
                  </p>
                ) : (
                  <button
                    onClick={sendCode}
                    className="text-sm text-primary-500 hover:text-primary-600 font-medium cursor-pointer whitespace-nowrap"
                  >
                    Resend verification code
                  </button>
                )}
              </div>

              <p className="text-center text-xs text-foreground-500 mt-4">
                Didn&apos;t receive the email? Check your spam folder.
              </p>

              <div className="mt-6 pt-4 border-t border-background-200/70 text-center">
                <button
                  onClick={async () => {
                    await supabase.auth.signOut({ scope: "local" });
                    navigate(withOAuthNext("/login", next), { replace: true });
                  }}
                  className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer whitespace-nowrap"
                >
                  Cancel and return to login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}