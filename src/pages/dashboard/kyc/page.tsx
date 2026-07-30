import { useState, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { invokeEdgeFunction } from "@/lib/edge-function";
import { useAuth } from "@/contexts/AuthContext";

const countries = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Ghana", "Cameroon"];
const MAX_UPLOAD = 4 * 1024 * 1024;

/** Downscale + compress an image file into a data URL under ~1.5MB. */
async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files (JPG or PNG) are accepted.");
  }

  const readAsDataUrl = (f: File | Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(f);
    });

  const original = await readAsDataUrl(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Invalid image"));
      el.src = original;
    });

    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let quality = 0.82;
    let out = canvas.toDataURL("image/jpeg", quality);
    while (out.length * 0.75 > 1.5 * 1024 * 1024 && quality > 0.4) {
      quality -= 0.12;
      out = canvas.toDataURL("image/jpeg", quality);
    }
    return out;
  } catch {
    if (file.size > MAX_UPLOAD) {
      throw new Error("Image is too large. Please use a photo under 4MB.");
    }
    return original;
  }
}

type Side = "front" | "back";

export default function KYCPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const frontInput = useRef<HTMLInputElement>(null);
  const backInput = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    country: "Uganda",
    business_address: "",
    national_id: "",
  });
  const [docs, setDocs] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null,
  });
  const [names, setNames] = useState<{ front: string; back: string }>({ front: "", back: "" });
  const [preparing, setPreparing] = useState<Side | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const complianceEmail = "compliance@obpay.online";

  const handleFile = async (side: Side, file?: File | null) => {
    if (!file) return;
    setError("");
    setPreparing(side);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setDocs((d) => ({ ...d, [side]: dataUrl }));
      setNames((n) => ({ ...n, [side]: file.name }));
    } catch (err: any) {
      setError(err?.message || "Could not process that image.");
    } finally {
      setPreparing(null);
    }
  };

  const canSubmit =
    !!formData.company_name &&
    !!formData.business_address &&
    !!formData.national_id &&
    !!docs.front &&
    !!docs.back &&
    !preparing;

  const handleSubmit = async () => {
    if (!user) {
      setError("Please log in and try again.");
      return;
    }
    setSaving(true);
    setError("");

    const res = await invokeEdgeFunction("kyc-submit", {
      ...formData,
      frontBase64: docs.front,
      backBase64: docs.back,
      frontFileName: names.front || "front.jpg",
      backFileName: names.back || "back.jpg",
    });

    setSaving(false);

    if (res?.success) {
      setSubmitted(true);
      return;
    }
    setError(res?.error || "Submission failed. Please try again.");
  };

  const handleSkip = () => navigate("/dashboard");

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto text-center py-12 sm:py-16 px-1">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-check-line text-primary-600 text-3xl sm:text-4xl" />
          </div>
          <h2 className="font-heading font-bold text-xl sm:text-3xl text-foreground-900 mb-3">
            Documents Submitted
          </h2>
          <p className="text-sm sm:text-base text-foreground-600 mb-2 max-w-md mx-auto">
            Your business details and ID documents were uploaded securely and are now with our
            compliance team for review.
          </p>
          <p className="text-sm text-foreground-500 mb-8">
            Reviews are usually completed within 24-48 hours. You can keep using your dashboard in
            the meantime.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
          >
            <i className="ri-dashboard-line" />
            Go to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const renderUpload = (side: Side, label: string) => {
    const ref = side === "front" ? frontInput : backInput;
    const value = docs[side];
    return (
      <div key={side} className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-foreground-700 mb-1.5">
          {label} <span className="text-accent-500">*</span>
        </label>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(side, e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-background-300/70 bg-background-100 hover:border-primary-400 transition-colors p-4 text-center cursor-pointer"
        >
          {preparing === side ? (
            <span className="flex flex-col items-center gap-2 py-6 text-sm text-foreground-600">
              <i className="ri-loader-4-line animate-spin text-xl" />
              Preparing image…
            </span>
          ) : value ? (
            <span className="block">
              <img
                src={value}
                alt={`${label} preview`}
                loading="lazy"
                decoding="async"
                className="w-full h-32 sm:h-36 object-cover rounded-lg mb-2"
              />
              <span className="text-xs text-primary-600 font-medium inline-flex items-center gap-1">
                <i className="ri-refresh-line" /> Tap to replace
              </span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 py-6 text-sm text-foreground-600">
              <i className="ri-camera-line text-2xl text-foreground-400" />
              Tap to upload or take a photo
              <span className="text-xs text-foreground-400">JPG or PNG, max 4MB</span>
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-sm font-medium text-foreground-700">Step 1 of 1</span>
            <span className="text-xs text-foreground-500">Business Verification</span>
          </div>
          <div className="w-full h-2 bg-background-200/70 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full transition-all duration-500 w-full" />
          </div>
        </div>

        <div className="bg-background-50 rounded-2xl p-4 sm:p-8 border border-background-200/70">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-accent-100 border border-accent-200">
              <div className="flex gap-3">
                <i className="ri-error-warning-line text-accent-600 text-lg shrink-0 mt-0.5" />
                <p className="text-sm text-accent-800 font-medium break-words">{error}</p>
              </div>
            </div>
          )}

          <h2 className="font-heading font-bold text-lg sm:text-2xl text-foreground-900 mb-2">
            Business Verification
          </h2>
          <p className="text-sm text-foreground-600 mb-6">
            Fill in your business details and upload both sides of your National ID or Passport. Our
            compliance team receives them instantly.
          </p>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Company / Business Name <span className="text-accent-500">*</span>
              </label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-base sm:text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
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
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-base sm:text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent appearance-none cursor-pointer"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
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
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-base sm:text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none"
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
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-base sm:text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                placeholder="e.g. CM123456789"
              />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground-900 mb-3">
              Identity Documents
            </h3>
            <div className="flex flex-col sm:flex-row gap-4">
              {renderUpload("front", "Front of ID")}
              {renderUpload("back", "Back of ID")}
            </div>
          </div>

          <div className="bg-secondary-50 rounded-lg p-4 flex gap-3 mb-6">
            <i className="ri-information-line text-secondary-600 text-lg shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground-800 mb-1">Why do we need this?</p>
              <p className="text-xs text-foreground-600 leading-relaxed">
                KYC verification is required by financial regulations to prevent fraud and money
                laundering. Documents are stored securely and only reviewed by our compliance team.
                Having trouble uploading? Email {complianceEmail}.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-background-200/70">
            <button
              onClick={handleSkip}
              className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer py-2"
            >
              Skip for now
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || saving}
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer w-full sm:w-auto"
            >
              {saving ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <i className="ri-upload-cloud-2-line" />
                  Submit Documents
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
