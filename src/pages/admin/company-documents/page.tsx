import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";

interface CompanyDocument {
  id: string;
  document_type: string;
  document_name: string;
  document_url: string;
  description: string;
  status: string;
  created_at: string;
}

const DOC_TYPES = [
  { value: "certificate_of_incorporation", label: "Certificate of Incorporation" },
  { value: "tax_clearance", label: "Tax Clearance Certificate" },
  { value: "business_license", label: "Financial Services Business License" },
  { value: "data_protection", label: "Data Protection Registration" },
  { value: "audit_report", label: "Annual Compliance Audit Report" },
  { value: "shareholder_certificate", label: "Shareholder Certificate" },
  { value: "board_resolution", label: "Board Resolution" },
  { value: "memorandum_articles", label: "Memorandum & Articles of Association" },
  { value: "other", label: "Other Regulatory Document" },
];

export default function AdminCompanyDocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formDocType, setFormDocType] = useState("");
  const [formDocName, setFormDocName] = useState("");
  const [formDocUrl, setFormDocUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("company_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setDocuments((data as CompanyDocument[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const resetForm = () => {
    setFormDocType("");
    setFormDocName("");
    setFormDocUrl("");
    setFormDescription("");
    setShowForm(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDocType || !formDocName) return;

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const { error: insertErr } = await supabase.from("company_documents").insert({
        document_type: formDocType,
        document_name: formDocName,
        document_url: formDocUrl,
        description: formDescription,
        status: "active",
      });
      if (insertErr) throw insertErr;

      setSuccess("Document uploaded successfully and is now visible to merchants.");
      resetForm();
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to upload document");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this document? It will no longer be visible to merchants.")) return;
    try {
      const { error: delErr } = await supabase.from("company_documents").update({ status: "archived" }).eq("id", id);
      if (delErr) throw delErr;
      setSuccess("Document archived.");
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to archive document");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const { error: updErr } = await supabase.from("company_documents").update({ status: "active" }).eq("id", id);
      if (updErr) throw updErr;
      setSuccess("Document restored.");
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to restore document");
    }
  };

  const handleUpdateUrl = async (id: string, url: string) => {
    const newUrl = prompt("Enter the new document image URL:", url);
    if (!newUrl || newUrl === url) return;
    try {
      const { error: updErr } = await supabase.from("company_documents").update({ document_url: newUrl }).eq("id", id);
      if (updErr) throw updErr;
      setSuccess("Document URL updated.");
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to update document URL");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-1">
              Company Registration Documents
            </h2>
            <p className="text-sm text-foreground-600">
              Upload and manage official company registration documents visible to merchants on the Compliance page.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-4 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className={showForm ? "ri-close-line" : "ri-add-line"} />
            {showForm ? "Cancel" : "Upload Document"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <i className="ri-error-warning-line mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
            <i className="ri-checkbox-circle-line mt-0.5" />
            {success}
          </div>
        )}

        {/* Upload Form */}
        {showForm && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
            <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-4">Upload New Registration Document</h3>
            <form onSubmit={handleUpload} className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Document Type *</label>
                  <select
                    value={formDocType}
                    onChange={(e) => setFormDocType(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                  >
                    <option value="">Select document type...</option>
                    {DOC_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Document Name *</label>
                  <input
                    type="text"
                    value={formDocName}
                    onChange={(e) => setFormDocName(e.target.value)}
                    placeholder="e.g., Certificate of Incorporation No. 80034567890123"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Document Image URL</label>
                <input
                  type="url"
                  value={formDocUrl}
                  onChange={(e) => setFormDocUrl(e.target.value)}
                  placeholder="https://... — paste the uploaded image URL here"
                  className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <p className="text-[11px] text-foreground-400 mt-1">Upload the document image to a hosting service and paste the URL here. Supported formats: JPG, PNG, PDF (as image).</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe this document — issuing authority, registration number, validity period, etc."
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-y"
                />
                <p className="text-[11px] text-foreground-400 mt-1">{formDescription.length}/500 characters</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors"
                >
                  {saving ? (<><i className="ri-loader-4-line animate-spin" /> Uploading...</>) : (<><i className="ri-upload-cloud-2-line" /> Upload Document</>)}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-background-300/60 hover:bg-background-100 text-foreground-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Documents List */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="p-5 border-b border-background-200/70 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-sm text-foreground-900">
              All Documents ({documents.length})
            </h3>
            <span className="text-[11px] text-foreground-500">
              Active: {documents.filter((d) => d.status === "active").length} | Archived: {documents.filter((d) => d.status !== "active").length}
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-file-shield-2-line text-foreground-400 text-xl" />
              </div>
              <p className="text-sm text-foreground-500">No documents yet</p>
              <p className="text-xs text-foreground-400 mt-1">Upload your first company registration document above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-background-200/70">
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Document</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase hidden sm:table-cell">Type</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase hidden md:table-cell">Date</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            doc.document_url ? "bg-primary-100" : "bg-background-100"
                          }`}>
                            <i className={`${doc.document_url ? "ri-image-line text-primary-600" : "ri-image-add-line text-foreground-400"} text-sm`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground-900 truncate max-w-[200px]">{doc.document_name}</p>
                            <p className="text-[11px] text-foreground-500 truncate max-w-[200px]">{doc.description?.slice(0, 60)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-xs text-foreground-600">
                          {DOC_TYPES.find((dt) => dt.value === doc.document_type)?.label || doc.document_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          doc.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-background-200 text-foreground-500"
                        }`}>
                          {doc.status === "active" ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className="text-xs text-foreground-500">
                          {new Date(doc.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleUpdateUrl(doc.id, doc.document_url)}
                            className="w-8 h-8 rounded-lg hover:bg-background-200/70 flex items-center justify-center text-foreground-500 hover:text-primary-600 transition-colors cursor-pointer"
                            title="Update image URL"
                          >
                            <i className="ri-image-edit-line text-sm" />
                          </button>
                          {doc.status === "active" ? (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-foreground-500 hover:text-red-600 transition-colors cursor-pointer"
                              title="Archive document"
                            >
                              <i className="ri-archive-line text-sm" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(doc.id)}
                              className="w-8 h-8 rounded-lg hover:bg-emerald-50 flex items-center justify-center text-foreground-500 hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Restore document"
                            >
                              <i className="ri-refresh-line text-sm" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}