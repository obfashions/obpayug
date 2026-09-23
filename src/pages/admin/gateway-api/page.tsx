import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { getAccessToken } from "@/lib/session-token";
import { marzAdminCall } from "@/lib/marz-admin.functions";

interface CredRow {
  id: string;
  label: string;
  key: string;
  secretMasked: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface StatusData {
  source: "database" | "environment" | "none";
  active: { key: string; secretMasked: string } | null;
  credentials: CredRow[];
  environment: { key: string; secretMasked: string } | null;
}

const SOURCE_LABEL: Record<string, string> = {
  database: "Admin-managed keys (selected below)",
  environment: "Built-in server keys",
  none: "Not configured",
};

export default function AdminMarzApi() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apiBasic, setApiBasic] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState("");
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

  const payload = () => ({
    label: label.trim(),
    apiKey: apiKey.trim(),
    apiSecret: apiSecret.trim(),
    apiBasic: apiBasic.trim(),
    activate: makeActive,
  });
  const hasInput = apiBasic.trim() !== "" || (apiKey.trim() !== "" && apiSecret.trim() !== "");

  const handleTest = async (id?: string) => {
    setBusy(id ? `test:${id}` : "test");
    setResult(null);
    const res = id ? await call("test", { id }) : await call("test", payload());
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
      setLabel("");
      setApiKey("");
      setApiSecret("");
      setApiBasic("");
      setResult({
        ok: true,
        message: makeActive
          ? "Saved, verified and now processing all collections, payouts and services."
          : "Saved and verified. Select it below whenever you want it live.",
      });
      await loadStatus();
    } else {
      setResult({ ok: false, message: res?.error || "Could not save the credentials." });
    }
    setBusy("");
  };

  const handleActivate = async (id: string) => {
    setBusy(`activate:${id}`);
    setResult(null);
    const res = await call("activate", { id });
    if (res?.success) {
      setResult({ ok: true, message: "These keys now process every ObPay transaction." });
      await loadStatus();
    } else {
      setResult({ ok: false, message: res?.error || "Could not switch credentials." });
    }
    setBusy("");
  };

  const handleDelete = async (id: string) => {
    setBusy(`delete:${id}`);
    setResult(null);
    const res = await call("delete", { id });
    if (res?.success) {
      setResult({ ok: true, message: "Credentials removed." });
      await loadStatus();
    } else {
      setResult({ ok: false, message: res?.error || "Could not remove these keys." });
    }
    setBusy("");
  };

  const rows = status?.credentials || [];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">MarzPay API Keys</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Store as many MarzPay credential sets as you need and choose which one processes ObPay
            collections, payouts, bill payments and airtime. Switching takes effect instantly.
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
              <button
                onClick={() => handleTest()}
                disabled={busy !== ""}
                className="px-3 py-1.5 rounded-lg text-xs border border-foreground-200/25 cursor-pointer disabled:opacity-50"
              >
                {busy === "test" ? "Testing…" : "Test live keys"}
              </button>
            </div>
          )}
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

        {/* Saved credential sets */}
        <div className="rounded-xl border border-foreground-200/20 p-4 sm:p-5 space-y-3">
          <h2 className="font-medium">Saved credentials</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-500">
              No credential sets saved yet. Add one below — until then ObPay uses the built-in server keys.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`rounded-lg border p-3 space-y-2 ${
                    row.enabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-foreground-200/20"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{row.label}</span>
                    {row.enabled && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-500">
                        In use
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground-500 break-all">
                    <code>{row.key}</code> · <code>{row.secretMasked}</code>
                  </div>
                  {row.updatedAt && (
                    <p className="text-[11px] text-foreground-500">
                      Updated {new Date(row.updatedAt).toLocaleString()}
                      {row.updatedBy ? ` by ${row.updatedBy}` : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {!row.enabled && (
                      <button
                        onClick={() => handleActivate(row.id)}
                        disabled={busy !== ""}
                        className="px-3 py-1.5 rounded-lg text-xs bg-accent-500 text-background-50 cursor-pointer disabled:opacity-50"
                      >
                        {busy === `activate:${row.id}` ? "Switching…" : "Use for transactions"}
                      </button>
                    )}
                    <button
                      onClick={() => handleTest(row.id)}
                      disabled={busy !== ""}
                      className="px-3 py-1.5 rounded-lg text-xs border border-foreground-200/25 cursor-pointer disabled:opacity-50"
                    >
                      {busy === `test:${row.id}` ? "Testing…" : "Test"}
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      disabled={busy !== ""}
                      className="px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-500 cursor-pointer disabled:opacity-50 sm:ml-auto"
                    >
                      {busy === `delete:${row.id}` ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-foreground-200/20 p-4 sm:p-5 space-y-4">
          <h2 className="font-medium">Add credentials</h2>

          <div className="grid gap-1.5">
            <label className="text-sm text-foreground-500">Name (so you can tell them apart)</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. MarzPay live account"
              className="w-full rounded-lg bg-background-50 border border-foreground-200/25 px-3 py-2 text-sm"
            />
          </div>

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

          <label className="flex items-center gap-2 text-sm text-foreground-500 cursor-pointer">
            <input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} />
            Use these keys for all ObPay transactions once saved
          </label>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => handleTest()}
              disabled={busy !== "" || !hasInput}
              className="px-4 py-2 rounded-lg text-sm border border-foreground-200/25 cursor-pointer disabled:opacity-50"
            >
              {busy === "test" ? "Testing…" : "Test these keys"}
            </button>
            <button
              onClick={handleSave}
              disabled={busy !== "" || !hasInput}
              className="px-4 py-2 rounded-lg text-sm bg-accent-500 text-background-50 cursor-pointer disabled:opacity-50"
            >
              {busy === "save" ? "Verifying & saving…" : "Save credentials"}
            </button>
          </div>

          <p className="text-xs text-foreground-500">
            Keys are verified against MarzPay before they are saved, stored server-side only, and never sent to a browser.
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
