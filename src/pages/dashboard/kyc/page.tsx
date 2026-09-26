import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";
import { useAuth } from "@/contexts/AuthContext";

const countries = ["Uganda", "Kenya", "Tanzania", "Rwanda", "Ghana", "Cameroon"];
const MAX_UPLOAD = 4 * 1024 * 1024;

const readAsDataUrl = (f: File | Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(f);
  });

/** Images are downscaled + compressed; PDFs are sent as-is (max 4MB). */
async function fileToDataUrl(file: File, allowPdf: boolean): Promise<string> {
  if (file.type === "application/pdf") {
    if (!allowPdf) throw new Error("Please upload a photo (JPG or PNG) of your ID.");
    if (file.size > MAX_UPLOAD) throw new Error("PDF is too large. Please use a file under 4MB.");
    return readAsDataUrl(file);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(allowPdf ? "Upload a JPG, PNG or PDF file." : "Only image files (JPG or PNG) are accepted.");
  }
  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Invalid image"));
      el.src = original;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
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
    if (file.size > MAX_UPLOAD) throw new Error("Image is too large. Please use a photo under 4MB.");
    return original;
  }
}

type AccountType = "personal" | "business";
interface DocSlot { key: string; label: string; required: boolean; pdf: boolean }

const SLOTS: Record<AccountType, DocSlot[]> = {
  personal: [
    { key: "national_id_front", label: "Front of National ID", required: true, pdf: false },
    { key: "national_id_back", label: "Back of National ID", required: true, pdf: false },
  ],
  business: [
    { key: "business_registration_certificate", label: "Certificate of Registration / Incorporation", required: true, pdf: true },
    { key: "business_registration_extra", label: "Other registration document (e.g. TIN, Form 20) — optional", required: false, pdf: true },
  ],
};

const inputCls =
  "w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-base sm:text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent";

export default function KYCPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [formData, setFormData] = useState({ name: "", country: "Uganda", address: "", number: "" });
  const [docs, setDocs] = useState<Record<string, { data: string; name: string; pdf: boolean }>>({});
  const [preparing, setPreparing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const isBusiness = accountType === "business";
  const slots = SLOTS[accountType];

  const handleFile = async (slot: DocSlot, file?: File | null) => {
    if (!file) return;
    setError("");
    setPreparing(slot.key);
    try {
      const data = await fileToDataUrl(file, slot.pdf);
      setDocs((d) => ({ ...d, [slot.key]: { data, name: file.name, pdf: file.type === "application/pdf" } }));
    } catch (err: any) {
      setError(err?.message || "Could not process that file.");
    } finally {
      setPreparing(null);
    }
  };

  const canSubmit =
    !!formData.name.trim() &&
    !!formData.address.trim() &&
    !!formData.number.trim() &&
    slots.every((s) => !s.required || docs[s.key]) &&
    !preparing;

  const handleSubmit = async () => {
    if (!user) return setError("Please log in and try again.");
    setSaving(true);
    setError("");
    const saved = await platform("kyc.save", {
      account_type: accountType,
      ...(isBusiness ? { business_name: formData.name.trim() } : { full_name: formData.name.trim() }),
      address: `${formData.address.trim()}, ${formData.country}`,
      id_type: isBusiness ? "business_registration" : "national_id",
      id_number: formData.number.trim(),
    });
    if (!saved.success) {
      setSaving(false);
      return setError(saved.error || "Submission failed. Please try again.");
    }
    for (const slot of slots) {
      const doc = docs[slot.key];
      if (!doc) continue;
      const uploaded = await platform("kyc.upload", { doc_type: slot.key, file_data: doc.data, file_name: doc.name });
      if (!uploaded.success) {
        setSaving(false);
        return setError(uploaded.error || "Your details were saved but a document did not upload. Please try again.");
      }
    }
    setSaving(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto text-center py-12 sm:py-16 px-1">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <i className="ri-shield-check-line text-primary-600 text-3xl sm:text-4xl" />
          </div>
          <h2 className="font-heading font-bold text-xl sm:text-3xl text-foreground-900 mb-3">Documents Submitted</h2>
          <p className="text-sm sm:text-base text-foreground-600 mb-2 max-w-md mx-auto">
            Your {isBusiness ? "business registration documents" : "National ID"} were uploaded securely and are now with our compliance team for review.
          </p>
          <p className="text-sm text-foreground-500 mb-8">Reviews are usually completed within 24-48 hours. You can keep using your dashboard in the meantime.</p>
          <button onClick={() => navigate("/dashboard")} className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer w-full sm:w-auto">
            <i className="ri-dashboard-line" /> Go to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const renderUpload = (slot: DocSlot) => {
    const value = docs[slot.key];
    const id = `kyc-${slot.key}`;
    return (
      <div key={slot.key} className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground-700 mb-1.5">
          {slot.label} {slot.required && <span className="text-accent-500">*</span>}
        </label>
        <input id={id} type="file" accept={slot.pdf ? "image/*,application/pdf" : "image/*"} className="hidden" onChange={(e) => handleFile(slot, e.target.files?.[0])} />
        <label htmlFor={id} className="block w-full rounded-xl border-2 border-dashed border-background-300/70 bg-background-100 hover:border-primary-400 transition-colors p-4 text-center cursor-pointer">
          {preparing === slot.key ? (
            <span className="flex flex-col items-center gap-2 py-6 text-sm text-foreground-600"><i className="ri-loader-4-line animate-spin text-xl" /> Preparing file…</span>
          ) : value ? (
            <span className="block">
              {value.pdf ? (
                <span className="flex flex-col items-center gap-1 py-6 text-sm text-foreground-700"><i className="ri-file-pdf-2-line text-3xl text-accent-600" /><span className="break-all">{value.name}</span></span>
              ) : (
                <img src={value.data} alt={`${slot.label} preview`} className="w-full h-32 sm:h-36 object-cover rounded-lg mb-2" />
              )}
              <span className="text-xs text-primary-600 font-medium inline-flex items-center gap-1"><i className="ri-refresh-line" /> Tap to replace</span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2 py-6 text-sm text-foreground-600">
              <i className={`${slot.pdf ? "ri-file-upload-line" : "ri-camera-line"} text-2xl text-foreground-400`} />
              Tap to upload {slot.pdf ? "a photo or PDF" : "or take a photo"}
              <span className="text-xs text-foreground-400">{slot.pdf ? "JPG, PNG or PDF" : "JPG or PNG"}, max 4MB</span>
            </span>
          )}
        </label>
      </div>
    );
  };

  const typeCard = (type: AccountType, icon: string, title: string, desc: string) => (
    <button
      type="button"
      onClick={() => { setAccountType(type); setError(""); }}
      aria-pressed={accountType === type}
      className={`flex-1 text-left rounded-xl border-2 p-4 transition-colors cursor-pointer ${accountType === type ? "border-primary-500 bg-primary-50" : "border-background-300/70 bg-background-100 hover:border-primary-300"}`}
    >
      <i className={`${icon} text-2xl ${accountType === type ? "text-primary-600" : "text-foreground-400"}`} />
      <p className="font-semibold text-foreground-900 mt-1">{title}</p>
      <p className="text-xs text-foreground-600 mt-0.5">{desc}</p>
    </button>
  );

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-background-50 rounded-2xl p-4 sm:p-8 border border-background-200/70">
          {error && (
            <div className="mb-4 p-4 rounded-lg bg-accent-100 border border-accent-200">
              <div className="flex gap-3">
                <i className="ri-error-warning-line text-accent-600 text-lg shrink-0 mt-0.5" />
                <p className="text-sm text-accent-800 font-medium break-words">{error}</p>
              </div>
            </div>
          )}

          <h2 className="font-heading font-bold text-lg sm:text-2xl text-foreground-900 mb-2">Account Verification</h2>
          <p className="text-sm text-foreground-600 mb-5">Choose your account type. Our compliance team receives your documents instantly.</p>

          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {typeCard("personal", "ri-user-3-line", "Personal account", "For individuals. Needs your National ID (front and back).")}
            {typeCard("business", "ri-building-4-line", "Business account", "For registered businesses. Needs business registration documents.")}
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                {isBusiness ? "Registered Business Name" : "Full Name (as on ID)"} <span className="text-accent-500">*</span>
              </label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} maxLength={120} className={inputCls} placeholder={isBusiness ? "e.g. Kampala Mart Ltd" : "e.g. Nakato Sarah"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">Country <span className="text-accent-500">*</span></label>
              <select value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} className={`${inputCls} appearance-none cursor-pointer`}>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                {isBusiness ? "Business Address" : "Home Address"} <span className="text-accent-500">*</span>
              </label>
              <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={3} maxLength={300} className={`${inputCls} resize-none`} placeholder="Plot 42, Kampala Road, Kampala" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                {isBusiness ? "Business Registration Number" : "National ID Number (NIN)"} <span className="text-accent-500">*</span>
              </label>
              <input type="text" value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} maxLength={40} className={inputCls} placeholder={isBusiness ? "e.g. 80020001234567" : "e.g. CM123456789ABC"} />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground-900 mb-3">{isBusiness ? "Business Registration Documents" : "National ID"}</h3>
            <div className="flex flex-col sm:flex-row gap-4">{slots.map(renderUpload)}</div>
          </div>

          <div className="bg-secondary-50 rounded-lg p-4 flex gap-3 mb-6">
            <i className="ri-information-line text-secondary-600 text-lg shrink-0 mt-0.5" />
            <p className="text-xs text-foreground-600 leading-relaxed min-w-0">
              Verification is required by financial regulations to prevent fraud. Documents are stored securely and only reviewed by our compliance team. Having trouble uploading? Email compliance@obpay.online.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t border-background-200/70">
            <button onClick={() => navigate("/dashboard")} className="text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer py-2">Skip for now</button>
            <button onClick={handleSubmit} disabled={!canSubmit || saving} className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold px-6 py-3 rounded-lg transition-colors cursor-pointer w-full sm:w-auto">
              {saving ? (<><i className="ri-loader-4-line animate-spin" /> Uploading…</>) : (<><i className="ri-upload-cloud-2-line" /> Submit Documents</>)}
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
