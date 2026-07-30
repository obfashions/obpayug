import { useState, useEffect } from "react";
import { useParams, Link } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";

const SUPABASE_URL = import.meta.env.VITE_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com";

const FUNCTION_ENDPOINTS: Record<string, { name: string; desc: string }> = {
  "obpay-api-no-jwt": {
    name: "ObPay API",
    desc: "Main REST API for collect, payout, balance, and transaction status.",
  },
  "obpay-public-lookup": {
    name: "Public Merchant Lookup",
    desc: "Public endpoint for looking up merchant payment pages.",
  },
  "obpay-webhook-receiver": {
    name: "Webhook Receiver",
    desc: "Receives payment provider webhooks and updates transactions.",
  },
};

export default function ApiEndpointInfoPage() {
  const { functionName } = useParams<{ functionName: string }>();
  const [healthStatus, setHealthStatus] = useState<"checking" | "live" | "down">("checking");
  const [healthDetail, setHealthDetail] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  const funcKey = functionName || "obpay-api-no-jwt";
  const funcInfo = FUNCTION_ENDPOINTS[funcKey] || { name: funcKey, desc: "ObPay Edge Function" };
  const realEndpoint = `${SUPABASE_URL}/functions/v1/${funcKey}`;

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(realEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _action: "health" }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setHealthStatus("live");
          setHealthDetail(data.message || "Endpoint is responding correctly");
        } else {
          setHealthStatus("down");
          setHealthDetail(data?.error || `HTTP ${res.status}`);
        }
      } catch (err: any) {
        setHealthStatus("down");
        setHealthDetail(err.message || "Network error");
      }
    };
    checkHealth();
  }, [realEndpoint]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const curlExample = `curl -X POST ${realEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{"_action":"health"}'`;

  return (
    <div className="min-h-screen bg-background-50">
      <Navbar />
      <main className="pt-20 pb-16 px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          {/* BIG RED WARNING — Wrong URL */}
          <div className="bg-accent-500 border-2 border-accent-600 rounded-xl p-6 flex items-start gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-background-50/20 flex items-center justify-center shrink-0">
              <i className="ri-close-circle-line text-2xl text-background-50" />
            </div>
            <div>
              <h1 className="font-heading font-bold text-xl text-background-50 mb-2">
                Wrong URL — This Domain Does NOT Host the API
              </h1>
              <p className="text-sm text-background-50/90 leading-relaxed">
                You are visiting <strong className="text-background-50">{window.location.host}</strong> which is the <strong className="text-background-50">frontend website</strong> — not the API server. 
                The ObPay API lives on a completely separate Supabase domain. API requests sent to this domain will NOT work.
              </p>
            </div>
          </div>

          {/* BIG GREEN — Correct URL */}
          <div className="bg-emerald-500 border-2 border-emerald-600 rounded-xl p-6 flex items-start gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-background-50/20 flex items-center justify-center shrink-0">
              <i className="ri-check-line text-2xl text-background-50" />
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-bold text-xl text-background-50 mb-2">
                Copy THIS URL — This Is the Real API Endpoint
              </h2>
              <div className="flex items-center gap-2 mb-3">
                <code className="flex-1 px-4 py-3 rounded-lg bg-background-50 text-base text-foreground-900 font-mono font-bold break-all">
                  {realEndpoint}
                </code>
                <button
                  onClick={() => copy(realEndpoint, "endpoint")}
                  className="w-12 h-12 rounded-lg bg-background-50 hover:bg-foreground-100 flex items-center justify-center shrink-0 text-foreground-900 hover:text-primary-600 transition-colors cursor-pointer"
                  title="Copy to clipboard"
                >
                  <i className={copied === "endpoint" ? "ri-check-line text-xl text-emerald-600" : "ri-file-copy-line text-xl"} />
                </button>
              </div>
              {/* Live Status */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  healthStatus === "live"
                    ? "bg-background-50/30 text-background-50"
                    : healthStatus === "checking"
                    ? "bg-background-50/20 text-background-50"
                    : "bg-background-50/20 text-background-50"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    healthStatus === "live" ? "bg-background-50 animate-pulse" : healthStatus === "checking" ? "bg-background-50/60" : "bg-background-50/40"
                  }`} />
                  {healthStatus === "live" ? "API is LIVE and responding" : healthStatus === "checking" ? "Checking API status..." : "API may be temporarily unreachable"}
                </span>
                {healthDetail && (
                  <span className="text-xs text-background-50/80">{healthDetail}</span>
                )}
              </div>
            </div>
          </div>

          {/* Side by side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-close-circle-fill text-accent-500" />
                <span className="text-sm font-bold text-accent-700">DO NOT USE</span>
              </div>
              <code className="block text-sm text-accent-600 font-mono bg-accent-100 px-3 py-2 rounded-lg break-all">
                {window.location.origin}/functions/v1/{funcKey}
              </code>
              <p className="text-xs text-accent-500 mt-2">This is the frontend website — API calls will fail or show "page not generated"</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <i className="ri-checkbox-circle-fill text-emerald-500" />
                <span className="text-sm font-bold text-emerald-700">USE THIS</span>
              </div>
              <code className="block text-sm text-emerald-600 font-mono font-bold bg-emerald-100 px-3 py-2 rounded-lg break-all">
                {realEndpoint}
              </code>
              <p className="text-xs text-emerald-500 mt-2">This is the Supabase Edge Function — API calls will work here</p>
            </div>
          </div>

          {/* curl Example */}
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 mb-6">
            <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3 flex items-center gap-2">
              <i className="ri-terminal-line text-primary-500" />
              Test with curl (health check — no auth needed)
            </h3>
            <div className="bg-foreground-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-foreground-800 border-b border-foreground-700">
                <span className="text-xs text-foreground-400 font-mono">Terminal</span>
                <button
                  onClick={() => copy(curlExample, "curl")}
                  className="text-xs text-foreground-400 hover:text-foreground-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <i className={copied === "curl" ? "ri-check-line" : "ri-file-copy-line"} />
                  {copied === "curl" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="text-sm font-mono p-4 overflow-x-auto leading-relaxed text-primary-300 whitespace-pre-wrap">
                {curlExample}
              </pre>
            </div>
          </div>

          {/* All Endpoints */}
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5 mb-6">
            <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3">All ObPay API Endpoints (use the Supabase domain)</h3>
            <div className="space-y-2">
              {Object.entries(FUNCTION_ENDPOINTS).map(([slug, info]) => (
                <div key={slug} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-background-100">
                  <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground-800">{info.name}</p>
                      <span className="text-[10px] font-medium text-foreground-400">{info.desc}</span>
                    </div>
                    <code className="text-xs font-mono text-primary-600 break-all">{SUPABASE_URL}/functions/v1/{slug}</code>
                  </div>
                  <button
                    onClick={() => copy(`${SUPABASE_URL}/functions/v1/${slug}`, slug)}
                    className="w-8 h-8 rounded-lg hover:bg-background-200 flex items-center justify-center shrink-0 text-foreground-400 hover:text-primary-600 transition-colors cursor-pointer"
                  >
                    <i className={copied === slug ? "ri-check-line" : "ri-file-copy-line text-xs"} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/docs"
              className="inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-book-open-line" />
              Full API Documentation
            </Link>
            <Link
              to="/dashboard/api-keys"
              className="inline-flex items-center justify-center gap-2 bg-background-50 hover:bg-background-100 text-foreground-900 font-semibold px-5 py-2.5 rounded-lg text-sm border border-background-300/60 transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-key-2-line" />
              Get API Keys
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}