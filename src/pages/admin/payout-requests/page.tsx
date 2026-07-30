import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { invokeObpay } from "@/lib/edge-function";

interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  phone_number: string;
  network: string;
  description: string;
  status: string;
  provider_reference: string;
  rejection_reason: string;
  fee_amount: number;
  completed_at: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export default function AdminPayoutRequests() {
  const { profile: adminProfile } = useAuth();
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("payout_requests")
        .select("*, profiles:user_id(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (fetchErr) throw fetchErr;
      setRequests((data as PayoutRequest[]) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load payout requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (req: PayoutRequest) => {
    try {
      const data = await invokeObpay({
        _action: "payout",
        phoneNumber: req.phone_number,
        amount: req.amount,
        currency: req.currency,
        description: req.description || "Admin approved payout",
        network: req.network || "mtn",
        _payout_type: "send",
      });

      if (!data?.success) throw new Error(data?.error || "Payout failed");

      await supabase.from("audit_logs").insert({
        user_id: adminProfile?.id,
        user_name: adminProfile?.full_name || "Admin",
        action: "payout_approved",
        resource: "payout_requests",
        resource_id: req.id,
        details: { amount: req.amount, currency: req.currency, phone: req.phone_number },
      });

      setActionMsg({ ok: true, message: `Payout of ${formatCurrency(req.amount, req.currency)} approved.` });
      setTimeout(() => setActionMsg(null), 3000);
      fetchRequests();
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to process payout" });
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleReject = async (req: PayoutRequest) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;

    try {
      await supabase.from("payout_requests").update({
        status: "failed",
        rejection_reason: reason,
      }).eq("id", req.id);

      // Refund wallet
      const { data: wallet } = await supabase
        .from("merchant_wallets")
        .select("available_balance")
        .eq("user_id", req.user_id)
        .maybeSingle();

      if (wallet) {
        const refundAmount = req.amount + (req.fee_amount || 0);
        await supabase.from("merchant_wallets").update({
          available_balance: Number(wallet.available_balance) + refundAmount,
          updated_at: new Date().toISOString(),
        }).eq("user_id", req.user_id);
      }

      await supabase.from("audit_logs").insert({
        user_id: adminProfile?.id,
        user_name: adminProfile?.full_name || "Admin",
        action: "payout_rejected",
        resource: "payout_requests",
        resource_id: req.id,
        details: { reason, amount: req.amount },
      });

      setActionMsg({ ok: true, message: "Payout request rejected and wallet refunded." });
      setTimeout(() => setActionMsg(null), 3000);
      fetchRequests();
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to reject" });
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const filtered = statusFilter === "all" ? requests : requests.filter((p) => p.status === statusFilter);

  const pendingCount = requests.filter((p) => p.status === "pending").length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="text-center py-24">
          <p className="text-sm mb-4">{error}</p>
          <button onClick={fetchRequests} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Payout Requests</h1>
            <p className="text-sm text-foreground-600 mt-1">{filtered.length} requests · {pendingCount} pending</p>
          </div>
        </div>

        {actionMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${actionMsg.ok ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"}`}>
            <i className={actionMsg.ok ? "ri-check-line" : "ri-error-warning-line"} />
            {actionMsg.message}
          </div>
        )}

        <div className="flex items-center gap-1 bg-background-200/70 rounded-full p-1 w-fit flex-wrap">
          {(["all", "pending", "processing", "completed", "failed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap capitalize ${
                statusFilter === s ? "bg-background-50 text-foreground-900" : "text-foreground-500 hover:text-foreground-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-upload-cloud-line text-foreground-400 text-xl" />
              </div>
              <p className="text-sm text-foreground-500">No payout requests found</p>
              <p className="text-xs text-foreground-400 mt-1">Payout requests from merchants will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background-200/70">
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Merchant</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Recipient</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Date</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                            {p.profiles?.full_name?.charAt(0)?.toUpperCase() || "M"}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-foreground-900">{p.profiles?.full_name || "Unknown"}</p>
                            <p className="text-[11px] text-foreground-500">{p.profiles?.email || ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-medium text-foreground-900">{formatCurrency(p.amount, p.currency)}</span>
                        {p.fee_amount > 0 && (
                          <p className="text-[10px] text-foreground-500">Fee: {formatCurrency(p.fee_amount, p.currency)}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-xs text-foreground-700 font-mono">{p.phone_number}</p>
                        <p className="text-[11px] text-foreground-500">{p.network || "mobile_money"}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          p.status === "completed" ? "bg-primary-100 text-primary-700" :
                          p.status === "failed" ? "bg-accent-100 text-accent-700" :
                          p.status === "processing" ? "bg-amber-100 text-amber-700" :
                          "bg-secondary-100 text-secondary-700"
                        }`}>{p.status}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs text-foreground-500">
                          {new Date(p.created_at).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {p.status === "pending" ? (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleApprove(p)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 cursor-pointer whitespace-nowrap"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(p)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-accent-100 text-accent-700 hover:bg-accent-200 cursor-pointer whitespace-nowrap"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-foreground-400">
                            {p.status === "completed" ? p.completed_at ? new Date(p.completed_at).toLocaleDateString() : "—" : "—"}
                          </span>
                        )}
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