import { useEffect, useState } from "react";
import { MONEY_COUNTRIES } from "@/lib/countries";
import { getEnabledCurrencies } from "@/lib/currencies.functions";
import { Link, useNavigate } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/lib/friendly-error";

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    currency: "UGX",
    website: "",
    password: "",
    confirm_password: "",
  });
  const [honeypot, setHoneypot] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [enabled, setEnabled] = useState<string[]>(["UGX"]);
  useEffect(() => {
    getEnabledCurrencies().then((r) => setEnabled(r.currencies)).catch(() => {});
  }, []);
  const countries = MONEY_COUNTRIES.filter((c) => enabled.includes(c.currency));
  const selectedCountry = countries.find((country) => country.currency === formData.currency);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = "Phone number is required";
    } else if (formData.phone_number.length < 10) {
      newErrors.phone_number = "Please enter a valid phone number";
    }
    // Website is optional — only validated when the merchant actually enters one.
    const website = formData.website.trim();
    if (website && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/i.test(website)) {
      newErrors.website = "Please enter a valid website (e.g. yourbusiness.com)";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }
    if (!agreed) newErrors.agreed = "You must agree to the terms";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim()) return;
    if (!validate()) return;

    setSubmitting(true);
    setServerError("");

    // ── Pre-flight: check if Supabase is reachable ──
    // If Supabase blocks the origin (production domain not whitelisted),
    // this will fail immediately instead of hanging for 15 seconds.
    const preflightOk = await checkSupabaseConnectivity();
    if (!preflightOk) {
      setServerError(
        "Cannot reach our authentication servers. This usually happens when the site domain is not yet configured in Supabase. Please contact support or try again in a few minutes."
      );
      setSubmitting(false);
      return;
    }

    // ── Sign up ──
    const TIMEOUT_MS = 15000;
    const redirectTo = `${window.location.origin}/verify-email?email=${encodeURIComponent(formData.email)}`;

    const signupPromise = supabase.auth.signUp({
      email: formData.email.normalize("NFKC").replace(/[\s\u200B-\u200D\u2060\uFEFF\u00A0]/g, "").toLowerCase(),
      password: formData.password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          default_currency: formData.currency,
          enabled_currencies: [formData.currency],
          operating_country: selectedCountry?.country || "Uganda",
          // Optional — stored on the auth user's metadata only when provided.
          ...(formData.website.trim() ? { website: formData.website.trim() } : {}),
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Request timed out. Please check your connection and try again.")),
        TIMEOUT_MS
      )
    );

    let data, error;
    try {
      const result = await Promise.race([signupPromise, timeoutPromise]);
      data = result.data;
      error = result.error;
    } catch (timeoutErr: any) {
      const msg = timeoutErr?.message || "";
      if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
        setServerError(
          "Network error. Our servers may be temporarily unavailable, or your domain may not be allowed in Supabase yet. Please try again shortly."
        );
      } else {
        setServerError(msg || "Request timed out. Please check your connection and try again.");
      }
      setSubmitting(false);
      return;
    }

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("already exists")) {
        setServerError("An account with this email already exists. Please log in instead.");
      } else if (error.message.includes("rate") || error.message.includes("limit")) {
        setServerError("Too many attempts. Please wait a moment and try again.");
      } else if (error.message.includes("weak")) {
        setServerError("Password is too weak. Try using a mix of letters, numbers, and symbols.");
      } else if (
        error.message.includes("origin") ||
        error.message.includes("not allowed") ||
        error.message.includes("domain") ||
        error.message.includes("CORS")
      ) {
        setServerError(
          "This domain is not yet configured in our authentication system. Please contact support to whitelist this domain."
        );
      } else {
        setServerError(friendlyError(error, "We couldn't create your account. Please try again."));
      }
      setSubmitting(false);
      return;
    }

    if (!data?.user) {
      setServerError("Something went wrong creating your account. Please try again.");
      setSubmitting(false);
      return;
    }

    // Wait a tick for the auth session to propagate before navigating
    // This prevents the verify-email page from mounting before AuthContext picks up the session
    await new Promise((r) => setTimeout(r, 500));

    // Create the profile record
    const profilePayload = {
      id: data.user.id,
      email: formData.email,
      full_name: formData.full_name,
      phone_number: formData.phone_number,
      default_currency: formData.currency,
      enabled_currencies: [formData.currency],
      operating_country: selectedCountry?.country || "Uganda",
      role: "merchant",
      status: "pending",
      email_verified: false,
    };

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id", ignoreDuplicates: false });

      if (profileError) {
        console.warn(
          "Profile insert deferred (RLS may require authenticated session):",
          profileError.message
        );
      }
    } catch (profileErr: any) {
      console.warn("Profile creation deferred:", profileErr?.message || profileErr);
    }

    // Navigate to email verification
    navigate(`/verify-email?email=${encodeURIComponent(formData.email)}`);
  };

  const inputClass = (field: string) =>
    `w-full px-4 py-2.5 rounded-lg border bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-colors ${
      errors[field] ? "border-accent-500" : "border-background-300/60"
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
                  <i className="ri-user-add-line text-primary-600 text-2xl" />
                </div>
                <h1 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-2">
                  Create Your Account
                </h1>
                <p className="text-sm text-foreground-600">
                  Start accepting payments in minutes
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
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    className={inputClass("full_name")}
                    placeholder="John Mukasa"
                  />
                  {errors.full_name && (
                    <p className="text-xs text-accent-600 mt-1">{errors.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={inputClass("email")}
                    placeholder="john@company.com"
                  />
                  {errors.email && (
                    <p className="text-xs text-accent-600 mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Country
                  </label>
                  <select
                    name="country"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className={inputClass("currency")}
                  >
                    {countries.map((c) => (
                      <option key={c.currency} value={c.currency}>
                        {c.flag} {c.country} ({c.currency})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-foreground-500 mt-1">
                    Your {selectedCountry?.country || "country"} account will open with a {formData.currency} wallet as its main currency.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={(e) =>
                      setFormData({ ...formData, phone_number: e.target.value })
                    }
                    className={inputClass("phone_number")}
                    placeholder="+256 712 345 678"
                  />
                  {errors.phone_number && (
                    <p className="text-xs text-accent-600 mt-1">{errors.phone_number}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Website URL{" "}
                    <span className="font-normal text-foreground-500">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="website"
                    inputMode="url"
                    autoComplete="url"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                    className={inputClass("website")}
                    placeholder="yourbusiness.com"
                  />
                  {errors.website ? (
                    <p className="text-xs text-accent-600 mt-1">{errors.website}</p>
                  ) : (
                    <p className="text-xs text-foreground-500 mt-1">
                      You can add this later from your dashboard.
                    </p>
                  )}
                </div>



                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className={inputClass("password")}
                    placeholder="Min 8 characters"
                  />
                  {errors.password && (
                    <p className="text-xs text-accent-600 mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={(e) =>
                      setFormData({ ...formData, confirm_password: e.target.value })
                    }
                    className={inputClass("confirm_password")}
                    placeholder="Repeat your password"
                  />
                  {errors.confirm_password && (
                    <p className="text-xs text-accent-600 mt-1">{errors.confirm_password}</p>
                  )}
                </div>

                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-background-300/60 text-primary-500 focus:ring-primary-400"
                  />
                  <label htmlFor="terms" className="text-xs text-foreground-600 leading-relaxed">
                    I agree to the{" "}
                    <Link to="#" className="text-primary-500 hover:text-primary-600">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="#" className="text-primary-500 hover:text-primary-600">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
                {errors.agreed && (
                  <p className="text-xs text-accent-600 -mt-2">{errors.agreed}</p>
                )}

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
                      Creating account...
                    </>
                  ) : (
                    <>
                      <i className="ri-user-add-line" />
                      Create Account
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-sm text-foreground-600 mt-6">
                Already have an account?{" "}
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

/**
 * Quick connectivity check: tries to fetch a single row from platform_settings.
 * If this fails, Supabase is unreachable (CORS block, network issue, etc.)
 * and we want to tell the user immediately instead of hanging on signUp.
 */
async function checkSupabaseConnectivity(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("platform_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    // If there's a CORS/network error, supabase-js may throw
    // or return an error object; either way treat as unreachable.
    return !error;
  } catch {
    return false;
  }
}