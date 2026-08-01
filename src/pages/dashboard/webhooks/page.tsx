import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { platform } from "@/lib/platform";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: string;
  created_at: string;
}

interface Delivery {
  id: string;
  event: string;
  response_code: number | null;
  response_body: string | null;
  status: string;
  created_at: string;
}

const EVENTS = [
  { id: "collection.success", label: "Collection succeeded" },
  { id: "collection.failed", label: "Collection failed" },
  { id: "payout.success", label: "Payout succeeded" },
  { id: "payout.failed", label: "Payout failed" },
];

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<string[]>(EVENTS.map((e) => e.id));
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [list, log] = await Promise.all([
      platform<Endpoint[]>("webhooks.list"),
      platform<Delivery[]>("webhooks.deliveries", { limit: 25 }),
    ]);
    if (!list.success) setError(list.error || "Could not load your endpoints.");
    else setEndpoints(list.data || []);
    if (log.success) setDeliveries(log.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const res = await platform("webhooks.create", { url, events: selected });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Could not save the endpoint.");
      return;
    }
    setUrl("");
    load();
  };

  const remove = async (id: string) => {
    const res = await platform("webhooks.delete", { id });
    if (!res.success) setError(res.error || "Could not delete the endpoint.");
    load();
  };

  const test = async (id: string) => {
    setNotice("Sending a test event…");
    const res = await platform<any[]>("webhooks.test", { id });
    if (!res.success) {
      setError(res.error || "The test could not be sent.");
      setNotice("");
      return;
    }
    const first = res.data?.[0];
    setNotice(
      first?.response_code
        ? `Your endpoint replied with HTTP ${first.response_code}.`
        : `No response from your endpoint. ${first?.response_body || ""}`,
    );
    load();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground-900">Webhooks</h1>
          <p className="text-sm text-foreground-500 mt-1">
            ObPay POSTs a JSON event to your HTTPS endpoint whenever a collection or payout changes state.
          </p>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}
        {notice && <div className="rounded-lg bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 text-sm">{notice}</div>}

        <form onSubmit={add} className="rounded-xl border border-background-200 bg-white p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground-900">Add an endpoint</h2>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yoursite.com/webhooks/obpay"
            className="w-full rounded-lg border border-background-200 px-3 py-2 text-sm"
            required
          />
          <div className="flex flex-wrap gap-3">
            {EVENTS.map((ev) => (
              <label key={ev.id} className="flex items-center gap-2 text-sm text-foreground-600">
                <input
                  type="checkbox"
                  checked={selected.includes(ev.id)}
                  onChange={(e) =>
                    setSelected(e.target.checked ? [...selected, ev.id] : selected.filter((s) => s !== ev.id))
                  }
                />
                {ev.label}
              </label>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
          >
            {saving ? "Saving…" : "Add endpoint"}
          </button>
        </form>

        <div className="rounded-xl border border-background-200 bg-white overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-foreground-500">Loading…</div>
          ) : endpoints.length === 0 ? (
            <div className="p-6 text-sm text-foreground-500">No endpoints yet.</div>
          ) : (
            <ul className="divide-y divide-background-100">
              {endpoints.map((ep) => (
                <li key={ep.id} className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="flex-1 truncate text-sm font-mono text-foreground-900">{ep.url}</code>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700 shrink-0">
                      {ep.status}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-500">{(ep.events || []).join(", ")}</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-24 shrink-0 text-xs text-foreground-500">Signing key</span>
                    <code className="flex-1 truncate rounded-md bg-background-50 px-3 py-2 text-xs font-mono">
                      {revealed === ep.id ? ep.secret : "whsec_••••••••••••••••"}
                    </code>
                    <button
                      onClick={() => setRevealed(revealed === ep.id ? null : ep.id)}
                      className="text-xs text-primary-600 hover:underline shrink-0 cursor-pointer"
                    >
                      {revealed === ep.id ? "Hide" : "Reveal"}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <button onClick={() => test(ep.id)} className="text-primary-600 hover:underline cursor-pointer">
                      Send test event
                    </button>
                    <button onClick={() => remove(ep.id)} className="text-red-600 hover:underline cursor-pointer">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-background-200 bg-white p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground-900">Verifying a webhook</h2>
          <p className="text-sm text-foreground-500">
            Every request carries <code className="font-mono">X-ObPay-Event</code> and{" "}
            <code className="font-mono">X-ObPay-Signature</code>. The signature is an HMAC-SHA256 hex digest of the raw
            request body, keyed with your signing key.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-background-900 p-4 text-xs text-white">{`const expected = crypto
  .createHmac("sha256", process.env.OBPAY_WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");

if (expected !== req.headers["x-obpay-signature"]) {
  return res.status(401).send("Invalid signature");
}`}</pre>
        </div>

        <div className="rounded-xl border border-background-200 bg-white overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-background-100">
            <h2 className="text-sm font-semibold text-foreground-900">Recent deliveries</h2>
          </div>
          {deliveries.length === 0 ? (
            <div className="p-6 text-sm text-foreground-500">Nothing delivered yet.</div>
          ) : (
            <ul className="divide-y divide-background-100">
              {deliveries.map((d) => (
                <li key={d.id} className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-foreground-900">{d.event}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      d.status === "delivered" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {d.response_code ?? "no response"}
                  </span>
                  <span className="grow" />
                  <span className="text-xs text-foreground-500">{new Date(d.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
