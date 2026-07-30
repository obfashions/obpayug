import { useState } from "react";
import { Link } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/friendly-error";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setSending(true);
    setError("");

    try {
      const redirectUrl = `${window.location.origin}/login`;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (resetErr) {
        setError(friendlyError(resetErr, "We couldn't send the reset email. Please try again in a moment."));
        setSending(false);
        return;
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(friendlyError(err, "We couldn't reach the server. Please check your connection and try again."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <Navbar />
      <div className="pt-20 md:pt-24 pb-12">
        <div className="w-full px-4 md:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <div className="bg-background-50 rounded-2xl p-6 md:p-8 border border-background-200/70">
              {!submitted ? (
                <>
                  <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                      <i className="ri-lock-unlock-line text-primary-600 text-2xl" />
                    </div>
                    <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-2">
                      Reset Password
                    </h1>
                    <p className="text-sm text-foreground-600">
                      Enter your email and we'll send you a link to reset your password.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError("");
                        }}
                        className={`w-full px-4 py-2.5 rounded-lg border bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-colors ${
                          error ? "border-accent-500" : "border-background-300/60"
                        }`}
                        placeholder="john@company.com"
                      />
                      {error && (
                        <p className="text-xs text-accent-600 mt-1">{error}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      {sending ? (
                        <>
                          <i className="ri-loader-4-line animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <i className="ri-mail-send-line" />
                          Send Reset Link
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-mail-check-line text-primary-600 text-2xl" />
                  </div>
                  <h2 className="font-heading font-bold text-xl text-foreground-900 mb-2">
                    Check Your Email
                  </h2>
                  <p className="text-sm text-foreground-600 mb-6">
                    We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and follow the instructions.
                  </p>
                  <Link
                    to="/login"
                    className="text-sm font-medium text-primary-500 hover:text-primary-600"
                  >
                    Back to Login
                  </Link>
                </div>
              )}

              <p className="text-center text-sm text-foreground-600 mt-6">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="text-primary-500 hover:text-primary-600 font-medium"
                >
                  Log In
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