import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();

  const emailFromParam = searchParams.get("email") || "";
  const email = profile?.email || emailFromParam;

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pageLoading, setPageLoading] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeSentRef = useRef(false);
  const sendAttemptedRef = useRef(false);

  // Wait for auth to load, then send code
  useEffect(() => {
    if (authLoading) return;
    setPageLoading(false);

    if (sendAttemptedRef.current) return;
    sendAttemptedRef.current = true;

    // Small delay to ensure session is fully settled
    const timer = setTimeout(() => {
      sendCode();
    }, 300);

    return () => clearTimeout(timer);
  }, [authLoading, user, email]);

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

  const withTimeout = <T, E = any>(
    promise: Promise<{ data: T | null; error: E | null }>,
    ms: number,
    label: string
  ): Promise<{ data: T | null; error: E | null } | "timeout"> => {
    return Promise.race([
      promise.then((r) => r as { data: T | null; error: E | null }),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), ms)
      ),
    ]);
  };

  const sendCode = async () => {
    if (!user?.id || !email) {
      setError("Session not ready yet. Please refresh the page or try registering again.");
      return;
    }

    setSendingCode(true);
    setError("");

    try {
      const result = await withTimeout(
        supabase.functions.invoke("send-verification-code", {
          body: { user_id: user.id, email, type: "registration" },
        }),
        15000,
        "send-code"
      );

      if (result === "timeout") {
        setError("Request timed out. Please check your connection and try again.");
        codeSentRef.current = false;
        return;
      }

      const { data, error: fnError } = result;

      if (fnError || !data?.success) {
        setError(data?.error || (fnError as any)?.message || "Failed to send verification code. Please try again.");
        // Allow retry by not setting codeSent
        codeSentRef.current = false;
      } else {
        setCodeSent(true);
        setResendCooldown(60);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      codeSentRef.current = false;
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

    // Auto-advance to next input
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
    // Focus last input
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
      setError("Session expired. Please register again.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const result = await withTimeout(
        supabase.functions.invoke("verify-code", {
          body: { user_id: user.id, email, type: "registration", code: fullCode },
        }),
        15000,
        "verify-code"
      );

      if (result === "timeout") {
        setError("Request timed out. Please check your connection and try again.");
        setSubmitting(false);
        return;
      }

      const { data, error: fnError } = result;

      if (fnError || !data?.success) {
        setError(data?.error || (fnError as any)?.message || "Verification failed. Please try again.");
        setSubmitting(false);
        return;
      }

      // Mark login as verified too since they just proved identity
      await supabase
        .from("profiles")
        .update({ login_verified_at: new Date().toISOString() })
        .eq("id", user.id);

      // Update status from pending to active
      await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", user.id)
        .eq("status", "pending");

      await refreshProfile();

      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setSubmitting(false);
    }
  };

  const fullCode = code.join("");

  return (
    <div className="min-h-screen bg-background-50">
      <Navbar />
      <div className="pt-20 md:pt-24 pb-12">
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="bg-background-50 rounded-2xl p-6 md:p-8 border border-background-200/70">
              {pageLoading || authLoading ? (
                <div className="text-center py-8">
                  <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
                  <p className="text-sm text-foreground-500 mt-3">Preparing your verification...</p>
                </div>
              ) : success ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-check-line text-primary-600 text-3xl" />
                  </div>
                  <h1 className="font-heading font-bold text-xl text-foreground-900 mb-2">
                    Email Verified!
                  </h1>
                  <p className="text-sm text-foreground-600">
                    Your account is now active. Redirecting you to your dashboard...
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                      <i className="ri-mail-check-line text-primary-600 text-2xl" />
                    </div>
                    <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-2">
                      Verify Your Email
                    </h1>
                    <p className="text-sm text-foreground-600">
                      We&apos;ve sent a 6-digit verification code to{" "}
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
                    {/* 6-digit inputs */}
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
                          Verify Email
                        </>
                      )}
                    </button>
                  </form>

                  {/* Resend */}
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
                    Didn&apos;t receive the email? Check your spam folder or try a different email address.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}