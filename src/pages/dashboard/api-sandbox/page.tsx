import { useMemo, useState } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { Link } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { simulateIntegration, type DemoRecord } from "@/lib/integration-testing";

type Method = "GET" | "POST";
interface Field { key: string; label: string; placeholder?: string; type?: "text" | "number" | "url"; path?: boolean; optional?: boolean }
interface Endpoint { id: string; label: string; method: Method; path: string; description: string; icon: string; fields: Field[] }

const ENDPOINTS: Endpoint[] = [
  { id: "ping", label: "Ping", method: "GET", path: "/ping", description: "Check that your secret key works.", icon: "ri-pulse-line", fields: [] },
  { id: "account", label: "Account", method: "GET", path: "/account", description: "Your merchant account details.", icon: "ri-user-line", fields: [] },
  { id: "balance", label: "Balance", method: "GET", path: "/balance", description: "Available and pending balance in UGX.", icon: "ri-wallet-3-line", fields: [] },
  {
    id: "collect", label: "Collect money", method: "POST", path: "/collect",
    description: "Sends a PIN prompt to the customer's MTN or Airtel phone.", icon: "ri-download-cloud-line",
    fields: [
      { key: "phone_number", label: "Customer phone", placeholder: "0772123456" },
      { key: "amount", label: "Amount (UGX, whole number)", placeholder: "1000", type: "number" },
      { key: "customer_name", label: "Customer name", placeholder: "Jane Doe" },
      { key: "customer_email", label: "Customer email", placeholder: "jane@example.com" },
      { key: "description", label: "Description", placeholder: "Order #1001", optional: true },
      { key: "reference", label: "Your reference", placeholder: "ORDER-1001", optional: true },
      { key: "callback_url", label: "Callback URL (https)", placeholder: "https://yoursite.com/obpay/callback", type: "url", optional: true },
    ],
  },
  {
    id: "payout", label: "Send money", method: "POST", path: "/payouts",
    description: "Pays out to MTN or Airtel Uganda. Check current minimums and fees before a live request.", icon: "ri-upload-cloud-line",
    fields: [
      { key: "phone_number", label: "Recipient phone", placeholder: "0772123456" },
      { key: "amount", label: "Amount (UGX, whole number)", placeholder: "10000", type: "number" },
      { key: "customer_name", label: "Recipient name", placeholder: "John Doe" },
      { key: "description", label: "Description", placeholder: "Supplier payment", optional: true },
      { key: "reference", label: "Your reference", placeholder: "PAY-1001", optional: true },
      { key: "callback_url", label: "Callback URL (https)", placeholder: "https://yoursite.com/obpay/callback", type: "url", optional: true },
    ],
  },
  {
    id: "status", label: "Transaction status", method: "GET", path: "/transactions/{reference}",
    description: "Look up one transaction by its reference.", icon: "ri-search-eye-line",
    fields: [{ key: "reference", label: "Reference", placeholder: "OBP...", path: true }],
  },
  { id: "transactions", label: "List transactions", method: "GET", path: "/transactions", description: "Your most recent transactions.", icon: "ri-list-check-2", fields: [] },
  { id: "links", label: "Payment links", method: "GET", path: "/payment-links", description: "All your payment links.", icon: "ri-links-line", fields: [] },
  { id: "rules", label: "Live payout rules", method: "GET", path: "/payout-methods?currency=UGX", description: "Current Uganda network minimums and charges. Available in live mode only.", icon: "ri-information-line", fields: [] },
  { id: "deliveries", label: "Webhook deliveries", method: "GET", path: "/webhook-deliveries", description: "Recent signed notifications to your server. Simulation does not deliver webhooks.", icon: "ri-webhook-line", fields: [] },
];

interface Result { status: number; ms: number; body: unknown; url: string }

export default function ApiSandboxPage() {
  const [secret, setSecret] = useState("");
  const [active, setActive] = useState<Endpoint>(ENDPOINTS[0] ?? { id: "ping", label: "Ping", method: "GET", path: "/ping", description: "", icon: "ri-pulse-line", fields: [] });
  const [mode, setMode] = useState<"simulation" | "live">("simulation");
  const [confirmedLive, setConfirmedLive] = useState(false);
  const [demoRecords, setDemoRecords] = useState<DemoRecord[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const base = typeof window !== "undefined" ? `${window.location.origin}/api/public/v1` : "https://obpay.online/api/public/v1";

  const built = useMemo(() => {
    let path = active.path;
    const body: Record<string, unknown> = {};
    for (const f of active.fields) {
      const v = (values[f.key] || "").trim();
      if (f.path) path = path.replace(`{${f.key}}`, encodeURIComponent(v || `{${f.key}}`));
      else if (v) body[f.key] = f.type === "number" ? Number(v) : v;
    }
    return { url: `${base}${path}`, body };
  }, [active, values, base]);

  const curl = useMemo(() => {
    const lines = [`curl -X ${active.method} "${built.url}"`, `  -H "Authorization: Bearer ${secret ? "sk_live_…" : "YOUR_SECRET_KEY"}"`];
    if (active.method === "POST") lines.push(`  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(built.body)}'`);
    return lines.join(" \\\n");
  }, [active, built, secret]);

  const missing = active.fields.filter((f) => !f.optional && !(values[f.key] || "").trim()).map((f) => f.label);

  const send = async () => {
    if (missing.length) return setResult({ status: 0, ms: 0, url: built.url, body: { error: `Fill in: ${missing.join(", ")}` } });
    if (mode === "simulation") {
      if (active.id === "rules") return setResult({ status: 0, ms: 0, url: built.url, body: { simulated: true, error: "Current network rules require a live authenticated read; no simulated tariff is provided." } });
      const demo = simulateIntegration(new URL(built.url).pathname.replace("/api/public/v1", ""), active.method, built.body, demoRecords);
      setDemoRecords(demo.records);
      return setResult({ status: demo.response.success ? 200 : 400, ms: 0, url: "Local simulation — no request sent", body: demo.response });
    }
    if (!secret.trim()) return setResult({ status: 0, ms: 0, url: built.url, body: { error: "Paste your secret key first (from the API Keys page)." } });
    if (!secret.trim().startsWith("sk_live_")) return setResult({ status: 0, ms: 0, url: built.url, body: { error: "Live requests require a live key. Use Simulation without credentials for demonstration." } });
    if (active.method === "POST" && !confirmedLive) return setResult({ status: 0, ms: 0, url: built.url, body: { error: "Confirm the real payment before sending." } });
    setBusy(true);
    const t = performance.now();
    try {
      const resp = await fetch(built.url, {
        method: active.method,
        headers: { Authorization: `Bearer ${secret.trim()}`, ...(active.method === "POST" ? { "Content-Type": "application/json" } : {}) },
        body: active.method === "POST" ? JSON.stringify(built.body) : undefined,
      });
      const text = await resp.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* keep text */ }
      setResult({ status: resp.status, ms: Math.round(performance.now() - t), body, url: built.url });
    } catch (e: any) {
      setResult({ status: 0, ms: Math.round(performance.now() - t), url: built.url, body: { error: e?.message || "Network error" } });
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-primary-400";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Integration testing</h1>
          <p className="text-sm text-foreground-600 mt-1">
            {mode === "simulation" ? "Simulation · No money moves, no PIN prompt is sent and no webhook is delivered." : "Live · Collections request real customer approval; payouts send real money."}{" "}
            <Link to="/docs" className="text-primary-600 font-medium">Read the docs →</Link>
          </p>
        </div>

        <div className="flex gap-2" aria-label="Testing mode">
          {(["simulation", "live"] as const).map((value) => <Button key={value} variant={mode === value ? "default" : "outline"} aria-pressed={mode === value} onClick={() => { setMode(value); setConfirmedLive(false); setResult(null); }}>{value === "simulation" ? "Simulation" : "Live"}</Button>)}
        </div>
        {mode === "live" && <div className="bg-background-50 rounded-xl border border-background-200/70 p-4 sm:p-5">
          <label className="block text-xs font-medium text-foreground-600 mb-1.5">Secret key</label>
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="sk_live_…" className={`${input} font-mono`} autoComplete="off" />
          <p className="text-[11px] text-foreground-500 mt-1">
            Find or create it on the <Link to="/dashboard/api-keys" className="text-primary-600">API Keys</Link> page. It stays in this browser tab only.
          </p>
        </div>}

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-1">
            {ENDPOINTS.map((e) => (
              <Button variant={active.id === e.id ? "default" : "outline"}
                key={e.id}
                onClick={() => { setActive(e); setResult(null); setConfirmedLive(false); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm whitespace-nowrap cursor-pointer border transition-colors ${active.id === e.id ? "bg-primary-500 text-background-50 border-primary-500" : "bg-background-50 text-foreground-700 border-background-200/70 hover:bg-background-100"}`}
              >
                <i className={e.icon} />
                <span className="font-medium">{e.label}</span>
                <span className={`ml-auto text-[10px] font-mono px-1.5 rounded ${active.id === e.id ? "bg-background-50/20" : "bg-background-200"}`}>{e.method}</span>
              </Button>
            ))}
          </div>

          <div className="space-y-4 min-w-0">
            <div className="bg-background-50 rounded-xl border border-background-200/70 p-4 sm:p-5 space-y-4">
              <div>
                <p className="font-mono text-xs text-foreground-600 break-all"><span className="font-bold text-primary-600">{active.method}</span> /api/public/v1{active.path}</p>
                <p className="text-sm text-foreground-700 mt-1">{active.description}</p>
              </div>
              {active.fields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {active.fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-foreground-600 mb-1">{f.label}{f.optional && <span className="text-foreground-400"> (optional)</span>}</label>
                      <input type={f.type === "number" ? "number" : "text"} inputMode={f.type === "number" ? "numeric" : undefined} value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.placeholder} className={input} />
                    </div>
                  ))}
                </div>
              )}
              {mode === "live" && active.method === "POST" && <label className="flex items-start gap-2 text-sm text-foreground"><input type="checkbox" checked={confirmedLive} onChange={(event) => setConfirmedLive(event.target.checked)} />I authorise this real payment request to the number and amount entered.</label>}
              <Button onClick={send} disabled={busy || (mode === "live" && active.method === "POST" && !confirmedLive)}>
                {busy ? <><i className="ri-loader-4-line animate-spin mr-1" />Sending…</> : <><i className="ri-send-plane-line mr-1" />{mode === "simulation" ? "Simulate request" : "Send live request"}</>}
              </Button>
            </div>

            <div className="bg-foreground-900 rounded-xl p-4 overflow-x-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] uppercase tracking-wide text-background-50/60">cURL</span>
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(curl)} className="text-background-50"><i className="ri-file-copy-line mr-1" />Copy</Button>
              </div>
              <pre className="text-xs text-background-50 font-mono whitespace-pre">{curl}</pre>
            </div>

            {result && (
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-4">
                <div className="flex items-center gap-3 mb-2 text-xs">
                  <span className={`font-bold px-2 py-0.5 rounded ${result.status >= 200 && result.status < 300 ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"}`}>{result.status || "—"}</span>
                  <span className="text-foreground-500">{result.ms} ms</span>
                </div>
                <p className="text-xs text-foreground-500 mb-2">{result.url}</p>
                <pre aria-label="API response" className="text-xs font-mono text-foreground-800 bg-background-100 rounded-lg p-3 overflow-x-auto max-h-96">{typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
