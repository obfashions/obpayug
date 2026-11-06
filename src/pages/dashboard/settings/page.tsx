import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/feature/DashboardLayout";
import CurrencyWalletsCard from "./CurrencyWalletsCard";
import PayoutFees from "./PayoutFees";
import { supabase } from "@/lib/supabase";
import { getProviderConnectionStatus, testProviderConnection } from "@/services/obpay";
import { supabase as profileClient } from "@/integrations/supabase/client";
import { saveMerchantPhone } from "@/lib/merchant-phone";
import { Button } from "@/components/ui/button";
import BankAccounts from "./BankAccounts";

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    email: profile?.email || "",
    phone_number: profile?.phone_number || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Payment Provider state
  const [lpStatus, setLpStatus] = useState<{ connected: boolean; status: string | null }>({ connected: false, status: null });
  const [lpTesting, setLpTesting] = useState(false);
  const [lpTestResult, setLpTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Withdraw funding source toggle (admin only)
  const [withdrawFromJulyPay, setWithdrawFromJulyPay] = useState(false);
  const [withdrawSaving, setWithdrawSaving] = useState(false);
  const [withdrawSaved, setWithdrawSaved] = useState(false);
  const [platformSettingsId, setPlatformSettingsId] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; message: string } | null>(null);

  // Security preferences
  const [loginVerificationEnabled, setLoginVerificationEnabled] = useState(true);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [verificationSaved, setVerificationSaved] = useState(false);

  const fetchConnectionStatus = useCallback(async () => {
    const status = await getProviderConnectionStatus();
    setLpStatus({ connected: status.connected, status: status.status });
  }, []);

  const fetchPlatformSettings = useCallback(async () => {
    const { data, error } = await supabase.from("platform_settings").select("id, withdraw_from_julypay, withdraw_from_livepay").limit(1).maybeSingle();
    if (!error && data) {
      setWithdrawFromJulyPay((data.withdraw_from_livepay ?? data.withdraw_from_julypay) ?? false);
      setPlatformSettingsId(data.id);
    }
  }, []);

  useEffect(() => {
    if (profile?.full_name) {
      setFormData((prev) => ({ ...prev, full_name: profile.full_name || prev.full_name, email: profile.email || prev.email }));
    }
    if (profile?.login_verification_enabled !== undefined) {
      setLoginVerificationEnabled(profile.login_verification_enabled);
    }
    fetchConnectionStatus();
    if (profile?.role === "admin") {
      fetchPlatformSettings();
    }
  }, [profile, fetchConnectionStatus, fetchPlatformSettings]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, phone_number: profile?.phone_number || "" }));
  }, [profile?.id, profile?.phone_number]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !profile) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const phone = await saveMerchantPhone(profileClient, formData.phone_number);
      setFormData((prev) => ({ ...prev, phone_number: phone }));
      await refreshProfile();
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your phone number could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setLpTesting(true);
    setLpTestResult(null);
    const result = await testProviderConnection();
    setLpTesting(false);
    setLpTestResult(result);
  };

  const handleToggleWithdrawSource = async () => {
    if (!platformSettingsId) return;
    const newValue = !withdrawFromJulyPay;
    setWithdrawSaving(true);
    const { error } = await supabase.from("platform_settings").update({
      withdraw_from_julypay: newValue,
        withdraw_from_livepay: newValue,
      updated_at: new Date().toISOString(),
    }).eq("id", platformSettingsId);
    setWithdrawSaving(false);

    if (error) {
      setLpTestResult({ ok: false, message: "Failed to update funding source: " + error.message });
      return;
    }

    setWithdrawFromJulyPay(newValue);
    setWithdrawSaved(true);
    setTimeout(() => setWithdrawSaved(false), 3000);
  };

  const handleToggleVerification = async () => {
    if (!profile?.id) return;
    const newValue = !loginVerificationEnabled;
    setVerificationSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ login_verification_enabled: newValue })
      .eq("id", profile.id);

    setVerificationSaving(false);

    if (error) {
      setLpTestResult({ ok: false, message: "Failed to update setting: " + error.message });
      return;
    }

    setLoginVerificationEnabled(newValue);
    setVerificationSaved(true);
    setTimeout(() => setVerificationSaved(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, message: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, message: "New passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    try {
      if (!profile?.email) {
        setPasswordMsg({ ok: false, message: "No email associated with this account." });
        setPasswordSaving(false);
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInErr) {
        setPasswordMsg({ ok: false, message: "Current password is incorrect." });
        setPasswordSaving(false);
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) throw updateErr;

      setPasswordMsg({ ok: true, message: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ ok: false, message: err.message || "Failed to change password." });
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-1">
            Account Settings
          </h2>
          <p className="text-sm text-foreground-600">
            Manage your profile, payments, and account preferences.
          </p>
        </div>

        <CurrencyWalletsCard />
        <PayoutFees />
        <BankAccounts />

        {/* Payment engine status — Admin Only */}
        {profile?.role === "admin" && (
        <div className="bg-background-50 rounded-xl p-6 border border-background-200/70">
          <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
            <div>
              <h3 className="font-heading font-semibold text-base text-foreground-900">Payment engine</h3>
              <p className="text-xs text-foreground-500 mt-0.5">
                Collections, payouts and transfers run through the ObPay payment engine. Keys are managed in Admin → Gateway API.
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              lpStatus.connected ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"
            }`}>
              <span className={`w-2 h-2 rounded-full ${lpStatus.connected ? "bg-primary-500" : "bg-accent-500"}`} />
              {lpStatus.connected ? "Live" : "Unavailable"}
            </div>
          </div>

          {/* Withdraw Funding Source Toggle */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground-900">Fund withdrawals from the platform float</p>
                <p className="text-xs text-foreground-500 mt-0.5">When ON, merchant withdrawals are paid from the ObPay float. When OFF, money is first collected from your own mobile money number.</p>
              </div>
              <button
                onClick={handleToggleWithdrawSource}
                disabled={withdrawSaving}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ml-4 ${withdrawFromJulyPay ? "bg-accent-500" : "bg-background-300"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${withdrawFromJulyPay ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
            {withdrawSaved && (
              <p className="text-xs text-primary-600 mt-2 flex items-center gap-1">
                <i className="ri-check-line" />
                Funding source updated
              </p>
            )}
          </div>

          {lpTestResult && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${lpTestResult.ok ? "bg-primary-50 border border-primary-200/70" : "bg-accent-50 border border-accent-200/70"}`}>
              <div className="flex items-start gap-2">
                <i className={`${lpTestResult.ok ? "ri-checkbox-circle-line text-primary-500" : "ri-close-circle-line text-accent-500"} mt-0.5 shrink-0`} />
                <span className={lpTestResult.ok ? "text-primary-700" : "text-accent-700"}>{lpTestResult.message}</span>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleTestConnection}
              disabled={lpTesting}
              className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold px-5 py-2.5 rounded-lg text-sm border border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              {lpTesting ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <i className="ri-plug-line" />
                  Check payments
                </>
              )}
            </button>
            <a
              href="/admin/gateway-api"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-key-2-line" />
              Manage keys
            </a>
          </div>
        </div>
        )}

        {/* Profile */}
        <div className="bg-background-50 rounded-xl p-6 border border-background-200/70">
          <h3 className="font-heading font-semibold text-base text-foreground-900 mb-5">
            Profile Information
          </h3>
          <form onSubmit={handleSave}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                readOnly
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                readOnly
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="block text-sm font-medium text-foreground-700 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                id="contact-phone"
                autoComplete="tel"
                required
                disabled={saving || !profile}
                aria-invalid={Boolean(saveError)}
                aria-describedby={saveError ? "phone-save-error" : undefined}
                value={formData.phone_number}
                onChange={(e) => { setFormData({ ...formData, phone_number: e.target.value }); setSaved(false); setSaveError(null); }}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Button
              type="submit"
              disabled={saving || !profile}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              {saving ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="ri-save-line" />
                  Save Changes
                </>
              )}
            </Button>
            {saved && (
              <span role="status" className="text-sm text-primary-600 flex items-center gap-1">
                <i className="ri-check-line" />
                Saved successfully
              </span>
            )}
          </div>
          {saveError && <p id="phone-save-error" role="alert" className="mt-3 text-sm text-accent-700">{saveError}</p>}
          </form>
        </div>

        {/* Security */}
        <div className="bg-background-50 rounded-xl p-6 border border-background-200/70">
          <h3 className="font-heading font-semibold text-base text-foreground-900 mb-5">
            Security Preferences
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground-900">Login Verification Code</p>
              <p className="text-xs text-foreground-500 mt-0.5">When ON, a 6-digit code is sent to your email every time you log in for extra security.</p>
            </div>
            <button
              onClick={handleToggleVerification}
              disabled={verificationSaving}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ml-4 ${loginVerificationEnabled ? "bg-accent-500" : "bg-background-300"}`}
            >
              {verificationSaving ? (
                <i className="ri-loader-4-line animate-spin absolute inset-0 flex items-center justify-center text-[10px] text-background-50" />
              ) : (
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-background-50 transition-transform ${loginVerificationEnabled ? "left-[22px]" : "left-0.5"}`} />
              )}
            </button>
          </div>
          {verificationSaved && (
            <p className="text-xs text-primary-600 mt-3 flex items-center gap-1">
              <i className="ri-check-line" />
              {loginVerificationEnabled ? "Verification code enabled" : "Verification code disabled"}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="bg-background-50 rounded-xl p-6 border border-background-200/70">
          <h3 className="font-heading font-semibold text-base text-foreground-900 mb-5">
            Change Password
          </h3>

          {passwordMsg && (
            <div className={`mb-4 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${passwordMsg.ok ? "bg-primary-100 border border-primary-200 text-primary-700" : "bg-accent-100 border border-accent-200 text-accent-700"}`}>
              <i className={`${passwordMsg.ok ? "ri-checkbox-circle-line" : "ri-error-warning-line"} mt-0.5`} />
              <span>{passwordMsg.message}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-700 mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <button
              type="submit"
              disabled={passwordSaving}
              className="mt-2 inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-800 font-semibold px-5 py-2.5 rounded-lg text-sm border border-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
            >
              {passwordSaving ? (
                <>
                  <i className="ri-loader-4-line animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <i className="ri-key-2-line" />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="bg-background-50 rounded-xl p-6 border border-accent-200/70">
          <h3 className="font-heading font-semibold text-base text-foreground-900 mb-2">
            Danger Zone
          </h3>
          <p className="text-sm text-foreground-600 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button className="inline-flex items-center gap-2 bg-background-100 hover:bg-accent-50 text-accent-600 font-semibold px-5 py-2.5 rounded-lg text-sm border border-accent-200/70 transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-delete-bin-line" />
            Delete Account
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}