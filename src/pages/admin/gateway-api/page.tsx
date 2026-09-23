import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/feature/AdminLayout";
import { getAccessToken } from "@/lib/session-token";
import { gatewayAdminCall } from "@/lib/gateway-admin.functions";

interface CredRow {
  id: string;
  label: string;
  key: string;
  secretMasked: string;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface EgressState {
  approved: string | null;
  current: string | null;
  lastSeen: string | null;
  matches: boolean;
  staticRelay: boolean;
  checkedAt: string;
}

interface StatusData {
  source: "database" | "environment" | "none";
  base_url: string;
  callback_url: string;
  static_egress: boolean;
  server_ip: string | null;
  egress: EgressState | null;
  active: { key: string; secretMasked: string } | null;
  credentials: CredRow[];
  environment: { key: string; secretMasked: string } | null;
}

const SOURCE_LABEL: Record<string, string> = {
  database: "Admin-managed keys (selected below)",
  environment: "Built-in server keys",
  none: "Not configured",
};

export default function AdminGatewayApi() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const call = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return { success: false, error: "Please sign in again to continue." };
    return (await gatewayAdminCall({ data: { action, accessToken, body } })) as any;
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
    apiSecret: apiSecret.replace(/\s+/g, "").trim(),
    activate: makeActive,
  });
  const hasInput = apiKey.trim() !== "" && apiSecret.trim() !== "";

  const handleTest = async (id?: string) => {
    setBusy(id ? `test:${id}` : "test");
    setResult(null);
    const res = id ? await call("test", { id }) : await call("test", payload());
    if (res?.success) {
      const d = res.data || {};
      setResult({
        ok: true,
        message: d.note
          ? d.note
          : `Connected. Payout float: ${d.balance != null ? Number(d.balance).toLocaleString() : "unknown"} UGX`,
      });
    } else {
      setResult({ ok: false, message: res?.error || "These credentials were rejected." });
    }
    setBusy("");
  };

  const handleSave = async (skipVerify = false) => {
    if (!hasInput) return;
    setBusy("save");
    setResult(null);
    const res = await call("save", { ...payload(), skipVerify });
    if (res?.success) {
      setLabel("");
      setApiKey("");
      setApiSecret("");
      setResult({
        ok: true,
        message: makeActive
          ? "Saved and now processing all collections, payouts and transfers."
          : "Saved. Select it below whenever you want it live.",
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
          <h1 className="text-xl sm:text-2xl font-semibold">Gateway API keys</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Store as many banking-partner credential sets as you need and choose which one processes ObPay
            collections, payouts and bank transfers. Switching takes effect instantly.
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
                <span className="text-foreground-500">Active application ID</span>
                <code className="text-xs">{status?.active?.key || "—"}</code>
              </div>
              <div className="grid gap-1 break-all">
                <span className="text-foreground-500">Active application key</span>
                <code className="text-xs">{status?.active?.secretMasked || "—"}</code>
              </div>
              <div className="grid gap-1 break-all">
                <span className="text-foreground-500">Partner endpoint</span>
                <code className="text-xs">{status?.base_url || "—"}</code>
              </div>
              <div className="grid gap-1 break-all">
                <span className="text-foreground-500">Result-notification URL to give the partner</span>
                <code className="text-xs">{status?.callback_url || "—"}</code>
              </div>
              <div className="grid gap-1 break-all">
                <span className="text-foreground-500">
                  This server's outbound address {status?.static_egress ? "(fixed relay)" : "(changes per request)"}
                </span>
                <code className="text-xs">{status?.server_ip || "unknown"}</code>
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
                      className="px-3 py-1.5 rounded-lg text-xs border border-red-500/40 text-red-500 cursor-pointer disabled:opacity-50"
                    >
                      {busy === `delete:${row.id}` ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add a set */}
        <div className="rounded-xl border border-foreground-200/20 p-4 sm:p-5 space-y-4">
          <h2 className="font-medium">Add credentials</h2>

          <div className="grid gap-1.5">
            <label className="text-xs text-foreground-500">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Live keys — March"
              className="w-full rounded-lg bg-background-100 border border-foreground-200/20 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-foreground-500">Application ID</label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg bg-background-100 border border-foreground-200/20 px-3 py-2 text-sm font-mono break-all"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-foreground-500">Application key</label>
            <div className="flex gap-2">
              <textarea
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                rows={showSecret ? 4 : 2}
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 rounded-lg bg-background-100 border border-foreground-200/20 px-3 py-2 text-sm font-mono break-all"
                style={showSecret ? undefined : { WebkitTextSecurity: "disc" } as any}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="shrink-0 px-3 rounded-lg text-xs border border-foreground-200/25 cursor-pointer"
              >
                {showSecret ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-[11px] text-foreground-500">
              Line breaks and spaces are removed automatically, so you can paste the key exactly as it arrived.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={makeActive} onChange={(e) => setMakeActive(e.target.checked)} />
            Use these keys for all transactions once saved
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTest()}
              disabled={!hasInput || busy !== ""}
              className="px-4 py-2 rounded-lg text-sm border border-foreground-200/25 cursor-pointer disabled:opacity-50"
            >
              {busy === "test" ? "Testing…" : "Test"}
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={!hasInput || busy !== ""}
              className="px-4 py-2 rounded-lg text-sm bg-accent-500 text-background-50 cursor-pointer disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Verify & save"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={!hasInput || busy !== ""}
              className="px-4 py-2 rounded-lg text-sm border border-foreground-200/25 cursor-pointer disabled:opacity-50"
            >
              Save without testing
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
