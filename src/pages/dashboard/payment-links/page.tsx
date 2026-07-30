import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface PaymentLink {
  id: string; amount: number; currency: string; description: string; reference: string;
  url_slug: string; redirect_url: string; status: string; expiry_date: string; created_at: string;
}

function formatCurrency(amount: number) { return "UGX " + amount.toLocaleString("en-UG"); }

export default function PaymentLinksPage() {
  const { user, profile } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [merchantSlug, setMerchantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ amount: "", currency: "UGX", description: "", reference: "", expiryDays: "7" });
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const isVerified = profile?.status === "active";

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError("");
    try {
      const [linksRes, merchantRes] = await Promise.all([
        supabase.from("payment_links").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("merchant_profiles").select("merchant_slug").eq("user_id", user.id).maybeSingle(),
      ]);
      if (linksRes.error) throw linksRes.error;
      setLinks((linksRes.data as PaymentLink[]) || []);
      setMerchantSlug(merchantRes.data?.merchant_slug || null);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const slug = `pay-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const expiry = new Date(); expiry.setDate(expiry.getDate() + parseInt(form.expiryDays));
      const ref = form.reference || `LINK_${Date.now()}`;

      await supabase.from("payment_links").insert({
        user_id: user.id, amount: parseFloat(form.amount) || 0, currency: form.currency,
        description: form.description, reference: ref, url_slug: slug,
        expiry_date: expiry.toISOString(), status: "active",
      });

      setForm({ amount: "", currency: "UGX", description: "", reference: "", expiryDays: "7" });
      setShowCreate(false);
      fetchData();
    } catch (err: any) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleToggleStatus = async (link: PaymentLink) => {
    const newStatus = link.status === "active" ? "disabled" : "active";
    await supabase.from("payment_links").update({ status: newStatus }).eq("id", link.id);
    fetchData();
  };

  const handleDelete = async (link: PaymentLink) => {
    await supabase.from("payment_links").delete().eq("id", link.id);
    fetchData();
  };

  const getPaymentLinkUrl = (slug: string) => {
    return `${window.location.origin}/pay/${slug}`;
  };

  const copyUrl = (slug: string) => {
    const url = getPaymentLinkUrl(slug);
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return (<DashboardLayout><div className="flex items-center justify-center py-24"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div></DashboardLayout>);
  if (error) return (<DashboardLayout><div className="text-center py-24"><p className="text-sm mb-4">{error}</p><button onClick={fetchData} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button></div></DashboardLayout>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h1 className="font-heading font-bold text-2xl text-foreground-900">Payment Links</h1><p className="text-sm text-foreground-600 mt-1">Create shareable payment links and QR codes for your customers</p></div>
          <button onClick={() => setShowCreate(true)} disabled={!isVerified} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer whitespace-nowrap transition-colors ${isVerified ? "bg-primary-500 hover:bg-primary-600 text-background-50" : "bg-background-200 text-foreground-400 cursor-not-allowed"}`}>
            <i className="ri-add-line" />New Payment Link
          </button>
        </div>

        {!isVerified && (
          <div className="bg-accent-100 rounded-xl p-4 text-sm text-accent-700 flex items-center gap-3"><i className="ri-lock-line text-lg" /><span>Complete KYC to create payment links. <a href="/dashboard/kyc" className="font-medium underline">Verify now →</a></span></div>
        )}

        {/* Permanent payment page */}
            {merchantSlug && isVerified && (
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center"><i className="ri-link-m text-primary-600 text-lg" /></div>
                  <div>
                    <p className="text-sm font-medium text-foreground-900">Your Payment Page</p>
                    <code className="text-xs text-foreground-600">{getPaymentLinkUrl(merchantSlug)}</code>
                  </div>
                </div>
                <button onClick={() => copyUrl(merchantSlug)} className="w-10 h-10 rounded-lg bg-background-100 hover:bg-background-200 flex items-center justify-center text-foreground-500 hover:text-primary-600 transition-colors cursor-pointer">
                  <i className={copied === merchantSlug ? "ri-check-line text-primary-500" : "ri-file-copy-line"} />
                </button>
              </div>
            )}

        {links.length === 0 ? (
          <div className="bg-background-50 rounded-xl border border-background-200/70 text-center py-16">
            <div className="w-16 h-16 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-4"><i className="ri-link-m text-foreground-400 text-2xl" /></div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">No payment links</h3>
            <p className="text-sm text-foreground-600 mb-4">Create shareable payment links for your customers</p>
            {isVerified && <button onClick={() => setShowCreate(true)} className="bg-primary-500 text-background-50 px-5 py-2.5 rounded-lg font-medium text-sm cursor-pointer">Create Your First Link</button>}
          </div>
        ) : (
          <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background-200/70">
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Amount</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Reference</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Expiry</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-foreground-500 uppercase">Actions</th>
                </tr></thead>
                <tbody>
                  {links.map((link) => (
                    <tr key={link.id} className="border-b border-background-100 hover:bg-background-100/50 transition-colors">
                      <td className="px-5 py-3"><p className="text-sm font-medium text-foreground-900">{link.description || "Payment Link"}</p><p className="text-xs text-foreground-500">{getPaymentLinkUrl(link.url_slug)}</p></td>
                      <td className="px-5 py-3"><span className="text-sm font-semibold text-foreground-900">{link.amount > 0 ? formatCurrency(link.amount) : "Flexible"}</span></td>
                      <td className="px-5 py-3"><span className="text-xs font-mono text-foreground-700">{link.reference}</span></td>
                      <td className="px-5 py-3 text-center"><span className={`inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full ${link.status==="active"?"bg-primary-100 text-primary-700":"bg-background-200 text-foreground-600"}`}>{link.status}</span></td>
                      <td className="px-5 py-3"><span className="text-xs text-foreground-500">{link.expiry_date ? new Date(link.expiry_date).toLocaleDateString() : "No expiry"}</span></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => copyUrl(link.url_slug)} className="w-8 h-8 rounded-lg hover:bg-background-200/70 flex items-center justify-center text-foreground-500 hover:text-primary-600 transition-colors cursor-pointer" title="Copy URL">
                            <i className={copied === link.url_slug ? "ri-check-line" : "ri-file-copy-line"} />
                          </button>
                          <button onClick={() => handleToggleStatus(link)} className="w-8 h-8 rounded-lg hover:bg-background-200/70 flex items-center justify-center text-foreground-500 hover:text-accent-600 transition-colors cursor-pointer" title={link.status === "active" ? "Disable" : "Enable"}>
                            <i className={link.status === "active" ? "ri-pause-circle-line" : "ri-play-circle-line"} />
                          </button>
                          <button onClick={() => handleDelete(link)} className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-foreground-500 hover:text-red-600 transition-colors cursor-pointer" title="Delete">
                            <i className="ri-delete-bin-line" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-foreground-900/40" onClick={() => setShowCreate(false)} />
            <div className="relative bg-background-50 rounded-xl border border-background-200/70 p-6 w-full max-w-md">
              <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-4">Create Payment Link</h3>
              <form onSubmit={handleCreate} className="space-y-4">
                <div><label className="block text-xs font-medium text-foreground-600 mb-1">Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Payment for services" className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-foreground-600 mb-1">Amount (UGX)</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="50000" className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" required /></div>
                  <div><label className="block text-xs font-medium text-foreground-600 mb-1">Expiry (days)</label><select value={form.expiryDays} onChange={(e) => setForm({ ...form, expiryDays: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm cursor-pointer"><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></div>
                </div>
                <div><label className="block text-xs font-medium text-foreground-600 mb-1">Reference (optional)</label><input type="text" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Auto-generated" className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" /></div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-background-300/60 text-foreground-700 font-medium py-2 rounded-lg hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap text-sm">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium py-2 rounded-lg transition-colors cursor-pointer whitespace-nowrap text-sm">{submitting ? "Creating..." : "Create Link"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}