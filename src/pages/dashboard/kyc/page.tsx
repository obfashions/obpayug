import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

const countries = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Ghana", "Cameroon"];

export default function KYCPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    company_name: "",
    country: "Uganda",
    business_address: "",
    national_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const complianceEmail = "compliance@obpay.online";

  const buildMailtoLink = () => {
    const subject = encodeURIComponent("KYC Documents Submission");
    const body = encodeURIComponent(
      `Please find my verification documents attached.\n\n` +
      `Registered Email: ${user?.email || "(enter your account email)"}\n` +
      `Company Name: ${formData.company_name}\n` +
      `Country: ${formData.country}\n` +
      `Business Address: ${formData.business_address}\n` +
      `National ID Number: ${formData.national_id}\n\n` +
      `Attachments: Front and back of National ID / Passport`
    );
    return `mailto:${complianceEmail}?subject=${subject}&body=${body}`;
  };

  const handleEmailSubmit = async () => {
    if (!user) {
      setError("Please log in and try again.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Save profile data — marks account as pending verification
      const { error: dbError } = await supabase
        .from("merchant_profiles")
        .upsert(
          {
            user_id: user.id,
            company_name: formData.company_name,
            country: formData.country,
            business_address: formData.business_address,
            national_id: formData.national_id,
            verification_status: "pending",
          },
          { onConflict: "user_id" }
        );

      if (dbError) {
        console.error("[KYC] Save error:", dbError);
        setError("Failed to save your details: " + dbError.message);
        setSaving(false);
        return;
      }

      setSaving(false);
      setSubmitted(true);

      // Open the email client
      window.location.href = buildMailtoLink();
    } catch (err: any) {
      console.error("[KYC] Error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto text-center py-16">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <i className="ri-mail-check-line text-primary-600 text-4xl" />
          </div>
          <h2 className="font-heading font-bold text-2xl md:text-3xl text-foreground-900 mb-3">
            Verification Started
          </h2>
          <p className="text-base text-foreground-600 mb-2 max-w-md mx-auto">
            Your account has been marked for verification. Your email app should have opened — please attach clear photos of both sides of your National ID or Passport and send the email.
          </p>
          <p className="text-sm text-foreground-500 mb-2">
            Our compliance team reviews submissions within 24-48 hours.
          </p>
          <p className="text-sm text-foreground-500 mb-8">
            You can use all features while your verification is pending.
          </p>

          {!user?.email && (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3 mb-6 max-w-md mx-auto">
              <i className="ri-information-line mr-1" />
              We could not detect your account email. Please make sure to include it in the email body.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={buildMailtoLink()}
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-mail-send-line" />
              Open Email Again
            </a>
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center justify-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold px-6 py-3 rounded-lg border border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-dashboard-line" />
              Go to Dashboard
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground-700">
              Step 1 of 1
            </span>
            <span className="text-xs text-foreground-500">
              Business Verification
            </span>
          </div>
          <div className="w-full h-2 bg-background-200/70 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-500 w-full" />
          </div>
        </div>

        <div className="bg-background-50 rounded-2xl p-6 md:p-8 border border-background-200/70">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-accent-100 border border-accent-200">
              <div className="flex gap-3">
                <i className="ri-error-warning-line text-accent-600 text-lg shrink-0 mt-0.5" />
                <p className="text-sm text-accent-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-2">
            Business Verification
          </h2>
          <p className="text-sm text-foreground-600 mb-6">
            Fill in your business details below. You will then send your ID documents via email to complete verification.
          </p>

          {/* --- Business Info Fields --- */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Company / Business Name <span className="text-accent-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="e.g. Kampala Mart Ltd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Country <span className="text-accent-500">*</span>
              </label>
              <select
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent appearance-none cursor-pointer"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Business Address <span className="text-accent-500">*</span>
              </label>
              <textarea
                value={formData.business_address}
                onChange={(e) => setFormData({ ...formData, business_address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
                placeholder="Plot 42, Kampala Road, Kampala, Uganda"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                National ID Number <span className="text-accent-500">*</span>
              </label>
              <input
                type="text"
                value={formData.national_id}
                onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="e.g. CM123456789"
              />
            </div>
          </div>

          {/* --- Email submission card --- */}
          <div className="bg-background-100 rounded-xl p-5 border border-background-200/70 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <i className="ri-mail-send-line text-primary-600 text-xl" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground-900 mb-1">
                  Submit Documents via Email
                </h3>
                <p className="text-xs text-foreground-600 leading-relaxed mb-3">
                  Click the button below and your account will be marked for verification. Your email app will open with a pre-filled message — just attach clear photos of the <strong>front and back</strong> of your National ID or Passport, then hit send.
                </p>
                <div className="flex items-center gap-2 text-xs text-foreground-500 bg-background-50 rounded-lg px-3 py-2">
                  <i className="ri-at-line text-foreground-400" />
                  <span>{complianceEmail}</span>
                </div>
              </div>
            </div>
          </div>

          {/* --- Why we need this --- */}
          <div className="bg-secondary-50 rounded-lg p-4 flex gap-3 mb-6">
            <i className="ri-information-line text-secondary-600 text-lg shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground-800 mb-1">Why do we need this?</p>
              <p className="text-xs text-foreground-600 leading-relaxed">
                KYC verification is required by financial regulations to prevent fraud and money laundering. All submitted documents are handled securely by our compliance team.
              </p>
            </div>
          </div>

          {/* --- Action buttons --- */}
          <div className="flex justify-between items-center pt-2 border-t border-background-200/70">
            <button
              onClick={handleSkip}
              className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer"
            >
              Skip for now
            </button>
            <button
              onClick={handleEmailSubmit}
              disabled={saving || !formData.company_name || !formData.business_address || !formData.national_id}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {saving ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="ri-mail-send-line" />
                  Submit via Email
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}