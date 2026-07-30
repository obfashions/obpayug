import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { supabase } from "@/lib/supabase";

interface PlatformSettings {
  id: string;
  platform_fee_percent: number;
  min_collection_amount: number;
  min_payout_amount: number;
  max_payout_amount: number;
  maintenance_mode: boolean;
  kyc_required: boolean;
  require_login_verification: boolean;
  supported_currencies: string[];
  supported_payment_methods: string[];
  payout_processing_time: string;
  auto_approve_threshold: number;
  payout_flat_fee: number;
  withdraw_fee_percent: number;
  platform_airtel_number: string;
  withdraw_from_julypay: boolean;
  withdraw_from_livepay: boolean;
  livepay_api_key?: string;
  livepay_account_number?: string;
  support_email: string;
  support_phone: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: fErr } = await supabase.from("platform_settings").select("*").limit(1).maybeSingle();
      if (fErr) throw fErr;
      if (data) setSettings(data as PlatformSettings);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true); setError("");
    try {
      const { error: upErr } = await supabase.from("platform_settings").update({
        platform_fee_percent: settings.platform_fee_percent,
        min_payout_amount: settings.min_payout_amount,
        max_payout_amount: settings.max_payout_amount,
        min_collection_amount: settings.min_collection_amount,
        maintenance_mode: settings.maintenance_mode,
        kyc_required: settings.kyc_required,
        require_login_verification: settings.require_login_verification,
        supported_currencies: settings.supported_currencies,
        supported_payment_methods: settings.supported_payment_methods,
        payout_processing_time: settings.payout_processing_time,
        auto_approve_threshold: settings.auto_approve_threshold,
        payout_flat_fee: settings.payout_flat_fee,
        withdraw_fee_percent: settings.withdraw_fee_percent,
        platform_airtel_number: settings.platform_airtel_number,
        withdraw_from_julypay: settings.withdraw_from_julypay,
        withdraw_from_livepay: settings.withdraw_from_livepay,
        livepay_account_number: settings.livepay_account_number || "",
        support_email: settings.support_email,
        support_phone: settings.support_phone,
        updated_at: new Date().toISOString(),
      }).eq("id", settings.id);

      if (upErr) throw new Error(`Failed to save settings: ${upErr.message}`);

      // Non-blocking audit log — don't break the UX if this fails
      supabase.from("audit_logs").insert({
        action: "settings_updated",
        resource: "platform_settings",
        resource_id: settings.id,
        details: { platform_fee_percent: settings.platform_fee_percent },
      }).then(({ error: logErr }) => {
        if (logErr) console.warn("Audit log write failed:", logErr.message);
      });

      setSaved(true); setTimeout(() => setSaved(false), 3000);
      await fetchSettings();
    } catch (err: any) { setError(err.message || "Something went wrong saving settings"); }
    finally { setSaving(false); }
  };

  if (loading) return (<AdminLayout><div className="flex items-center justify-center py-24"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div></AdminLayout>);
  if (error) return (<AdminLayout><div className="text-center py-24"><p className="text-sm mb-4">{error}</p><button onClick={fetchSettings} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button></div></AdminLayout>);
  if (!settings) return (<AdminLayout><div className="text-center py-24"><p className="text-sm text-foreground-500">No settings found</p></div></AdminLayout>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h1 className="font-heading font-bold text-2xl text-foreground-900">System Settings</h1><p className="text-sm text-foreground-600 mt-1">Configure platform-wide payment settings</p></div>
          <button onClick={handleSave} disabled={saving} className={`px-6 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm ${saved ? "bg-primary-500 text-background-50" : "bg-primary-500 hover:bg-primary-600 text-background-50"}`}>
            {saved ? (<><i className="ri-check-line" />Saved</>) : saving ? (<><i className="ri-loader-4-line animate-spin" />Saving...</>) : "Save Changes"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Settings */}
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
            <h3 className="font-heading font-semibold text-foreground-900 mb-4">Fee Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Platform Fee (%)</label>
                <input type="number" value={settings.platform_fee_percent} onChange={(e) => setSettings({ ...settings, platform_fee_percent: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" step="0.1" min="0" max="100" />
                <p className="text-[11px] text-foreground-500 mt-1">Percentage deducted from every collection before crediting wallet. Payouts &amp; withdrawals use tiered pricing (flat fee for amounts ≤ 70K, percentage for amounts &gt; 70K).</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Min Collection (UGX)</label>
                  <input type="number" value={settings.min_collection_amount} onChange={(e) => setSettings({ ...settings, min_collection_amount: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Min Payout (UGX)</label>
                  <input type="number" value={settings.min_payout_amount} onChange={(e) => setSettings({ ...settings, min_payout_amount: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Max Payout (UGX)</label>
                <input type="number" value={settings.max_payout_amount} onChange={(e) => setSettings({ ...settings, max_payout_amount: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Payout Flat Fee (UGX) — Tier 1</label>
                  <input type="number" value={settings.payout_flat_fee} onChange={(e) => setSettings({ ...settings, payout_flat_fee: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  <p className="text-[11px] text-foreground-500 mt-1">Flat fee for amounts 500–70,000 UGX</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">Withdraw/Payout Fee (%) — Tier 2</label>
                  <input type="number" value={settings.withdraw_fee_percent} onChange={(e) => setSettings({ ...settings, withdraw_fee_percent: parseFloat(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" step="0.1" min="0" max="100" />
                  <p className="text-[11px] text-foreground-500 mt-1">Percentage for amounts 70,001–5,000,000 UGX</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Platform Airtel Number</label>
                <input type="text" value={settings.platform_airtel_number} onChange={(e) => setSettings({ ...settings, platform_airtel_number: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="07XXXXXXXX" />
                <p className="text-[11px] text-foreground-500 mt-1">This number is used for hidden collections when merchants withdraw. Never shown to merchants.</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Support Email</label>
                <input type="email" value={settings.support_email} onChange={(e) => setSettings({ ...settings, support_email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="support@obpay.online" />
                <p className="text-[11px] text-foreground-500 mt-1">Displayed on the landing page and support page</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Support Phone</label>
                <input type="text" value={settings.support_phone} onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="+2567XXXXXXXX" />
                <p className="text-[11px] text-foreground-500 mt-1">Displayed on the landing page and support page</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Payout Processing</label>
                <select value={settings.payout_processing_time} onChange={(e) => setSettings({ ...settings, payout_processing_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer">
                  <option value="Instant">Instant</option><option value="Same Day">Same Day</option><option value="24 Hours">24 Hours</option><option value="48 Hours">48 Hours</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">Auto-Approve Threshold (UGX)</label>
                <input type="number" value={settings.auto_approve_threshold} onChange={(e) => setSettings({ ...settings, auto_approve_threshold: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
                <p className="text-[11px] text-foreground-500 mt-1">Payouts below this amount are automatically approved</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">Platform Configuration</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground-900">Maintenance Mode</p><p className="text-xs text-foreground-500 mt-0.5">Disable all merchant access temporarily</p></div>
                  <button onClick={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.maintenance_mode ? "bg-accent-500" : "bg-background-300"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${settings.maintenance_mode ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground-900">Require KYC</p><p className="text-xs text-foreground-500 mt-0.5">Require verification before enabling payments</p></div>
                  <button onClick={() => setSettings({ ...settings, kyc_required: !settings.kyc_required })} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.kyc_required ? "bg-primary-500" : "bg-background-300"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${settings.kyc_required ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground-900">Require Login Verification</p><p className="text-xs text-foreground-500 mt-0.5">Send email verification codes on login. Turn OFF when Resend quota is exhausted — merchants log in without codes.</p></div>
                  <button onClick={() => setSettings({ ...settings, require_login_verification: !settings.require_login_verification })} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.require_login_verification ? "bg-primary-500" : "bg-background-300"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${settings.require_login_verification ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground-900">Withdraw from LivePay Wallet</p><p className="text-xs text-foreground-500 mt-0.5">When ON, merchant withdrawals are funded from your LivePay wallet balance. When OFF, funds are collected from your personal mobile money number first.</p></div>
                  <button onClick={() => setSettings({ ...settings, withdraw_from_livepay: !settings.withdraw_from_livepay, withdraw_from_julypay: !settings.withdraw_from_livepay })} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${settings.withdraw_from_livepay || settings.withdraw_from_julypay ? "bg-accent-500" : "bg-background-300"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${settings.withdraw_from_livepay || settings.withdraw_from_julypay ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">Supported Currencies</h3>
              <div className="flex flex-wrap gap-2">
                {settings.supported_currencies.map((c: string) => (
                  <span key={c} className="text-xs font-medium bg-secondary-100 text-secondary-700 px-3 py-1.5 rounded-full">{c}</span>
                ))}
              </div>
            </div>

            <div className="bg-background-50 rounded-xl border border-background-200/70 p-6">
              <h3 className="font-heading font-semibold text-foreground-900 mb-4">Payment Methods</h3>
              <div className="flex flex-wrap gap-2">
                {settings.supported_payment_methods.map((m: string) => (
                  <span key={m} className="text-xs font-medium bg-secondary-100 text-secondary-700 px-3 py-1.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-background-50 rounded-xl border border-accent-200/70 p-6">
          <h3 className="font-heading font-semibold text-accent-700 mb-2">Danger Zone</h3>
          <p className="text-xs text-foreground-600 mb-4">Destructive actions that cannot be undone</p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to reset ALL platform data? This includes transactions, wallets, payout requests, and merchant profiles. This CANNOT be undone.")) {
                  alert("Platform data reset is a manual operation. Please contact your system administrator to execute this safely.");
                }
              }}
              className="px-4 py-2 rounded-lg border border-accent-300/60 text-accent-600 hover:bg-accent-50 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Reset Platform Data
            </button>
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to revoke ALL merchant API keys? This will immediately break all API integrations. This CANNOT be undone.")) {
                  alert("API key revocation is a manual operation. Please contact your system administrator to execute this safely.");
                }
              }}
              className="px-4 py-2 rounded-lg border border-accent-300/60 text-accent-600 hover:bg-accent-50 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              Revoke All API Keys
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}