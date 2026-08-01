import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";

interface ApiKey {
  id: string;
  name: string;
  environment: string;
  public_key: string;
  secret_prefix: string;
  secret_last4: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="w-8 h-8 rounded-md bg-background-50 hover:bg-background-200 flex items-center justify-center shrink-0 text-foreground-400 hover:text-primary-600 transition-colors cursor-pointer"
      title={`Copy ${label}`}
    >
      <i className={copied ? "ri-check-line text-primary-500 text-sm" : "ri-file-copy-line text-sm"} />
    </button>
  );
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", environment: "live" });
  const [freshSecret, setFreshSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await platform<ApiKey[]>("api-keys.list");
    if (!res.success) setError(res.error || "Could not load your API keys.");
    else setKeys(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await platform<any>("api-keys.create", form);
    setCreating(false);
    if (!res.success) {
      setError(res.error || "Could not create the key.");
      return;
    }
    setFreshSecret(res.data.secret_key);
    setForm({ name: "", environment: "live" });
    load();
  };

  const revoke = async (id: string) => {
    const res = await platform("api-keys.revoke", { id });
    if (!res.success) setError(res.error || "Could not revoke that key.");
    load();
  };

  const remove = async (id: string) => {
    const res = await platform("api-keys.delete", { id });
    if (!res.success) setError(res.error || "Could not delete that key.");
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground-900">API keys</h1>
          <p className="text-sm text-foreground-500 mt-1">
            Use the secret key as a Bearer token when calling the ObPay API. Secrets are shown once — store them safely.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
        )}

        {freshSecret && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-4 space-y-2">
            <p className="text-sm font-semibold text-foreground-900">Copy your secret key now</p>
            <p className="text-xs text-foreground-500">This is the only time it will be shown.</p>
            <div className="flex items-center gap-2 min-w-0">
              <code className="flex-1 truncate rounded-md bg-white px-3 py-2 text-xs font-mono">{freshSecret}</code>
              <CopyBtn text={freshSecret} label="secret key" />
              <button
                onClick={() => setFreshSecret(null)}
                className="text-xs text-foreground-500 hover:text-foreground-900 shrink-0 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        <form onSubmit={create} className="rounded-xl border border-background-200 bg-white p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground-900">Create a new key</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Key name (e.g. Website checkout)"
              className="sm:col-span-2 rounded-lg border border-background-200 px-3 py-2 text-sm"
            />
            <select
              value={form.environment}
              onChange={(e) => setForm({ ...form, environment: e.target.value })}
              className="rounded-lg border border-background-200 px-3 py-2 text-sm"
            >
              <option value="live">Live</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
          >
            {creating ? "Creating…" : "Generate key"}
          </button>
        </form>

        <div className="rounded-xl border border-background-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-foreground-500">Loading your keys…</div>
          ) : keys.length === 0 ? (
            <div className="p-6 text-sm text-foreground-500">No API keys yet. Generate one above to start integrating.</div>
          ) : (
            <ul className="divide-y divide-background-100">
              {keys.map((k) => (
                <li key={k.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground-900">{k.name}</span>
                    <span className="rounded-full bg-background-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-foreground-500">
                      {k.environment}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        k.status === "active" ? "bg-green-100 text-green-700" : "bg-background-100 text-foreground-500"
                      }`}
                    >
                      {k.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-20 shrink-0 text-xs text-foreground-500">Public</span>
                      <code className="flex-1 truncate rounded-md bg-background-50 px-3 py-2 text-xs font-mono">
                        {k.public_key}
                      </code>
                      <CopyBtn text={k.public_key} label="public key" />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-20 shrink-0 text-xs text-foreground-500">Secret</span>
                      <code className="flex-1 truncate rounded-md bg-background-50 px-3 py-2 text-xs font-mono">
                        {k.secret_prefix}••••••••{k.secret_last4}
                      </code>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-foreground-500">
                    <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                    <span>{k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleString()}` : "Never used"}</span>
                    <span className="grow" />
                    {k.status === "active" && (
                      <button onClick={() => revoke(k.id)} className="text-amber-600 hover:underline cursor-pointer">
                        Revoke
                      </button>
                    )}
                    <button onClick={() => remove(k.id)} className="text-red-600 hover:underline cursor-pointer">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
