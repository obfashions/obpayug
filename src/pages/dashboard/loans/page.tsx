import { useState, useEffect } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatCurrency, formatDate, SUPPORTED_CURRENCIES } from "@/lib/currency";

interface LoanApplication {
  id: number;
  user_id: string;
  amount: number;
  currency: string;
  purpose: string;
  term_months: number;
  business_name: string;
  monthly_revenue: number | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const TERM_OPTIONS = [1, 3, 6, 12, 24];

const LOAN_PURPOSES = [
  "Working Capital",
  "Business Expansion",
  "Equipment Purchase",
  "Inventory / Stock",
  "Marketing & Advertising",
  "Bridge Financing",
  "Other",
];

export default function LoansPage() {
  const { profile } = useAuth();
  const { activeCurrency, currencyInfo } = useCurrency();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Form state ──
  const [showForm, setShowForm] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(activeCurrency);
  const [purpose, setPurpose] = useState("");
  const [termMonths, setTermMonths] = useState(3);
  const [businessName, setBusinessName] = useState("");
  const [monthlyRevenue, setMonthlyRevenue] = useState("");

  const fetchApplications = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("loan_applications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setApplications((data as LoanApplication[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [profile?.id]);

  const hasActiveLoan = applications.some(
    (a) => a.status === "pending" || a.status === "approved" || a.status === "paid_out"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    const amountNum = parseFloat(amount);
    const revenueNum = monthlyRevenue ? parseFloat(monthlyRevenue) : null;

    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Please enter a valid loan amount.");
      return;
    }
    if (!purpose) {
      setFormError("Please select a loan purpose.");
      return;
    }
    if (!businessName.trim()) {
      setFormError("Please enter your business name.");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      const { error: insertErr } = await supabase.from("loan_applications").insert({
        user_id: profile.id,
        amount: amountNum,
        currency,
        purpose,
        term_months: termMonths,
        business_name: businessName.trim(),
        monthly_revenue: revenueNum,
        status: "pending",
      });

      if (insertErr) throw insertErr;

      // Send loan application confirmation email
      if (profile?.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            email: profile.email,
            type: "loan_application_received",
            data: {
              amount: String(amountNum),
              currency,
              purpose,
              business_name: businessName.trim(),
              full_name: profile.full_name || "",
            },
          },
        }).then(() => {}, (e: any) => console.warn("[Loans] Confirmation email failed silently:", e));
      }

      setFormSuccess("Your loan application has been submitted! Our team will review it within 1-2 business days.");
      setAmount("");
      setPurpose("");
      setBusinessName("");
      setMonthlyRevenue("");
      setShowForm(false);
      fetchApplications();
    } catch (err: any) {
      setFormError(err.message || "Failed to submit application. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      pending: { bg: "bg-accent-100", text: "text-accent-700", icon: "ri-time-line", label: "Pending Review" },
      approved: { bg: "bg-primary-100", text: "text-primary-700", icon: "ri-check-line", label: "Approved" },
      rejected: { bg: "bg-red-100", text: "text-red-700", icon: "ri-close-line", label: "Rejected" },
      paid_out: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "ri-bank-card-line", label: "Paid Out" },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        <i className={`${s.icon} text-xs`} />
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading loan applications...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-1">Business Loans</h2>
            <p className="text-sm text-foreground-600">Apply for financing to grow your business. Fast approvals, flexible terms.</p>
          </div>
          {!hasActiveLoan && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-background-50 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line" />
              Apply for a Loan
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-accent-100 border border-accent-200/70 p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-accent-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-foreground-800">{error}</p>
            </div>
            <button onClick={fetchApplications} className="text-sm text-primary-500 hover:text-primary-600 font-medium cursor-pointer whitespace-nowrap">
              Retry
            </button>
          </div>
        )}

        {/* Loan Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: "ri-flashlight-line", title: "Fast Approval", desc: "Decisions within 1-2 business days after submission", color: "bg-emerald-100 text-emerald-600" },
            { icon: "ri-percent-line", title: "Competitive Rates", desc: "Starting from 8% per annum on business loans", color: "bg-primary-100 text-primary-600" },
            { icon: "ri-calendar-check-line", title: "Flexible Terms", desc: "Choose 1 to 24 month repayment periods", color: "bg-accent-100 text-accent-600" },
          ].map((item) => (
            <div key={item.title} className="bg-background-50 rounded-xl border border-background-200/70 p-5">
              <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center mb-3`}>
                <i className={`${item.icon} text-lg`} />
              </div>
              <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-1">{item.title}</h3>
              <p className="text-xs text-foreground-500">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Application Form */}
        {showForm && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-semibold text-lg text-foreground-900">New Loan Application</h3>
              <button onClick={() => { setShowForm(false); setFormError(""); }} className="w-8 h-8 rounded-lg hover:bg-background-200 flex items-center justify-center text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer">
                <i className="ri-close-line" />
              </button>
            </div>

            {formError && (
              <div className="rounded-lg bg-accent-100 border border-accent-200/70 px-4 py-3 mb-5 text-sm text-accent-700 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="rounded-lg bg-emerald-100 border border-emerald-200/70 px-4 py-3 mb-5 text-sm text-emerald-700 flex items-start gap-2">
                <i className="ri-checkbox-circle-line mt-0.5 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Loan Amount *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 5000000"
                      className="flex-1 px-3 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                      required
                      min={100000}
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-28 px-2 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      {SUPPORTED_CURRENCIES.filter(c => ["UGX", "KES", "USD", "EUR", "GBP"].includes(c.code)).map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Repayment Term</label>
                  <select
                    value={termMonths}
                    onChange={(e) => setTermMonths(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
                  >
                    {TERM_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Loan Purpose *</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
                    required
                  >
                    <option value="">Select purpose...</option>
                    {LOAN_PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Business Name *</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your registered business name"
                    className="w-full px-3 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Monthly Revenue (optional)</label>
                  <input
                    type="number"
                    value={monthlyRevenue}
                    onChange={(e) => setMonthlyRevenue(e.target.value)}
                    placeholder="Estimated monthly business revenue"
                    className="w-full px-3 py-2.5 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    min={0}
                  />
                </div>
              </div>

              {/* Summary box */}
              {amount && parseFloat(amount) > 0 && (
                <div className="bg-background-100 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-500">Loan Amount</span>
                    <span className="font-semibold text-foreground-900">{formatCurrency(parseFloat(amount), currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-500">Term</span>
                    <span className="font-medium text-foreground-900">{termMonths} month{termMonths > 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex justify-between border-t border-background-200/70 pt-2">
                    <span className="text-foreground-500">Est. Monthly Payment</span>
                    <span className="font-bold text-foreground-900">
                      {formatCurrency(Math.round(parseFloat(amount) / termMonths * 1.08), currency)}
                      <span className="text-[10px] text-foreground-400 ml-1 font-normal">(at 8% p.a.)</span>
                    </span>
                  </div>
                  <p className="text-[10px] text-foreground-400 mt-1">
                    This is an estimate. Final terms depend on your application review.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(""); }}
                  className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2.5 rounded-lg hover:bg-background-100 transition-colors cursor-pointer text-sm whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-medium py-2.5 rounded-lg transition-colors cursor-pointer text-sm whitespace-nowrap"
                >
                  {formSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="ri-loader-4-line animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Application"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Existing Applications */}
        <div className="bg-background-50 rounded-xl border border-background-200/70">
          <div className="p-5 border-b border-background-200/70 flex items-center gap-2">
            <i className="ri-file-list-3-line text-accent-600" />
            <h3 className="font-heading font-semibold text-base text-foreground-900">Your Applications</h3>
            {applications.length > 0 && (
              <span className="text-xs text-foreground-400 ml-2">{applications.length} total</span>
            )}
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-4">
                <i className="ri-bank-line text-foreground-400 text-2xl" />
              </div>
              <p className="text-sm text-foreground-500 mb-1">No loan applications yet</p>
              <p className="text-xs text-foreground-400">
                Ready to grow your business? Apply for a loan above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-background-200/70">
              {applications.map((app) => (
                <div key={app.id} className="p-5 hover:bg-background-100/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                        <i className="ri-bank-line text-primary-600 text-lg" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground-900">
                          {formatCurrency(app.amount, app.currency)} — {app.term_months} month{app.term_months > 1 ? "s" : ""}
                        </p>
                        <p className="text-xs text-foreground-500">
                          {app.purpose} • Applied {formatDate(app.created_at)}
                        </p>
                      </div>
                    </div>
                    {statusBadge(app.status)}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-foreground-400">Business</span>
                      <p className="font-medium text-foreground-900">{app.business_name}</p>
                    </div>
                    {app.monthly_revenue != null && (
                      <div>
                        <span className="text-foreground-400">Monthly Revenue</span>
                        <p className="font-medium text-foreground-900">{formatCurrency(app.monthly_revenue, app.currency)}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-foreground-400">Application ID</span>
                      <p className="font-medium text-foreground-900 font-mono">#{app.id}</p>
                    </div>
                    <div>
                      <span className="text-foreground-400">Last Updated</span>
                      <p className="font-medium text-foreground-900">{formatDate(app.updated_at)}</p>
                    </div>
                  </div>

                  {app.admin_notes && (
                    <div className="mt-3 bg-background-100 rounded-lg px-3 py-2.5 text-xs">
                      <span className="font-medium text-foreground-700">Admin notes: </span>
                      <span className="text-foreground-600">{app.admin_notes}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
          <h3 className="font-heading font-semibold text-base text-foreground-900 mb-4">Frequently Asked Questions</h3>
          <div className="space-y-4">
            {[
              { q: "Who is eligible for an ObPay business loan?", a: "Any verified ObPay merchant with at least 3 months of transaction history can apply. Your repayment capacity is assessed based on your transaction volume and business profile." },
              { q: "How quickly will I receive funds after approval?", a: "Once approved, funds are disbursed directly to your ObPay wallet within 24 hours. You can then withdraw to your mobile money or bank account." },
              { q: "What happens if I miss a repayment?", a: "We understand businesses face challenges. Contact our support team immediately if you anticipate difficulty. Late payments may incur a small penalty and could affect future loan eligibility." },
            ].map((faq, i) => (
              <details key={i} className="group">
                <summary className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-sm font-medium text-foreground-900">{faq.q}</span>
                  <i className="ri-arrow-down-s-line text-foreground-400 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="text-xs text-foreground-600 mt-2 pb-2 pl-1">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}