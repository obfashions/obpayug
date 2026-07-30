import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
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

const docTypeMeta: Record<string, { icon: string; color: string; label: string }> = {
  certificate_of_incorporation: { icon: "ri-government-line", color: "bg-primary-100 text-primary-600", label: "Certificate of Incorporation" },
  tax_clearance: { icon: "ri-bill-line", color: "bg-emerald-100 text-emerald-600", label: "Tax Clearance Certificate" },
  business_license: { icon: "ri-shield-check-line", color: "bg-accent-100 text-accent-600", label: "Financial Services License" },
  data_protection: { icon: "ri-lock-line", color: "bg-secondary-100 text-secondary-600", label: "Data Protection Registration" },
  audit_report: { icon: "ri-file-search-line", color: "bg-indigo-100 text-indigo-600", label: "Annual Compliance Audit" },
};

export default function CompanyDocumentsPage() {
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("company_documents")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (fetchErr) throw fetchErr;
      setDocuments((data as CompanyDocument[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load company documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading registration documents...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <p className="text-sm mb-4">{error}</p>
          <button onClick={fetchDocuments} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-1">
            Company Registration &amp; Compliance
          </h2>
          <p className="text-sm text-foreground-600">
            Official registration documents and regulatory compliance certificates of ObPay Technologies Limited.
            These documents confirm our legal standing as a licensed financial technology service provider.
          </p>
        </div>

        {/* Trust Banner */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
              <i className="ri-verified-badge-line text-primary-600 text-2xl" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-foreground-900">Legally Registered &amp; Fully Compliant</h3>
              <p className="text-xs text-foreground-600 mt-1 leading-relaxed">
                ObPay Technologies Limited is a duly registered company under the laws of the Republic of Uganda,
                holding all requisite licenses and certifications to operate as a payment gateway and financial
                technology service provider. Our operations are governed by the relevant financial services
                regulations and we maintain full compliance with anti-money laundering (AML) and counter-terrorism
                financing (CTF) statutory requirements.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: "URSB Registered", icon: "ri-check-line" },
                  { label: "URA Compliant", icon: "ri-check-line" },
                  { label: "AML/CTF Compliant", icon: "ri-check-line" },
                  { label: "Data Protection Act", icon: "ri-check-line" },
                ].map((badge) => (
                  <span key={badge.label} className="inline-flex items-center gap-1 text-[10px] font-medium text-primary-700 bg-primary-50 border border-primary-200/50 px-2 py-1 rounded-full">
                    <i className={badge.icon} />
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {documents.map((doc) => {
            const meta = docTypeMeta[doc.document_type] || {
              icon: "ri-file-text-line",
              color: "bg-background-100 text-foreground-600",
              label: doc.document_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            };
            const hasImage = doc.document_url && doc.document_url.startsWith("http");

            return (
              <div key={doc.id} className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden group hover:border-background-300/60 transition-all">
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg ${meta.color} flex items-center justify-center shrink-0`}>
                      <i className={`${meta.icon} text-lg`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-heading font-semibold text-sm text-foreground-900">{meta.label}</h4>
                      <p className="text-[11px] text-foreground-500 mt-0.5">{doc.document_name}</p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Verified
                    </span>
                  </div>

                  <p className="text-xs text-foreground-600 leading-relaxed mb-4">{doc.description}</p>

                  {hasImage ? (
                    <div className="relative rounded-lg overflow-hidden bg-background-100 border border-background-200/70">
                      <img
                        src={doc.document_url}
                        alt={doc.document_name}
                        className="w-full h-48 object-contain p-2"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-foreground-900/0 group-hover:bg-foreground-900/10 transition-colors flex items-center justify-center">
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-background-50/90 backdrop-blur-sm text-foreground-900 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer"
                        >
                          <i className="ri-zoom-in-line mr-1" />
                          View Full Document
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-background-100 border border-background-200/70 p-8 text-center">
                      <i className="ri-image-add-line text-foreground-400 text-3xl mb-2 block" />
                      <p className="text-xs text-foreground-500">
                        Scanned document image will be uploaded by the administrator shortly.
                      </p>
                      <p className="text-[10px] text-foreground-400 mt-1">
                        For immediate verification, please contact our compliance department.
                      </p>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-background-200/70 flex items-center justify-between">
                    <span className="text-[11px] text-foreground-500">
                      Issued: {new Date(doc.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    <span className="text-[10px] font-medium text-foreground-400 uppercase tracking-wider">Official Document</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {documents.length === 0 && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-file-shield-2-line text-foreground-400 text-2xl" />
            </div>
            <h4 className="font-heading font-semibold text-sm text-foreground-900 mb-2">No Documents Available</h4>
            <p className="text-xs text-foreground-500 max-w-md mx-auto">
              Company registration documents have not yet been uploaded. Please check back later or contact
              our compliance department for verification.
            </p>
          </div>
        )}

        {/* Legal Disclaimer */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-start gap-3">
            <i className="ri-information-line text-foreground-400 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-foreground-700">Legal Disclaimer</h4>
              <p className="text-[11px] text-foreground-500 mt-1 leading-relaxed">
                The documents displayed on this page are the property of ObPay Technologies Limited and are
                provided for verification purposes only. Unauthorized reproduction, distribution, or use of
                these documents is strictly prohibited. For official verification inquiries, please contact
                our legal and compliance department at legal@obpay.online. Document authenticity can be
                independently verified through the Uganda Registration Services Bureau (URSB) company
                registry and the Uganda Revenue Authority (URA) taxpayer portal.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}