import { useState, useEffect } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface MerchantProfile {
  verified_at?: string | null;
  id: string | null;
  user_id: string;
  company_name: string;
  country: string;
  business_address: string;
  national_id: string;
  id_front_url: string;
  id_back_url: string;
  verification_status: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone_number: string;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "1d ago";
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminKYCReview() {
  const { profile: adminProfile } = useAuth();
  const [reviews, setReviews] = useState<MerchantProfile[]>([]);
  const [selectedReview, setSelectedReview] = useState<MerchantProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch ALL merchant profiles with their user profile data
      const { data: profiles, error: profilesErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "merchant")
        .order("created_at", { ascending: false });

      if (profilesErr) throw profilesErr;

      // Fetch all merchant_profile records for these users
      const userIds = (profiles || []).map((p) => p.id);
      const { data: mps, error: mpsErr } = await supabase
        .from("merchant_profiles")
        .select("*")
        .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

      if (mpsErr) throw mpsErr;

      // Merge: every merchant profile gets a review entry, even if no KYC submitted
      const merged: MerchantProfile[] = (profiles || []).map((p) => {
        const mp = (mps || []).find((m) => m.user_id === p.id);
        return {
          id: mp?.id || null,
          user_id: p.id,
          company_name: mp?.company_name || "Not submitted",
          country: mp?.country || "—",
          business_address: mp?.business_address || "",
          national_id: mp?.national_id || "",
          id_front_url: mp?.id_front_url || "",
          id_back_url: mp?.id_back_url || "",
          verification_status: mp?.verification_status || "pending",
          rejection_reason: mp?.rejection_reason || "",
          created_at: mp?.created_at || p.created_at || new Date().toISOString(),
          updated_at: mp?.updated_at || "",
          profiles: {
            full_name: p.full_name || "Unknown",
            email: p.email || "",
            phone_number: p.phone_number || "",
          },
        };
      });

      setReviews(merged);
    } catch (err: any) {
      setError(err.message || "Failed to load KYC reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const filteredReviews = filterStatus === "all"
    ? reviews
    : reviews.filter((r) => r.verification_status === filterStatus);

  const handleSeedTestData = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const { data, error: seedErr } = await supabase.functions.invoke("kyc-seed-test-data", {
        body: { action: "seed" },
      });
      if (seedErr) throw seedErr;
      const created = data?.results?.filter((r: any) => r.status === "created").length || 0;
      setSeedResult(`Created ${created} test merchant(s) with pending KYC.`);
      fetchReviews();
    } catch (err: any) {
      setSeedResult(`Failed: ${err.message || "Unknown error"}`);
    } finally {
      setSeeding(false);
    }
  };

  const generateMerchantId = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "MCH-";
    for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const generateApiKey = (prefix: string): string => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = prefix;
    for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 40);
  };

  const handleApprove = async (review: MerchantProfile) => {
    try {
      const merchantId = generateMerchantId();
      const slug = slugify(review.company_name) + "-" + Math.random().toString(36).substring(2, 8);
      const publicKey = generateApiKey("pk_live_");
      const secretKey = generateApiKey("sk_live_");
      const webhookSecret = generateApiKey("whsec_");
      const now = new Date().toISOString();

      // 1. Create or update merchant_profiles with merchant_id, slug, approval
      const { error: upsertErr } = await supabase
        .from("merchant_profiles")
        .upsert(
          {
            user_id: review.user_id,
            company_name: review.company_name,
            country: review.country,
            business_address: review.business_address,
            national_id: review.national_id,
            id_front_url: review.id_front_url || "",
            id_back_url: review.id_back_url || "",
            verification_status: "approved",
            verified_at: now,
            verified_by: adminProfile?.id,
            merchant_id: merchantId,
            merchant_slug: slug,
            credentials_generated: true,
          },
          { onConflict: "user_id" }
        );

      if (upsertErr) throw upsertErr;

      // 2. Activate the merchant's profile
      await supabase
        .from("profiles")
        .update({ status: "active" })
        .eq("id", review.user_id);

      // 3. Create API keys record
      await supabase.from("api_keys").upsert(
        {
          user_id: review.user_id,
          public_key: publicKey,
          secret_key: secretKey,
          webhook_secret: webhookSecret,
          environment: "live",
          status: "active",
        },
        { onConflict: "user_id" }
      );

      // 4. Create merchant wallet
      await supabase.from("merchant_wallets").upsert(
        {
          user_id: review.user_id,
          available_balance: 0,
          pending_balance: 0,
          total_collections: 0,
          total_payouts: 0,
          currency: "UGX",
        },
        { onConflict: "user_id" }
      );

      // 5. Create default webhook config
      await supabase.from("webhook_configs").upsert(
        {
          user_id: review.user_id,
          webhook_url: "",
          webhook_secret: webhookSecret,
          is_active: false,
        },
        { onConflict: "user_id" }
      );

      // 6. Create permanent payment link (slug-based, flexible amount, no expiry)
      await supabase.from("payment_links").upsert(
        {
          user_id: review.user_id,
          amount: 0,
          currency: "UGX",
          description: `Payment to ${review.company_name}`,
          reference: `MERCHANT_${merchantId}`,
          url_slug: slug,
          status: "active",
          expiry_date: null,
        },
        { onConflict: "url_slug" }
      );

      // 7. Send notification to merchant
      await supabase.from("notifications").insert({
        user_id: review.user_id,
        type: "verification_approved",
        title: "Verification Approved — You're Live!",
        message: `Your KYC verification has been approved! Your merchant ID is ${merchantId}. You can now start collecting payments, create payment links, use your API keys for website integration, and request payouts. Your payment page is live at obpay.online/pay/${slug}`,
        is_read: false,
      });

      // 8. Send account verified email
      const merchantEmail = review.profiles?.email;
      if (merchantEmail) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            email: merchantEmail,
            type: "account_verified",
            data: {
              company_name: review.company_name,
              merchant_id: merchantId,
              merchant_slug: slug,
              verified_at: now,
            },
          },
        }).then(() => {}, (e) => console.warn("[KYC] Verified email failed silently:", e));
      }

      // 9. Audit log
      await supabase.from("audit_logs").insert({
        user_id: adminProfile?.id,
        user_name: adminProfile?.full_name || "Admin",
        action: "kyc_approved",
        resource: "merchant_profiles",
        resource_id: review.id ? String(review.id) : review.user_id,
        details: {
          company: review.company_name,
          approved_by: adminProfile?.id,
          merchant_id: merchantId,
          merchant_slug: slug,
          credentials_generated: true,
          payment_link_created: true,
          webhook_configured: true,
          no_documents: !review.id_front_url,
        },
      });

      setSelectedReview(null);
      fetchReviews();
    } catch (err: any) {
      setError(err.message || "Failed to approve");
    }
  };

  const handleReject = async () => {
    if (!selectedReview || !rejectReason.trim()) return;
    try {
      const { error: updateErr } = await supabase
        .from("merchant_profiles")
        .upsert(
          {
            user_id: selectedReview.user_id,
            verification_status: "rejected",
            rejection_reason: rejectReason,
          },
          { onConflict: "user_id" }
        );

      if (updateErr) throw updateErr;

      // Send KYC rejection email
      const merchantEmail = selectedReview.profiles?.email;
      if (merchantEmail) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            email: merchantEmail,
            type: "account_rejected",
            data: {
              company_name: selectedReview.company_name,
              rejection_reason: rejectReason,
              full_name: selectedReview.profiles?.full_name || "",
            },
          },
        }).then(() => {}, (e: any) => console.warn("[KYC] Rejection email failed silently:", e));
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: adminProfile?.id,
        user_name: adminProfile?.full_name || "Admin",
        action: "kyc_rejected",
        resource: "merchant_profiles",
        resource_id: selectedReview.id ? String(selectedReview.id) : selectedReview.user_id,
        details: { company: selectedReview.company_name, reason: rejectReason, rejected_by: adminProfile?.id },
      });

      setSelectedReview(null);
      setShowRejectModal(false);
      setRejectReason("");
      fetchReviews();
    } catch (err: any) {
      setError(err.message || "Failed to reject");
    }
  };

  const pendingCount = reviews.filter((r) => r.verification_status === "pending").length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">Loading KYC reviews...</p>
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
              onClick={fetchReviews}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" />
              Retry
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground-900">KYC Review</h1>
            <p className="text-sm text-foreground-600 mt-1">
              Review and verify merchant identity documents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground-600">{pendingCount} pending</span>
            <button
              onClick={handleSeedTestData}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 bg-accent-100 hover:bg-accent-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <i className={`${seeding ? "ri-loader-4-line animate-spin" : "ri-seedling-line"}`} />
              {seeding ? "Seeding..." : "Seed Test Data"}
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        {seedResult && (
          <div className={`rounded-lg px-4 py-2.5 text-sm ${
            seedResult.startsWith("Created")
              ? "bg-primary-100 text-primary-700"
              : "bg-accent-100 text-accent-700"
          }`}>
            {seedResult}
          </div>
        )}
        <div className="flex items-center gap-1 bg-background-200/70 rounded-full p-1 w-fit">
          {(["all", "pending", "approved", "rejected"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap capitalize ${
                filterStatus === status
                  ? "bg-background-50 text-foreground-900"
                  : "text-foreground-500 hover:text-foreground-700"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Review List */}
        {!selectedReview ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background-200/70">
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Merchant</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Company</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Country</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Submitted</th>
                    <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-foreground-500 text-sm">
                        <p className="mb-3">No KYC reviews found</p>
                        <button
                          onClick={handleSeedTestData}
                          disabled={seeding}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 bg-accent-100 hover:bg-accent-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          <i className={`${seeding ? "ri-loader-4-line animate-spin" : "ri-seedling-line"}`} />
                          {seeding ? "Seeding..." : "Seed Test Data"}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredReviews.map((review) => (
                      <tr key={review.user_id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-foreground-900">
                              {review.profiles?.full_name || "Unknown"}
                            </p>
                            {!review.id_front_url && (
                              <span className="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-100 text-accent-600 whitespace-nowrap">
                                No docs
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-xs text-foreground-700">{review.company_name}</p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-foreground-600">{review.country}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-foreground-500">{timeAgo(review.created_at)}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            review.verification_status === "approved" ? "bg-primary-100 text-primary-700" :
                            review.verification_status === "rejected" ? "bg-accent-100 text-accent-700" :
                            "bg-secondary-100 text-secondary-700"
                          }`}>
                            {review.verification_status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setSelectedReview(review)}
                            className="text-xs font-medium text-primary-500 hover:text-primary-600 cursor-pointer whitespace-nowrap"
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Detail View */
          <div className="space-y-6">
            <button
              onClick={() => setSelectedReview(null)}
              className="inline-flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-900 cursor-pointer"
            >
              <i className="ri-arrow-left-line" />
              Back to list
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left - Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Merchant Info */}
                <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
                  <h3 className="font-heading font-semibold text-foreground-900 mb-4">Merchant Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-foreground-500 mb-1">Full Name</p>
                      <p className="font-medium text-foreground-900">
                        {selectedReview.profiles?.full_name || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-500 mb-1">Company Name</p>
                      <p className="font-medium text-foreground-900">{selectedReview.company_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-500 mb-1">Email</p>
                      <p className="font-medium text-foreground-900">
                        {selectedReview.profiles?.email || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-500 mb-1">Phone</p>
                      <p className="font-medium text-foreground-900">
                        {selectedReview.profiles?.phone_number || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-500 mb-1">Country</p>
                      <p className="font-medium text-foreground-900">{selectedReview.country}</p>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-500 mb-1">National ID</p>
                      <code className="text-xs text-foreground-600 bg-background-100 px-2 py-0.5 rounded">
                        {selectedReview.national_id}
                      </code>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-foreground-500 mb-1">Business Address</p>
                      <p className="font-medium text-foreground-900">{selectedReview.business_address}</p>
                    </div>
                    {selectedReview.rejection_reason && (
                      <div className="col-span-2">
                        <p className="text-xs text-foreground-500 mb-1">Rejection Reason</p>
                        <p className="text-sm text-accent-700">{selectedReview.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ID Documents */}
                <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
                  <h3 className="font-heading font-semibold text-foreground-900 mb-4">ID Documents</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-foreground-500 mb-2">Front of National ID</p>
                      <div className="rounded-lg border border-background-200/70 overflow-hidden bg-background-100">
                        {selectedReview.id_front_url ? (
                          <img
                            src={selectedReview.id_front_url}
                            alt="National ID Front"
                            className="w-full h-56 object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-56 flex items-center justify-center text-foreground-400">
                            <p className="text-xs">No image uploaded</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-foreground-500 mb-2">Back of National ID</p>
                      <div className="rounded-lg border border-background-200/70 overflow-hidden bg-background-100">
                        {selectedReview.id_back_url ? (
                          <img
                            src={selectedReview.id_back_url}
                            alt="National ID Back"
                            className="w-full h-56 object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-56 flex items-center justify-center text-foreground-400">
                            <p className="text-xs">No image uploaded</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Actions */}
              <div className="space-y-4">
                <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
                  <h3 className="font-heading font-semibold text-foreground-900 mb-4">Review Decision</h3>

                  {!selectedReview.id_front_url && (
                    <div className="mb-4 p-3 rounded-lg bg-secondary-50 border border-secondary-200">
                      <p className="text-xs text-secondary-800">
                        <i className="ri-information-line mr-1" />
                        This merchant has not uploaded any identity documents. You can still approve them manually.
                      </p>
                    </div>
                  )}

                  {selectedReview.verification_status === "pending" ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => handleApprove(selectedReview)}
                        className="w-full bg-primary-500 hover:bg-primary-600 text-background-50 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-sm"
                      >
                        <i className="ri-check-line" />
                        Approve Verification
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        className="w-full bg-accent-500 hover:bg-accent-600 text-background-50 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap text-sm"
                      >
                        <i className="ri-close-line" />
                        Reject Verification
                      </button>
                    </div>
                  ) : (
                    <div className={`rounded-lg px-4 py-3 text-sm ${
                      selectedReview.verification_status === "approved"
                        ? "bg-primary-100 text-primary-700"
                        : "bg-accent-100 text-accent-700"
                    }`}>
                      <p className="font-semibold capitalize">{selectedReview.verification_status}</p>
                      <p className="text-xs mt-1 text-foreground-600">
                        {selectedReview.verification_status === "approved"
                          ? "This merchant has been verified."
                          : "This verification was rejected."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
                  <h3 className="font-heading font-semibold text-foreground-900 mb-4 text-sm">Activity</h3>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-secondary-100 flex items-center justify-center shrink-0 mt-0.5">
                        <i className="ri-time-line text-secondary-600 text-xs" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground-900">KYC Submitted</p>
                        <p className="text-[11px] text-foreground-500">{timeAgo(selectedReview.created_at)}</p>
                      </div>
                    </div>
                    {selectedReview.verified_at && (
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                          <i className="ri-check-line text-primary-600 text-xs" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground-900">Verified</p>
                          <p className="text-[11px] text-foreground-500">{timeAgo(selectedReview.verified_at)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => setShowRejectModal(false)} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-md">
              <h3 className="font-heading font-semibold text-foreground-900 mb-2">Reject Verification</h3>
              <p className="text-sm text-foreground-600 mb-4">
                Please provide a reason for rejecting this verification.
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                maxLength={500}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 placeholder-foreground-400 focus:outline-none focus:ring-2 focus:ring-accent-400 resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                  className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="flex-1 bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}