import { purgeMerchantData } from "@/lib/mailjet.functions";
import { getAccessToken } from "@/lib/session-token";
import { useState, useEffect } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase, safeGetSession } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { invokeObpay } from "@/lib/edge-function";
import MerchantAccountPanel from "./MerchantAccountPanel";
import { saveMemberRoles } from "@/lib/member-roles.functions";
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from "@/lib/member-permissions";
import { adminAccountBalances } from "@/lib/admin-insights.functions";


interface Merchant {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  status: string;
  support_agent: boolean;
  role_tag: string | null;
  memberRoles?: MemberRole[];
  created_at: string;
  merchant_profiles: {
    company_name: string;
    country: string;
    verification_status: string;
    business_address: string;
    merchant_slug: string;
    merchant_id: string;
  }[] | null;
}

interface WalletData {
  currency?: string;
  withdrawals_enabled?: boolean;
  available_balance: number;
  pending_balance: number;
  total_collections: number;
  total_payouts: number;
}

function formatCurrency(amount: number, currency = "UGX") { return currency + " " + amount.toLocaleString("en-UG"); }

export default function AdminMerchants() {
  const { profile: adminProfile, session } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMemberRoles, setSavingMemberRoles] = useState(false);
  const [error, setError] = useState("");
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; message: string } | null>(null);

  // Balance management
  const [balanceModal, setBalanceModal] = useState<{ type: "add" | "deduct"; merchantId: string; merchantName: string; currentBalance: number } | null>(null);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);
  const [balanceData, setBalanceData] = useState<Record<string, WalletData>>({});
  const [detailWallet, setDetailWallet] = useState<WalletData | null>(null);
  const [accountHistoryVersion, setAccountHistoryVersion] = useState(0);

  // Role management
  const [roleConfirm, setRoleConfirm] = useState<{ merchantId: string; merchantName: string; newRole: string } | null>(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  // Password reset state
  const [resetPwModal, setResetPwModal] = useState<{ merchantId: string; merchantName: string } | null>(null);
  const [newUserPassword, setNewUserPassword] = useState("");
  const [resetPwSubmitting, setResetPwSubmitting] = useState(false);
  const [resetPwError, setResetPwError] = useState("");

  // Impersonate state
  const [impersonateModal, setImpersonateModal] = useState<{ merchantId: string; merchantName: string; merchantEmail: string } | null>(null);
  const [impersonateLoading, setImpersonateLoading] = useState(false);
  const [impersonateUrl, setImpersonateUrl] = useState("");

  const fetchMerchants = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("profiles")
        .select("*, merchant_profiles!merchant_profiles_user_id_fkey(company_name, country, verification_status, business_address, merchant_slug, merchant_id)")
        .eq("role", "merchant")
        .neq("status", "deactivated")
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      // Also fetch admin users
      const { data: admins } = await supabase
        .from("profiles")
        .select("*, merchant_profiles!merchant_profiles_user_id_fkey(company_name, country, verification_status, business_address, merchant_slug, merchant_id)")
        .eq("role", "admin")
        .order("created_at", { ascending: false });

      const all = [...(data as Merchant[] || []), ...(admins as Merchant[] || [])];
      const { data: memberships, error: membershipError } = await supabase.from("member_roles").select("user_id,role");
      if (membershipError) throw membershipError;
      const { data: baseRoles, error: rolesError } = await supabase.from("user_roles").select("user_id,role");
      if (rolesError) throw rolesError;
      setMerchants(all.map((m) => {
        const roles: MemberRole[] = (memberships || []).filter((r: any) => r.user_id === m.id).map((r: any) => r.role);
        const admin = roles.includes("super_admin") || (baseRoles || []).some((r: any) => r.user_id === m.id && r.role === "admin");
        return { ...m, role: admin ? "admin" : "merchant", memberRoles: roles, role_tag: roles.join(", ") || null, support_agent: roles.includes("support_agent") };
      }));

      const balances = await adminAccountBalances({ data: { accessToken: await getAccessToken() } });
      setBalanceData(balances);
    } catch (err: any) {
      setError(err.message || "Failed to load merchants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, []);

  const filtered = merchants.filter((m) => {
    const mp = m.merchant_profiles?.[0];
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (verificationFilter !== "all" && mp?.verification_status !== verificationFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const companyName = mp?.company_name || "";
      if (!companyName.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q) && !m.full_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selected = selectedMerchantId ? merchants.find((m) => m.id === selectedMerchantId) : null;

  const loadDetailWallet = async (merchantId: string) => {
    const balances = await adminAccountBalances({ data: { accessToken: await getAccessToken() } });
    setBalanceData(balances);
    setDetailWallet(balances[merchantId] || null);
  };

  useEffect(() => {
    let stopped = false;
    const refresh = async () => {
      try {
        const balances = await adminAccountBalances({ data: { accessToken: await getAccessToken() } });
        if (stopped) return;
        setBalanceData(balances);
        if (selectedMerchantId) setDetailWallet(balances[selectedMerchantId] || null);
      } catch { /* keep the last confirmed values during a temporary outage */ }
    };
    const interval = window.setInterval(refresh, 5000);
    const channel = supabase.channel("admin-account-balances")
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_wallets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "merchant_balances" }, refresh).subscribe();
    return () => { stopped = true; window.clearInterval(interval); void supabase.removeChannel(channel); };
  }, [selectedMerchantId]);

  const handleToggleStatus = async (merchantId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    try {
      await supabase.from("profiles").update({ status: newStatus }).eq("id", merchantId);
      setActionMsg({ ok: true, message: `User ${newStatus === "active" ? "activated" : "suspended"} successfully.` });
      setTimeout(() => setActionMsg(null), 3000);
      fetchMerchants();
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to update status" });
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const handleDeleteMerchant = async (merchantId: string, name: string) => {
    if (window.prompt(`This permanently erases ${name || "this merchant"}, their documents, keys, links and records. Type DELETE to confirm.`) !== "DELETE") return;
    try {
      const accessToken = await getAccessToken();
      const r: any = await purgeMerchantData({ data: { accessToken, merchantId } }).catch((e: any) => ({ success: false, error: e?.message }));
      if (!r?.success) console.warn("[delete-merchant] cleanup:", r?.error);
      // Keep the profile row as a permanent block (deleting it would let sign-in re-create the account).
      const { error: blockErr } = await supabase.from("profiles").update({ status: "deactivated" }).eq("id", merchantId);
      if (blockErr) throw new Error(blockErr.message);
      await supabase.from("merchant_wallets").update({ available_balance: 0, pending_balance: 0, withdrawals_enabled: false }).eq("user_id", merchantId);
      setMerchants((prev) => prev.filter((m) => m.id !== merchantId));
      setSelectedMerchantId(null);
      setActionMsg({ ok: true, message: `${name || "Merchant"} has been deleted.` });
      setTimeout(() => setActionMsg(null), 3000);
      fetchMerchants();
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to delete merchant" });
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const handleBanUser = async (merchantId: string, merchantName: string) => {
    try {
      await supabase.from("profiles").update({ status: "suspended" }).eq("id", merchantId);
      setActionMsg({ ok: true, message: `${merchantName} has been banned.` });
      setTimeout(() => setActionMsg(null), 3000);
      fetchMerchants();
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to ban user" });
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const handleChangeRole = async () => {
    if (!roleConfirm) return;
    setRoleSubmitting(true);
    try {
      await saveMemberRoles({ data: { accessToken: await getAccessToken(), userId: roleConfirm.merchantId, roles: roleConfirm.newRole === "admin" ? ["super_admin"] : [] } });
      setActionMsg({ ok: true, message: `${roleConfirm.merchantName} is now ${roleConfirm.newRole === "admin" ? "an Admin" : "a Merchant"}.` });
      setTimeout(() => setActionMsg(null), 3000);
      setRoleConfirm(null);
      fetchMerchants();
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to change role" });
      setTimeout(() => setActionMsg(null), 3000);
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleMemberRoles = async (merchantId: string, roles: MemberRole[]) => {
    if (savingMemberRoles) return;
    setSavingMemberRoles(true);
    try {
      await saveMemberRoles({ data: { accessToken: await getAccessToken(), userId: merchantId, roles } });
      setActionMsg({ ok: true, message: "Member permissions updated." });
      await fetchMerchants();
    } catch (err: any) { setActionMsg({ ok: false, message: err.message || "Permissions could not be saved." }); }
    finally { setSavingMemberRoles(false); }
  };

  const handleAdjustBalance = async () => {
    if (!balanceModal || !balanceAmount) return;
    setBalanceSubmitting(true);
    const adjAmount = parseFloat(balanceAmount);
    if (isNaN(adjAmount) || adjAmount <= 0) {
      setActionMsg({ ok: false, message: "Please enter a valid amount." });
      setTimeout(() => setActionMsg(null), 3000);
      setBalanceSubmitting(false);
      return;
    }

    const merchantId = balanceModal.merchantId;
    const merchantName = balanceModal.merchantName;
    const type = balanceModal.type;

    try {
      // Use edge function with service_role to bypass RLS — guaranteed to work
      const data = await invokeObpay({
        _action: "admin-adjust-balance",
        target_user_id: merchantId,
        adjustment_type: type,
        amount: adjAmount,
        note: balanceNote || undefined,
      });

      if (!data?.success) throw new Error(data?.error || "Balance adjustment failed");

      const result = data.data;

      // Immediately update local state
      const updatedCollections = type === "add"
        ? (balanceData[merchantId]?.total_collections || 0) + adjAmount
        : (balanceData[merchantId]?.total_collections || 0);
      const updatedPayouts = type === "deduct"
        ? (balanceData[merchantId]?.total_payouts || 0) + adjAmount
        : (balanceData[merchantId]?.total_payouts || 0);

      setBalanceData(prev => ({
        ...prev,
        [merchantId]: {
          available_balance: result.new_balance,
          pending_balance: prev[merchantId]?.pending_balance || 0,
          total_collections: updatedCollections,
          total_payouts: updatedPayouts,
        },
      }));

      setDetailWallet({
        available_balance: result.new_balance,
        pending_balance: detailWallet?.pending_balance || 0,
        total_collections: updatedCollections,
        total_payouts: updatedPayouts,
      });
      setAccountHistoryVersion((version) => version + 1);

      setActionMsg({
        ok: true,
        message: `${type === "add" ? "Added" : "Deducted"} ${formatCurrency(adjAmount)} ${type === "add" ? "to" : "from"} ${merchantName}'s balance. New balance: ${formatCurrency(result.new_balance)}`,
      });
      setTimeout(() => setActionMsg(null), 4000);
      setBalanceModal(null);
      setBalanceAmount("");
      setBalanceNote("");
    } catch (err: any) {
      console.error("Balance adjustment error:", err);
      setActionMsg({ ok: false, message: err.message || "Balance adjustment failed. Please try again." });
      setTimeout(() => setActionMsg(null), 5000);
    } finally {
      setBalanceSubmitting(false);
    }
  };

  const handleToggleWithdrawals = async (merchantId: string, merchantName: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    try {
      const data = await invokeObpay({
        _action: "set-withdrawal-limit",
        target_user_id: merchantId,
        withdrawals_enabled: newEnabled,
      });

      if (!data?.success) throw new Error(data?.error || "Failed to toggle withdrawals");

      // Update local state immediately
      setBalanceData(prev => ({
        ...prev,
        [merchantId]: {
          ...prev[merchantId],
          withdrawals_enabled: data.data?.withdrawals_enabled ?? newEnabled,
          available_balance: prev[merchantId]?.available_balance || 0,
          pending_balance: prev[merchantId]?.pending_balance || 0,
          total_collections: prev[merchantId]?.total_collections || 0,
          total_payouts: prev[merchantId]?.total_payouts || 0,
        },
      }));

      setDetailWallet(prev => prev ? { ...prev, withdrawals_enabled: data.data?.withdrawals_enabled ?? newEnabled } : null);

      setActionMsg({
        ok: true,
        message: `Withdrawals ${newEnabled ? "enabled" : "disabled"} for ${merchantName}.`,
      });
      setTimeout(() => setActionMsg(null), 3000);
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to toggle withdrawals" });
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPwModal) return;
    setResetPwSubmitting(true);
    setResetPwError("");
    try {
      const { getAccessToken } = await import("@/lib/session-token");
      const { adminSendResetLink } = await import("@/lib/account.functions");
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Please sign in again to continue.");
      const data: any = await adminSendResetLink({
        data: { accessToken, targetUserId: resetPwModal.merchantId, origin: window.location.origin },
      });

      if (!data?.success) throw new Error(data?.error || "Password reset failed");

      // Audit log (best effort)
      void supabase.from("audit_logs").insert({
        user_id: adminProfile?.id,
        user_name: adminProfile?.full_name || "Admin",
        action: "password_reset",
        resource: "profiles",
        resource_id: resetPwModal.merchantId,
        details: {
          target_user: resetPwModal.merchantName,
          performed_by: adminProfile?.id,
        },
      });

      setActionMsg({ ok: true, message: `Reset link emailed to ${resetPwModal.merchantName}.` });
      setTimeout(() => setActionMsg(null), 3000);
      setResetPwModal(null);
      setNewUserPassword("");
    } catch (err: any) {
      const m = /admin only|403/i.test(err?.message || "") ? "Your admin account isn't allowed to change passwords." : /unauthor|401|jwt/i.test(err?.message || "") ? "Your admin session expired. Log in again and retry." : err?.message || "Password reset failed";
      setResetPwError(m);
      setActionMsg({ ok: false, message: m });
      setTimeout(() => setActionMsg(null), 5000);
    } finally {
      setResetPwSubmitting(false);
    }
  };

  const handleImpersonate = async () => {
    if (!impersonateModal) return;
    setImpersonateLoading(true);
    setImpersonateUrl("");
    try {
      const { data: sessionData } = await safeGetSession();
      const session = sessionData?.session;
      if (!session?.access_token) throw new Error("Not authenticated");

      const data = await invokeObpay({
        _action: "impersonate-user",
        target_user_id: impersonateModal.merchantId,
        origin: window.location.origin,
      });

      if (!data?.success) throw new Error(data?.error || "Impersonation failed");

      setImpersonateUrl(data.data.login_url);
    } catch (err: any) {
      setActionMsg({ ok: false, message: err.message || "Failed to generate login link" });
      setTimeout(() => setActionMsg(null), 5000);
      setImpersonateModal(null);
    } finally {
      setImpersonateLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading users...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-accent-600 text-3xl" />
            </div>
            <p className="text-sm text-foreground-800 mb-4">{error}</p>
            <button
              onClick={fetchMerchants}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" /> Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">Users & Merchants</h1>
            <p className="text-sm text-foreground-600 mt-1">{merchants.length} registered users</p>
          </div>
        </div>

        {actionMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center gap-2 ${actionMsg.ok ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"}`}>
            <i className={actionMsg.ok ? "ri-check-line" : "ri-error-warning-line"} />
            {actionMsg.message}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center bg-background-50 rounded-lg px-3 py-2 border border-background-200/70 flex-1 max-w-sm">
            <i className="ri-search-line text-foreground-400 text-sm mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by company, email or name..."
              className="bg-transparent text-sm text-foreground-700 placeholder-foreground-400 focus:outline-none w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-background-200/70 bg-background-50 text-sm text-foreground-700 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
          >
            <option value="all">All Verification</option>
            <option value="approved">Verified</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-background-200/70">
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">User</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Role Tag</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Contact</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Country</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">KYC</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Wallet</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-foreground-500 text-sm">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => {
                    const mp = m.merchant_profiles?.[0];
                    return (
                      <tr key={m.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${m.role === "admin" ? "bg-accent-100 text-accent-700" : "bg-primary-100 text-primary-700"}`}>
                              {m.full_name?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-foreground-900">{mp?.company_name || m.full_name}</p>
                              <p className="text-[11px] text-foreground-500">{m.full_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${m.role === "admin" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"}`}>
                            {m.role}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          {m.role_tag ? (
                            <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              m.role_tag === "super_admin" ? "bg-accent-100 text-accent-700" :
                              m.role_tag === "support_agent" ? "bg-primary-100 text-primary-700" :
                              m.role_tag === "finance_admin" ? "bg-secondary-100 text-secondary-700" :
                              m.role_tag === "kyc_reviewer" ? "bg-amber-100 text-amber-700" :
                              "bg-background-200 text-foreground-600"
                            }`}>
                              {m.role_tag === "super_admin" ? "Super Admin" :
                               m.role_tag === "support_agent" ? "Support Agent" :
                               m.role_tag === "finance_admin" ? "Finance Admin" :
                               m.role_tag === "kyc_reviewer" ? "KYC Reviewer" :
                               m.role_tag}
                            </span>
                          ) : (
                            <span className="text-[11px] text-foreground-400">—</span>
                          )}
                          {m.support_agent && !m.role_tag && (
                            <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 ml-1">Support</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-foreground-700">{m.email}</p>
                          <p className="text-[11px] text-foreground-500">{m.phone_number || "—"}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-foreground-600">{mp?.country || "—"}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${m.status === "active" ? "bg-primary-100 text-primary-700" : m.status === "suspended" ? "bg-red-100 text-red-700" : "bg-secondary-100 text-secondary-700"}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${mp?.verification_status === "approved" ? "bg-primary-100 text-primary-700" : mp?.verification_status === "rejected" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"}`}>
                            {mp?.verification_status || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="text-xs font-medium text-foreground-900">{balanceData[m.id]?.available_balance !== undefined ? formatCurrency(balanceData[m.id].available_balance, balanceData[m.id].currency) : "—"}</span>
                          {Object.entries((balanceData[m.id] as any)?.wallets || {}).filter(([c, v]) => c !== balanceData[m.id]?.currency && Number(v) !== 0).map(([c, v]) => (
                            <span key={c} className="block text-[10px] text-foreground-500">{formatCurrency(Number(v), c)}</span>
                          ))}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => {
                                const newId = selectedMerchantId === m.id ? null : m.id;
                                setSelectedMerchantId(newId);
                                setDetailWallet(null);
                                if (newId) loadDetailWallet(newId);
                              }}
                              className="text-xs font-medium text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap px-2 py-1 rounded hover:bg-primary-50"
                            >
                              {selectedMerchantId === m.id ? "Close" : "Manage"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => setSelectedMerchantId(null)} />
            <div className="relative w-full max-w-4xl h-full bg-background-50 shadow-2xl flex flex-col">
            <div className="sticky top-0 z-10 bg-background-50 border-b border-background-200/70 p-4 sm:p-5 space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-foreground-900 truncate">
                {selected.merchant_profiles?.[0]?.company_name || selected.full_name}
              </h3>
              <div className="flex items-center gap-2">
                {selected.role_tag && (
                  <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                    selected.role_tag === "super_admin" ? "bg-accent-100 text-accent-700" :
                    selected.role_tag === "support_agent" ? "bg-primary-100 text-primary-700" :
                    selected.role_tag === "finance_admin" ? "bg-secondary-100 text-secondary-700" :
                    selected.role_tag === "kyc_reviewer" ? "bg-amber-100 text-amber-700" :
                    "bg-background-200 text-foreground-600"
                  }`}>
                    {selected.role_tag === "super_admin" ? "Super Admin" :
                     selected.role_tag === "support_agent" ? "Support Agent" :
                     selected.role_tag === "finance_admin" ? "Finance Admin" :
                     selected.role_tag === "kyc_reviewer" ? "KYC Reviewer" :
                     selected.role_tag}
                  </span>
                )}
                {selected.support_agent && (
                  <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                    <i className="ri-headphone-fill mr-1 text-[9px]" />Support Agent
                  </span>
                )}
                <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${selected.role === "admin" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"}`}>
                  {selected.role}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-500 mr-1">Controls</span>
              <button onClick={() => navigator.clipboard?.writeText(selected.id)} className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap bg-background-100 text-foreground-600 hover:bg-background-200 border border-background-300/60"><i className="ri-file-copy-line mr-1" />Copy ID</button>
              {selected.email && <a href={`mailto:${selected.email}`} className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap bg-background-100 text-foreground-600 hover:bg-background-200 border border-background-300/60"><i className="ri-mail-line mr-1" />Email</a>}
              {selected.phone_number && <a href={`https://wa.me/${String(selected.phone_number).replace(/\D/g, "").replace(/^0/, "256")}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap bg-background-100 text-foreground-600 hover:bg-background-200 border border-background-300/60"><i className="ri-whatsapp-line mr-1" />WhatsApp</a>}
              <button onClick={() => handleDeleteMerchant(selected.id, selected.merchant_profiles?.[0]?.company_name || selected.full_name)} className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap bg-red-600 text-white hover:bg-red-700"><i className="ri-delete-bin-line mr-1" />Delete merchant</button>
              <button onClick={() => setSelectedMerchantId(null)} className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer bg-foreground-900 text-background-50"><i className="ri-close-line mr-1" />Close</button>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {/* Status Toggle */}
              <button
                onClick={() => handleToggleStatus(selected.id, selected.status)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${selected.status === "active" ? "text-accent-600 hover:text-accent-700 bg-accent-100 hover:bg-accent-200" : "text-primary-600 hover:text-primary-700 bg-primary-100 hover:bg-primary-200"}`}
              >
                {selected.status === "active" ? "Suspend" : "Activate"}
              </button>

              {/* Ban */}
              {selected.status !== "suspended" && (
                <button
                  onClick={() => handleBanUser(selected.id, selected.full_name)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  Ban User
                </button>
              )}

              {/* Role Change */}
              <button
                onClick={() => setRoleConfirm({
                  merchantId: selected.id,
                  merchantName: selected.full_name,
                  newRole: selected.role === "admin" ? "merchant" : "admin",
                })}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${selected.role === "admin" ? "text-foreground-600 hover:text-foreground-700 bg-background-100 hover:bg-background-200" : "text-accent-600 hover:text-accent-700 bg-accent-100 hover:bg-accent-200"}`}
              >
                {selected.role === "admin" ? "Demote to Merchant" : "Promote to Admin"}
              </button>

              <fieldset className="flex flex-wrap gap-3 border border-background-300/60 rounded-lg p-3">
                <legend className="text-xs text-foreground-600 px-1">Member roles</legend>
                {MEMBER_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-xs text-foreground-700 cursor-pointer">
                    <input type="checkbox" disabled={savingMemberRoles} checked={(selected.memberRoles || []).includes(role)}
                      onChange={(e) => handleMemberRoles(selected.id, e.target.checked ? [...(selected.memberRoles || []), role] : (selected.memberRoles || []).filter((r) => r !== role))} />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </fieldset>

              {/* Balance Controls */}
              <button
                onClick={async () => {
                  const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance").eq("user_id", selected.id).maybeSingle();
                  setBalanceModal({ type: "add", merchantId: selected.id, merchantName: selected.full_name, currentBalance: wallet?.available_balance || 0 });
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
              >
                <i className="ri-add-circle-line mr-1" />Add Balance
              </button>
              <button
                onClick={async () => {
                  const { data: wallet } = await supabase.from("merchant_wallets").select("available_balance").eq("user_id", selected.id).maybeSingle();
                  setBalanceModal({ type: "deduct", merchantId: selected.id, merchantName: selected.full_name, currentBalance: wallet?.available_balance || 0 });
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap bg-accent-100 text-accent-700 hover:bg-accent-200 transition-colors"
              >
                <i className="ri-indeterminate-circle-line mr-1" />Deduct Balance
              </button>

              {/* Toggle Withdrawals */}
              <button
                onClick={() => handleToggleWithdrawals(selected.id, selected.full_name, detailWallet?.withdrawals_enabled ?? true)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap transition-colors ${detailWallet?.withdrawals_enabled !== false ? "text-accent-600 hover:text-accent-700 bg-accent-50 hover:bg-accent-100" : "text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100"}`}
              >
                <i className={`${detailWallet?.withdrawals_enabled !== false ? "ri-toggle-line" : "ri-toggle-fill"} mr-1`} />
                {detailWallet?.withdrawals_enabled !== false ? "Disable Withdrawals" : "Enable Withdrawals"}
              </button>

              {/* Reset Password */}
              <button
                onClick={() => setResetPwModal({ merchantId: selected.id, merchantName: selected.full_name })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap bg-background-100 text-foreground-600 hover:bg-background-200 border border-background-300/60 transition-colors"
              >
                <i className="ri-key-2-line mr-1" />Reset Password
              </button>

              {/* Login as User */}
              <button
                onClick={() => setImpersonateModal({
                  merchantId: selected.id,
                  merchantName: selected.full_name,
                  merchantEmail: selected.email,
                })}
                className="text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer whitespace-nowrap bg-accent-500 text-background-50 hover:bg-accent-600 transition-colors"
              >
                <i className="ri-user-shared-line mr-1" />Login as User
              </button>
            </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Wallet Info */}
            <div className="bg-background-100 rounded-lg p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-xs text-foreground-500 mb-1">Available Balance</p>
                <p className="font-bold text-foreground-900">{detailWallet ? formatCurrency(detailWallet.available_balance, detailWallet.currency) : "Loading..."}</p>
                {detailWallet && Object.entries((detailWallet as any).wallets || {}).filter(([c]) => c !== detailWallet.currency).map(([c, v]) => (
                  <p key={c} className="text-[11px] text-foreground-600">{formatCurrency(Number(v), c)}</p>
                ))}
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Pending Balance</p>
                <p className="font-medium text-foreground-700">{detailWallet ? formatCurrency(detailWallet.pending_balance, detailWallet.currency) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Total Collections</p>
                <p className="font-medium text-primary-600">{detailWallet ? formatCurrency(detailWallet.total_collections) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Total Payouts</p>
                <p className="font-medium text-accent-600">{detailWallet ? formatCurrency(detailWallet.total_payouts) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Withdrawals</p>
                {detailWallet ? (
                  <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${detailWallet.withdrawals_enabled ? "bg-primary-100 text-primary-700" : "bg-red-100 text-red-700"}`}>
                    {detailWallet.withdrawals_enabled ? "Enabled" : "Disabled"}
                  </span>
                ) : (
                  <span className="text-xs text-foreground-500">—</span>
                )}
              </div>
            </div>

            {/* User Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-foreground-500 mb-1">Full Name</p>
                <p className="font-medium text-foreground-900">{selected.full_name}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Email</p>
                <p className="font-medium text-foreground-900 text-xs">{selected.email}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Phone</p>
                <p className="font-medium text-foreground-900">{selected.phone_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-500 mb-1">Joined</p>
                <p className="font-medium text-foreground-900 text-xs">{new Date(selected.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* KYC Info */}
            {selected.merchant_profiles?.[0] && (
              <div className="bg-background-100 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-foreground-500 mb-1">Merchant ID</p>
                  <code className="text-xs font-mono text-foreground-700 bg-background-200 px-1.5 py-0.5 rounded">{selected.merchant_profiles[0].merchant_id || "—"}</code>
                </div>
                <div>
                  <p className="text-xs text-foreground-500 mb-1">Slug</p>
                  <code className="text-xs font-mono text-foreground-700 bg-background-200 px-1.5 py-0.5 rounded">{selected.merchant_profiles[0].merchant_slug || "—"}</code>
                </div>
                <div>
                  <p className="text-xs text-foreground-500 mb-1">Business Address</p>
                  <p className="font-medium text-foreground-900 text-xs">{selected.merchant_profiles[0].business_address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground-500 mb-1">Verification</p>
                  <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${selected.merchant_profiles[0].verification_status === "approved" ? "bg-primary-100 text-primary-700" : selected.merchant_profiles[0].verification_status === "rejected" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700"}`}>
                    {selected.merchant_profiles[0].verification_status}
                  </span>
                </div>
              </div>
            )}

            {/* Full account record: documents, integration, activity */}
            <MerchantAccountPanel userId={selected.id} refreshVersion={accountHistoryVersion} />

            </div>
            </div>
          </div>
        )}

        {/* Role Change Confirmation Modal */}
        {roleConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => setRoleConfirm(null)} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-sm">
              <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-admin-line text-accent-600 text-lg" />
              </div>
              <h3 className="font-heading font-semibold text-foreground-900 text-center mb-2">
                {roleConfirm.newRole === "admin" ? "Promote to Admin?" : "Demote to Merchant?"}
              </h3>
              <p className="text-sm text-foreground-600 text-center mb-4">
                {roleConfirm.newRole === "admin"
                  ? `${roleConfirm.merchantName} will gain full admin access to the platform — managing users, transactions, KYC, and system settings.`
                  : `${roleConfirm.merchantName} will lose admin privileges and revert to a regular merchant account.`}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setRoleConfirm(null)} className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleChangeRole}
                  disabled={roleSubmitting}
                  className={`flex-1 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm text-background-50 ${roleConfirm.newRole === "admin" ? "bg-accent-500 hover:bg-accent-600" : "bg-foreground-600 hover:bg-foreground-700"}`}
                >
                  {roleSubmitting ? "Updating..." : `Make ${roleConfirm.newRole === "admin" ? "Admin" : "Merchant"}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetPwModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => { setResetPwModal(null); setNewUserPassword(""); }} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-sm">
              <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-key-2-line text-accent-600 text-lg" />
              </div>
              <h3 className="font-heading font-semibold text-foreground-900 text-center mb-2">Reset Password</h3>
              <p className="text-sm text-foreground-600 text-center mb-4">
                We'll email <strong>{resetPwModal.merchantName}</strong> a secure link. The password they choose there becomes their new login.
              </p>
              <div className="space-y-3">
                  {resetPwError && <p role="alert" className="text-xs text-accent-700 bg-accent-100 rounded-lg p-2">{resetPwError}</p>}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setResetPwModal(null); setNewUserPassword(""); setResetPwError(""); }} className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm">Cancel</button>
                  <button onClick={handleResetPassword} disabled={resetPwSubmitting} className="flex-1 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm">{resetPwSubmitting ? "Sending..." : "Send reset link"}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Impersonate Modal */}
        {impersonateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => { setImpersonateModal(null); setImpersonateUrl(""); }} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-md">
              <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-user-shared-line text-accent-600 text-lg" />
              </div>
              <h3 className="font-heading font-semibold text-foreground-900 text-center mb-2">Login as User</h3>

              {!impersonateUrl ? (
                <>
                  <p className="text-sm text-foreground-600 text-center mb-4">
                    You'll be logged in as <strong>{impersonateModal.merchantName}</strong> ({impersonateModal.merchantEmail}) in a new tab. Your current admin session will stay active in this tab.
                  </p>
                  <p className="text-xs text-foreground-500 text-center mb-4 bg-background-100 rounded-lg p-3">
                    A magic link will be generated. Clicking it opens their dashboard exactly as they see it — balances, transactions, collections, everything.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setImpersonateModal(null); setImpersonateUrl(""); }}
                      className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImpersonate}
                      disabled={impersonateLoading}
                      className="flex-1 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm"
                    >
                      {impersonateLoading ? "Generating link..." : "Generate Login Link"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground-600 text-center mb-4">
                    Magic link generated for <strong>{impersonateModal.merchantName}</strong>. Open it in a new tab to login as them.
                  </p>
                  <div className="bg-background-100 rounded-lg p-3 mb-4">
                    <p className="text-xs text-foreground-500 mb-1">Login URL:</p>
                    <code className="text-[10px] text-foreground-700 break-all">{impersonateUrl}</code>
                  </div>
                  <p className="text-xs text-foreground-500 text-center mb-4">
                    An email with this magic link has also been sent to {impersonateModal.merchantEmail}.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setImpersonateModal(null); setImpersonateUrl(""); }}
                      className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm"
                    >
                      Close
                    </button>
                    <a
                      href={impersonateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm text-center flex items-center justify-center gap-1"
                    >
                      <i className="ri-external-link-line" /> Open Dashboard
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Balance Adjustment Modal */}
        {balanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => { setBalanceModal(null); setBalanceAmount(""); setBalanceNote(""); }} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-sm">
              <h3 className="font-heading font-semibold text-foreground-900 mb-1">
                {balanceModal.type === "add" ? "Add Balance" : "Deduct Balance"}
              </h3>
              <p className="text-xs text-foreground-600 mb-4">
                {balanceModal.type === "add" ? "Credit" : "Debit"} {balanceModal.merchantName}'s wallet. Current balance: <strong>{formatCurrency(balanceModal.currentBalance)}</strong>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Amount (UGX)</label>
                  <input
                    type="number"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    value={balanceNote}
                    onChange={(e) => setBalanceNote(e.target.value)}
                    placeholder="Reason for adjustment"
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setBalanceModal(null); setBalanceAmount(""); setBalanceNote(""); }}
                    className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdjustBalance}
                    disabled={balanceSubmitting || !balanceAmount}
                    className={`flex-1 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm text-background-50 ${balanceModal.type === "add" ? "bg-primary-500 hover:bg-primary-600" : "bg-accent-500 hover:bg-accent-600"}`}
                  >
                    {balanceSubmitting ? "Processing..." : balanceModal.type === "add" ? "Add Funds" : "Deduct Funds"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}