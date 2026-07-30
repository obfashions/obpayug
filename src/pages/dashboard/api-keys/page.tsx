import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface ApiCredentials {
  secret_key: string;
  webhook_secret: string;
}

interface MerchantInfo {
  merchant_id: string;
  merchant_slug: string;
  company_name: string;
  verification_status: string;
}

function generateKey(prefix: string): string {
  const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return prefix + raw.slice(0, 32);
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="w-8 h-8 rounded-md bg-background-50 hover:bg-background-200 flex items-center justify-center shrink-0 text-foreground-400 hover:text-primary-600 transition-colors cursor-pointer"
      title={`Copy ${label}`}
    >
      <i className={copied ? "ri-check-line text-primary-500 text-sm" : "ri-file-copy-line text-sm"} />
    </button>
  );
}

function CredentialCard({
  label,
  value,
  type = "public",
  onRegenerate,
  regenerating = false,
  isSecret = false,
}: {
  label: string;
  value: string;
  type?: "public" | "secret" | "webhook";
  onRegenerate?: () => void;
  regenerating?: boolean;
  isSecret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  const typeBadge = type === "public"
    ? { text: "Same for everyone", cls: "bg-secondary-100 text-secondary-700" }
    : type === "webhook"
    ? { text: "Webhook verify", cls: "bg-accent-100 text-accent-700" }
    : { text: "Yours only", cls: "bg-accent-100 text-accent-700" };

  return (
    <div className="bg-background-100 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground-400">{label}</span>
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${typeBadge.cls}`}>{typeBadge.text}</span>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs font-mono text-foreground-700 break-all select-all">
          {isSecret && !revealed ? "••••••••••••••••••••••••••••••••••••••••••••••••" : value}
        </code>
        {isSecret && (
          <button
            onClick={() => setRevealed(!revealed)}
            className="w-8 h-8 rounded-md bg-background-50 hover:bg-background-200 flex items-center justify-center shrink-0 text-foreground-400 hover:text-primary-600 transition-colors cursor-pointer"
          >
            <i className={revealed ? "ri-eye-off-line text-sm" : "ri-eye-line text-sm"} />
          </button>
        )}
        <CopyBtn text={value} label={label} />
      </div>
      {onRegenerate && (
        <div className="flex items-center justify-end mt-1.5">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-[10px] font-medium text-foreground-400 hover:text-accent-600 cursor-pointer whitespace-nowrap transition-colors"
          >
            <i className="ri-refresh-line mr-0.5" />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}

export default function ApiKeysPage() {
  const { user, profile } = useAuth();
  const [credentials, setCredentials] = useState<ApiCredentials | null>(null);
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const isVerified = profile?.status === "active";

  const API_URL = "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt";
  const PUBLIC_KEY = "sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt";
  const WEBHOOK_URL = "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-webhook-receiver";

  const generateCredentials = useCallback(async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const newKeys = {
        secret_key: generateKey("sk_live_"),
        webhook_secret: generateKey("whsec_"),
      };

      const { error: insertErr } = await supabase.from("api_keys").upsert({
        user_id: user.id,
        secret_key: newKeys.secret_key,
        webhook_secret: newKeys.webhook_secret,
        environment: "live",
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (insertErr) throw insertErr;

      setCredentials(prev => ({ ...prev, ...newKeys } as ApiCredentials));
    } catch (err: any) {
      setError(err.message || "Failed to generate API credentials");
    } finally {
      setGenerating(false);
    }
  }, [user]);

  const fetchCredentials = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [apiRes, merchantRes] = await Promise.all([
        supabase.from("api_keys").select("secret_key, webhook_secret").eq("user_id", user.id).maybeSingle(),
        supabase.from("merchant_profiles").select("merchant_id, merchant_slug, company_name, verification_status").eq("user_id", user.id).maybeSingle(),
      ]);

      if (apiRes.error) throw apiRes.error;
      if (merchantRes.error) throw merchantRes.error;

      if (apiRes.data) {
        setCredentials(apiRes.data as ApiCredentials);
      } else if (isVerified) {
        await generateCredentials();
      }
      if (merchantRes.data) {
        setMerchantInfo(merchantRes.data as MerchantInfo);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load API credentials");
    } finally {
      setLoading(false);
    }
  }, [user, isVerified, generateCredentials]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const handleRegenerateSecret = async () => {
    if (!user || !confirm("Regenerating your secret key will invalidate the current one. All integrations using the old key will stop working. Continue?")) return;
    setGenerating(true);
    try {
      const newSecret = generateKey("sk_live_");
      await supabase.from("api_keys").update({ secret_key: newSecret, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      setCredentials(prev => prev ? { ...prev, secret_key: newSecret } : null);
    } catch (err: any) {
      setError(err.message || "Failed to regenerate secret key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateWebhook = async () => {
    if (!user || !confirm("Regenerating your webhook secret will invalidate webhook signature verification for the old secret. Continue?")) return;
    setGenerating(true);
    try {
      const newSecret = generateKey("whsec_");
      await supabase.from("api_keys").update({ webhook_secret: newSecret, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      setCredentials(prev => prev ? { ...prev, webhook_secret: newSecret } : null);
    } catch (err: any) {
      setError(err.message || "Failed to regenerate webhook secret");
    } finally {
      setGenerating(false);
    }
  };

  if (loading || generating) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
            <p className="text-sm text-foreground-500 mt-3">
              {generating ? "Generating API credentials..." : "Loading API credentials..."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-accent-600 text-3xl" />
            </div>
            <p className="text-sm text-foreground-800 mb-4">{error}</p>
            <button
              onClick={fetchCredentials}
              className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-background-50 font-medium px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line" />
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="font-heading font-bold text-xl md:text-2xl text-foreground-900 mb-1">API Keys</h2>
          <p className="text-sm text-foreground-600">
            {isVerified
              ? "Your credentials for integrating ObPay into your website or app. For full integration guides and code examples, see the Documentation."
              : "Complete KYC verification to unlock API access and get your credentials."}
          </p>
        </div>

        {!isVerified ? (
          <div className="bg-background-50 rounded-xl p-8 border border-background-200/70 text-center">
            <div className="w-16 h-16 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-lock-line text-accent-600 text-2xl" />
            </div>
            <h3 className="font-heading font-semibold text-lg text-foreground-900 mb-2">Verification Required</h3>
            <p className="text-sm text-foreground-600 max-w-md mx-auto mb-6">
              Your API credentials will be available once an administrator approves your KYC verification.
            </p>
            <a
              href="/dashboard/kyc"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-5 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className="ri-shield-check-line" />
              Complete KYC Verification
            </a>
          </div>
        ) : (
          <>
            {/* Merchant Card */}
            {merchantInfo && (
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <i className="ri-store-3-line text-primary-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground-900">{merchantInfo.company_name}</p>
                    <p className="text-xs text-foreground-500">
                      Verified Merchant · Slug: <code className="text-xs font-mono">{merchantInfo.merchant_slug || "—"}</code>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Credentials */}
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
              <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-4">Your Credentials</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CredentialCard label="API URL" value={API_URL} type="public" />
                <CredentialCard label="Public Key" value={PUBLIC_KEY} type="public" />
                {credentials?.secret_key ? (
                  <CredentialCard
                    label="Secret Key"
                    value={credentials.secret_key}
                    type="secret"
                    isSecret
                    onRegenerate={handleRegenerateSecret}
                    regenerating={generating}
                  />
                ) : (
                  <div className="bg-background-100 rounded-lg p-3 flex items-center justify-center">
                    <p className="text-xs text-foreground-400">Generating your secret key...</p>
                  </div>
                )}
                {credentials?.webhook_secret ? (
                  <CredentialCard
                    label="Webhook Secret"
                    value={credentials.webhook_secret}
                    type="webhook"
                    isSecret
                    onRegenerate={handleRegenerateWebhook}
                    regenerating={generating}
                  />
                ) : (
                  <div className="bg-background-100 rounded-lg p-3 flex items-center justify-center">
                    <p className="text-xs text-foreground-400">Generating your webhook secret...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Webhook URL card */}
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent-100 flex items-center justify-center">
                  <i className="ri-webhook-line text-accent-600" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-sm text-foreground-900">Provider Webhook URL</h3>
                  <p className="text-xs text-foreground-500">Paste this into your payment provider's webhook settings so ObPay auto-syncs payments.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-background-100 rounded-lg p-3">
                <code className="flex-1 text-xs font-mono text-foreground-700 break-all select-all">{WEBHOOK_URL}</code>
                <CopyBtn text={WEBHOOK_URL} label="Webhook URL" />
              </div>
            </div>

            {/* Quick links to docs */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/docs"
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-4 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors"
              >
                <i className="ri-book-open-line" />
                Full Documentation
              </a>
              <a
                href="/dashboard/api-sandbox"
                className="inline-flex items-center gap-2 bg-background-100 hover:bg-background-200 text-foreground-700 font-medium px-4 py-2.5 rounded-lg text-sm cursor-pointer whitespace-nowrap transition-colors border border-background-300/60"
              >
                <i className="ri-terminal-box-line" />
                API Sandbox
              </a>
              <span className="text-xs text-foreground-400">
                All code examples, SDK guides, webhook details, and error references are in the docs.
              </span>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}