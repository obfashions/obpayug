import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { platform } from "@/lib/platform";

interface Submission {
  id: string;
  merchant_id: string;
  email: string | null;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  address: string | null;
  id_type: string | null;
  id_number: string | null;
  account_type?: string | null;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Document {
  id: string;
  merchant_id: string;
  submission_id: string | null;
  doc_type: string;
  file_name: string | null;
  file_size: number | null;
  status: string;
  created_at: string;
}

const FILTERS = ["pending", "approved", "rejected", "all"];

export default function KycReviewPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [notes, setNotes] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await platform<{ submissions: Submission[]; documents: Document[] }>("admin-kyc.list", {
      status: filter,
    });
    if (!res.success) setError(res.error || "Could not load verification submissions.");
    else {
      setSubmissions(res.data?.submissions || []);
      setDocuments(res.data?.documents || []);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDoc = async (id: string) => {
    const res = await platform<{ url: string }>("admin-kyc.document-url", { id });
    if (!res.success || !res.data?.url) {
      setError(res.error || "That document could not be opened.");
      return;
    }
    window.open(res.data.url, "_blank", "noopener");
  };

  const review = async (status: "approved" | "rejected") => {
    if (!selected) return;
    setWorking(true);
    const res = await platform("admin-kyc.review", { id: selected.id, status, notes });
    setWorking(false);
    if (!res.success) {
      setError(res.error || "Could not save the decision.");
      return;
    }
    setSelected(null);
    setNotes("");
    load();
  };

  const docsFor = (submission: Submission) =>
    documents.filter((d) => d.submission_id === submission.id || d.merchant_id === submission.merchant_id);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground-900">Verification review</h1>
            <p className="text-sm text-foreground-500 mt-1">
              Business details and ID photos submitted by merchants.
            </p>
          </div>
          <span className="grow" />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize cursor-pointer ${
                  filter === f ? "bg-primary-600 text-white" : "bg-background-100 text-foreground-600"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

        <div className="rounded-xl border border-background-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-foreground-500">Loading submissions…</div>
          ) : submissions.length === 0 ? (
            <div className="p-6 text-sm text-foreground-500">Nothing to review here.</div>
          ) : (
            <ul className="divide-y divide-background-100">
              {submissions.map((s) => (
                <li key={s.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground-900">{s.business_name || s.full_name || s.email}</span>
                    <span className="ml-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700">{s.account_type === "business" ? "Business" : "Personal"}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        s.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : s.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {s.status}
                    </span>
                    <span className="grow" />
                    <span className="text-xs text-foreground-500">
                      Updated {new Date(s.updated_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-foreground-600">
                    <p>Email: {s.email || "—"}</p>
                    <p>Phone: {s.phone || "—"}</p>
                    <p>Address: {s.address || "—"}</p>
                    <p>
                      ID: {s.id_type || "—"} {s.id_number ? `· ${s.id_number}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {docsFor(s).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => openDoc(d.id)}
                        className="rounded-lg bg-background-100 px-3 py-1.5 text-xs text-foreground-700 hover:bg-background-200 cursor-pointer"
                      >
                        <i className="ri-image-line mr-1" />
                        {d.doc_type.replace(/_/g, " ")}
                      </button>
                    ))}
                    {docsFor(s).length === 0 && (
                      <span className="text-xs text-foreground-500">No documents uploaded.</span>
                    )}
                  </div>
                  {s.review_notes && <p className="text-xs text-foreground-500">Notes: {s.review_notes}</p>}
                  <button
                    onClick={() => {
                      setSelected(s);
                      setNotes(s.review_notes || "");
                    }}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
                  >
                    Review
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-foreground-900">
              {selected.business_name || selected.email}
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes for the merchant (required when rejecting)"
              className="w-full rounded-lg border border-background-200 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                disabled={working}
                onClick={() => review("approved")}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                Approve
              </button>
              <button
                disabled={working || !notes.trim()}
                onClick={() => review("rejected")}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                Reject
              </button>
              <span className="grow" />
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg bg-background-100 px-4 py-2 text-sm text-foreground-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
