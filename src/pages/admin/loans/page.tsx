import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";

interface LoanApplication {
  id: number;
  user_id: string;
  amount: number;
  currency: string;
  purpose: string;
  term_months: number;
  business_name: string;
  monthly_revenue: number;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_full_name?: string;
  user_email?: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-secondary-100 text-secondary-700",
  approved: "bg-primary-100 text-primary-700",
  rejected: "bg-accent-100 text-accent-700",
  paid_out: "bg-primary-100 text-primary-700",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "UGX", minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export default function AdminLoansPage() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      let query = supabase
        .from("loan_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data: loans, error: loansErr } = await query;
      if (loansErr) throw loansErr;

      if (!loans || loans.length === 0) {
        setApplications([]);
        setLoading(false);
        return;
      }

      const userIds = [...new Set((loans as LoanApplication[]).map((l) => l.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      const enriched = (loans as LoanApplication[]).map((loan) => ({
        ...loan,
        user_full_name: profileMap.get(loan.user_id)?.full_name || "Unknown",
        user_email: profileMap.get(loan.user_id)?.email || "",
      }));

      setApplications(enriched);
    } catch (err: any) {
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleAction = async (appId: number, newStatus: string) => {
    setActionLoading(true);
    setActionResult(null);
    try {
      const updateData: Record<string, any> = { status: newStatus };
      if (adminNotes.trim()) {
        updateData.admin_notes = adminNotes.trim();
      }

      const { error: updateErr } = await supabase
        .from("loan_applications")
        .update(updateData)
        .eq("id", appId);

      if (updateErr) throw updateErr;

      const statusLabel = newStatus === "approved" ? "approved" : "rejected";
      setActionResult({ type: "success", message: `Loan application #${appId} has been ${statusLabel}.` });
      setSelectedApp(null);
      setAdminNotes("");
      fetchApplications();
    } catch (err: any) {
      setActionResult({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async (appId: number) => {
    if (!adminNotes.trim()) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      const { error: updateErr } = await supabase
        .from("loan_applications")
        .update({ admin_notes: adminNotes.trim() })
        .eq("id", appId);

      if (updateErr) throw updateErr;

      setActionResult({ type: "success", message: "Notes saved." });
      fetchApplications();
    } catch (err: any) {
      setActionResult({ type: "error", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = applications.filter((a) => a.status === "pending").length;
  const approvedCount = applications.filter((a) => a.status === "approved").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Loan Applications</h1>
            <p className="text-sm text-foreground-600 mt-1">
              {applications.length} application{applications.length !== 1 ? "s" : ""}
              {pendingCount > 0 && ` · ${pendingCount} pending`}
              {approvedCount > 0 && ` · ${approvedCount} approved`}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-accent-100 border border-accent-200 text-accent-700 rounded-xl p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-lg shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button onClick={fetchApplications} className="text-sm underline cursor-pointer whitespace-nowrap">Retry</button>
          </div>
        )}

        {actionResult && (
          <div
            className={`rounded-xl p-4 flex items-start gap-3 ${
              actionResult.type === "success"
                ? "bg-primary-100 border border-primary-200 text-primary-700"
                : "bg-accent-100 border border-accent-200 text-accent-700"
            }`}
          >
            <i className={`${actionResult.type === "success" ? "ri-checkbox-circle-line" : "ri-error-warning-line"} text-lg shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className="text-sm font-medium">{actionResult.message}</p>
            </div>
            <button onClick={() => setActionResult(null)} className="text-current opacity-60 hover:opacity-100 cursor-pointer">
              <i className="ri-close-line" />
            </button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 bg-background-100 rounded-full p-1 w-fit">
          {[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending" },
            { key: "approved", label: "Approved" },
            { key: "rejected", label: "Rejected" },
            { key: "paid_out", label: "Paid Out" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-background-50 text-foreground-900"
                  : "text-foreground-500 hover:text-foreground-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
              <p className="text-sm text-foreground-500 mt-3">Loading applications...</p>
            </div>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-16 bg-background-50 rounded-xl border border-background-200/70">
            <div className="w-16 h-16 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-bank-line text-foreground-400 text-2xl" />
            </div>
            <p className="text-sm text-foreground-500">No loan applications found</p>
            <p className="text-xs text-foreground-400 mt-1">
              {statusFilter !== "all" ? "Try changing the filter" : "Applications will appear here when merchants apply"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-background-50 rounded-xl border border-background-200/70 p-5 hover:border-background-300/60 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-background-100 flex items-center justify-center">
                      <span className="font-heading font-bold text-sm text-foreground-700">
                        {app.user_full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground-900">{app.user_full_name}</p>
                      <p className="text-xs text-foreground-500">{app.user_email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColors[app.status] || "bg-background-100 text-foreground-500"}`}>
                    {app.status.replace("_", " ")}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Amount</span>
                    <span className="text-sm font-semibold text-foreground-900">{formatCurrency(app.amount, app.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Term</span>
                    <span className="text-sm text-foreground-700">{app.term_months} month{app.term_months !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Business</span>
                    <span className="text-sm text-foreground-700">{app.business_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Monthly Revenue</span>
                    <span className="text-sm text-foreground-700">{formatCurrency(app.monthly_revenue, app.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Purpose</span>
                    <span className="text-sm text-foreground-700 truncate max-w-[180px] text-right">{app.purpose}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground-500">Applied</span>
                    <span className="text-xs text-foreground-500">{timeAgo(app.created_at)}</span>
                  </div>
                </div>

                {/* Admin Notes */}
                {app.admin_notes && (
                  <div className="bg-background-100 rounded-lg p-3 mb-3">
                    <p className="text-[11px] font-medium text-foreground-500 mb-1">Admin Notes</p>
                    <p className="text-xs text-foreground-700">{app.admin_notes}</p>
                  </div>
                )}

                {/* Actions */}
                {app.status === "pending" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedApp(app);
                        setAdminNotes(app.admin_notes || "");
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-3 py-2 rounded-lg text-xs cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <i className="ri-check-line" /> Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedApp(app);
                        setAdminNotes("");
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-3 py-2 rounded-lg text-xs cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <i className="ri-close-line" /> Reject
                    </button>
                  </div>
                ) : app.status === "approved" ? (
                  <button
                    onClick={async () => {
                      setActionLoading(true);
                      try {
                        await supabase.from("loan_applications").update({ status: "paid_out" }).eq("id", app.id);
                        setActionResult({ type: "success", message: `Loan #${app.id} marked as paid out.` });
                        fetchApplications();
                      } catch (err: any) {
                        setActionResult({ type: "error", message: err.message });
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-background-50 font-medium px-3 py-2 rounded-lg text-xs cursor-pointer whitespace-nowrap transition-colors"
                  >
                    <i className="ri-money-dollar-circle-line" /> Mark as Paid Out
                  </button>
                ) : (
                  <div className="flex items-center justify-center py-1">
                    <span className="text-xs text-foreground-400">
                      {app.status === "paid_out" ? "Completed" : "Resolved"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Modal */}
        {selectedApp && (
          <>
            <div className="fixed inset-0 bg-foreground-900/30 z-40" onClick={() => setSelectedApp(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-background-50 rounded-2xl border border-background-200/70 shadow-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-semibold text-lg text-foreground-900">
                    {selectedApp.status === "pending" ? "Review Application" : "Update Notes"}
                  </h3>
                  <button onClick={() => setSelectedApp(null)} className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer">
                    <i className="ri-close-line text-foreground-500" />
                  </button>
                </div>

                <div className="bg-background-100 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-foreground-500">Applicant</span>
                    <span className="text-xs font-medium text-foreground-900">{selectedApp.user_full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-foreground-500">Amount</span>
                    <span className="text-xs font-medium text-foreground-900">{formatCurrency(selectedApp.amount, selectedApp.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-foreground-500">Term</span>
                    <span className="text-xs font-medium text-foreground-900">{selectedApp.term_months} months</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-foreground-500">Business</span>
                    <span className="text-xs font-medium text-foreground-900">{selectedApp.business_name}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-xs font-medium text-foreground-700 mb-1.5">Admin Notes</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this application..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:border-primary-400 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedApp(null);
                      setAdminNotes("");
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-background-200/70 text-sm font-medium text-foreground-600 hover:bg-background-100 cursor-pointer whitespace-nowrap transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveNotes(selectedApp.id)}
                    disabled={actionLoading || !adminNotes.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-secondary-500 hover:bg-secondary-600 disabled:opacity-40 text-background-50 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
                  >
                    Save Notes
                  </button>
                  {selectedApp.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleAction(selectedApp.id, "approved")}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-background-50 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(selectedApp.id, "rejected")}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-background-50 text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}