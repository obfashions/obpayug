import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { getAccessToken } from "@/lib/session-token";
import { marzAdminCall } from "@/lib/marz-admin.functions";

interface StatusData {
  source: "database" | "environment" | "none";
  active: { key: string; secretMasked: string } | null;
  stored: { key: string; secretMasked: string; enabled: boolean; updatedAt: string | null; updatedBy: string | null } | null;
  environment: { key: string; secretMasked: string } | null;
}

const SOURCE_LABEL: Record<string, string> = {
  database: "Admin-managed keys (saved here)",
  environment: "Built-in server keys",
  none: "Not configured",
};

export default function AdminMarzApi() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiBasic, setApiBasic] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "test" | "reset">("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const call = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return { success: false, error: "Please sign in again to continue." };
    return (await marzAdminCall({ data: { action, accessToken, body } })) as any;
  }, []);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const res = await call("status");
    if (res?.success) setStatus(res.data as StatusData);
    else setResult({ ok: false, message: res?.error || "Could not load credentials." });
    setLoading(false);
  }, [call]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const payload = () => ({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), apiBasic: apiBasic.trim() });
  const hasInput = apiBasic.trim() !== "" || (apiKey.trim() !== "" && apiSecret.trim() !== "");

  const handleTest = async () => {
    setBusy("test");
    setResult(null);
    const res = await call("test", payload());
    if (res?.success) {
      const d = res.data || {};
      setResult({
        ok: true,
        message: d.note
          ? `Connected to MarzPay. ${d.note}`
          : `Connected to MarzPay.${d.balance != null ? ` Live balance: ${d.balance}` : ""}`,
      });
    } else {
      setResult({ ok: false, message: res?.error || "MarzPay rejected these credentials." });
    }
    setBusy("");
  };

  const handleSave = async () => {
    if (!hasInput) return;
    setBusy("save");
    setResult(null);
    const res = await call("save", payload());
    if (res?.success) {
      setApiKey("");
      setApiSecret("");
      setApiBasic("");
      setResult({
        ok: true,
        message: "Saved and verified. Collections, payouts and all services now use these keys.",
      });
      await loadStatus();
    } else {
      setResult({ ok: false, message: res?.error || "Could not save the credentials." });
    }
    setBusy("");
  };

  const handleReset = async () => {
    setBusy("reset");
    setResult(null);
    const res = await call("reset");
    if (res?.success) {
      setResult({ ok: true, message: "Reverted to the built-in server keys." });
      await loadStatus();
    } else {
      setResult({ ok: false, message: res?.error || "Could not remove the saved keys." });
    }
    setBusy("");
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">MarzPay API Keys</h1>
          <p className="text-sm text-foreground-500 mt-1">
            These credentials process every collection, payout, bill payment and airtime purchase on ObPay.
            Saving new keys switches the whole platform over instantly.
          </p>
        </div>

        {/* Current state */}
        <div className="rounded-xl border border-foreground-200/20 p-4 sm:p-5 bg-background-100/40">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-foreground-500">
              <i className="ri-loader-4-line animate-spin" /> Loading current credentials…
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground-500">Currently in use:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    status?.source === "none" ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"
                  }`}
                >
                  {SOURCE_LABEL[status?.source || "none"]}
                </span>
              </div>
              <div className="grid gap-1 break-all">
                <span className="text-foreground-500">Active key</span>
                <code className="text-xs">{status?.active?.key || "—"}</code>
              </div>
              <div className="grid gap-1 break-all">
                <span className="text-foreground-500">Active secret</span>
                <code className="text-xs">{status?.active?.secretMasked || "—"}</code>
              </div>
              {status?.stored && (
                <p className="text-xs text-foreground-500">
                  Saved by {status.stored.updatedBy || "admin"}
                  {status.stored.updatedAt ? ` on ${new Date(status.stored.updatedAt).toLocaleString()}` : ""}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-foreground-200/20 p-4 sm:p-5 space-y-4">
          <h2 className="font-medium">Update credentials</h2>

          <div className="grid gap-1.5">
            <label className="text-sm text-foreground-500">API key</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="marz_XXXXXXXXXXXXXXXX"
              autoComplete="off"
              className="w-full rounded-lg bg-background-50 border border-foreground-200/25 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm text-foreground-500">API secret</label>
            <div className="relative">
              <input
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                type={showSecret ? "text" : "password"}
                placeholder="••••••••••••••••"
                autoComplete="new-password"
                className="w-full rounded-lg bg-background-50 border border-foreground-200/25 px-3 py-2 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-500 cursor-pointer"
                aria-label={showSecret ? "Hide secret" : "Show secret"}
              >
                <i className={showSecret ? "ri-eye-off-line" : "ri-eye-line"} />
              </button>
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm text-foreground-500">
              …or paste the base64 Authorization value instead
            </label>
            <input
              value={apiBasic}
              onChange={(e) => setApiBasic(e.target.value)}
              placeholder="bWFyel9...="
              autoComplete="off"
              className="w-full rounded-lg bg-background-50 border border-foreground-200/25 px-3 py-2 text-sm font-mono"
            />
          </div>

          {result && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                result.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleTest}
              disabled={busy !== ""}
              className="px-4 py-2 rounded-lg text-sm border border-foreground-200/25 cursor-pointer disabled:opacity-50"
            >
              {busy === "test" ? "Testing…" : hasInput ? "Test these keys" : "Test live keys"}
            </button>
            <button
              onClick={handleSave}
              disabled={busy !== "" || !hasInput}
              className="px-4 py-2 rounded-lg text-sm bg-accent-500 text-background-50 cursor-pointer disabled:opacity-50"
            >
              {busy === "save" ? "Verifying & saving…" : "Save & activate"}
            </button>
            {status?.stored && (
              <button
                onClick={handleReset}
                disabled={busy !== ""}
                className="px-4 py-2 rounded-lg text-sm border border-red-500/40 text-red-500 cursor-pointer disabled:opacity-50 sm:ml-auto"
              >
                {busy === "reset" ? "Removing…" : "Revert to built-in keys"}
              </button>
            )}
          </div>

          <p className="text-xs text-foreground-500">
            Keys are verified against MarzPay before they are saved, stored server-side only, and never sent to a browser.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
