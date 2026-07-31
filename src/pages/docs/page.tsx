import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";

type DocSection =
  | "overview"
  | "authentication"
  | "collect"
  | "send"
  | "balance"
  | "status"
  | "webhooks"
  | "polling"
  | "errors"
  | "sdk"
  | "obpay-api"
  | "integration"
  | "livepay-guide"
  | "rate-limiting"
  | "security"
  | "testing"
  | "complete-integration";

const navSections = [
  { id: "overview" as DocSection, label: "Overview", icon: "ri-home-4-line" },
  { id: "authentication" as DocSection, label: "Authentication", icon: "ri-shield-keyhole-line" },
  { id: "collect" as DocSection, label: "Collect Money", icon: "ri-download-cloud-line" },
  { id: "send" as DocSection, label: "Send Money", icon: "ri-upload-cloud-line" },
  { id: "balance" as DocSection, label: "Check Balance", icon: "ri-wallet-3-line" },
  { id: "status" as DocSection, label: "Transaction Status", icon: "ri-search-eye-line" },
  { id: "webhooks" as DocSection, label: "Webhooks", icon: "ri-webhook-line" },
  { id: "polling" as DocSection, label: "Polling & Sync", icon: "ri-refresh-line" },
  { id: "errors" as DocSection, label: "Error Codes", icon: "ri-error-warning-line" },
  { id: "sdk" as DocSection, label: "SDK Examples", icon: "ri-code-s-slash-line" },
  { id: "obpay-api" as DocSection, label: "ObPay API", icon: "ri-plug-line" },
  { id: "integration" as DocSection, label: "Website Integration", icon: "ri-global-line" },
  { id: "livepay-guide" as DocSection, label: "How Payments Work", icon: "ri-guide-line" },
  { id: "rate-limiting" as DocSection, label: "Rate Limits", icon: "ri-speed-line" },
  { id: "security" as DocSection, label: "Security Guide", icon: "ri-shield-star-line" },
  { id: "testing" as DocSection, label: "Testing & Go-Live", icon: "ri-test-tube-line" },
  { id: "complete-integration" as DocSection, label: "Build a Payment Website", icon: "ri-layout-masonry-line" },
];

function CodeBlock({ title, code, lang = "bash" }: { title?: string; code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-foreground-900 rounded-xl overflow-hidden my-4">
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-foreground-800 border-b border-foreground-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
              <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
              <div className="w-2.5 h-2.5 bg-primary-500 rounded-full" />
            </div>
            <span className="text-xs text-foreground-400 font-mono">{title}</span>
          </div>
          <button
            onClick={handleCopy}
            className="text-xs text-foreground-400 hover:text-foreground-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <pre className="text-sm font-mono p-4 overflow-x-auto leading-relaxed text-primary-300 whitespace-pre-wrap">{code.trim()}</pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: { param: string; type: string; required: boolean | "conditional"; desc: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-background-200/70 my-4">
      <table className="w-full text-sm">
        <thead className="bg-background-100">
          <tr>
            <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Parameter</th>
            <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Type</th>
            <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Required</th>
            <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-background-200/70">
          {rows.map((r) => (
            <tr key={r.param} className="hover:bg-background-50/50">
              <td className="px-4 py-3"><code className="text-xs font-mono text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{r.param}</code></td>
              <td className="px-4 py-3 text-foreground-600 text-xs">{r.type}</td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  r.required === true ? "bg-accent-100 text-accent-700" :
                  r.required === "conditional" ? "bg-secondary-100 text-secondary-700" :
                  "bg-background-100 text-foreground-500"
                }`}>
                  {r.required === true ? "Required" : r.required === "conditional" ? "Conditional" : "Optional"}
                </span>
              </td>
              <td className="px-4 py-3 text-foreground-600 text-xs">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ icon, label, subtitle, badge }: { icon: string; label: string; subtitle?: string; badge?: { text: string; color: string } }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-10 h-10 rounded-xl bg-${badge?.color || "primary"}-100 flex items-center justify-center shrink-0`}>
        <i className={`${icon} text-xl text-${badge?.color || "primary"}-600`} />
      </div>
      <div>
        <h2 className="font-heading font-bold text-2xl text-foreground-900">{label}</h2>
        {badge && (
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 bg-${badge.color}-500 text-background-50 rounded font-mono`}>{badge.text}</span>
            {subtitle && <code className="text-xs font-mono text-foreground-600">{subtitle}</code>}
          </div>
        )}
        {!badge && subtitle && <p className="text-sm text-foreground-600 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("overview");
  const [sdkLang, setSdkLang] = useState<"javascript" | "php" | "python" | "direct-http">("javascript");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const mainRef = useRef<HTMLDivElement>(null);

  const scrollToSection = useCallback((id: DocSection) => {
    const el = sectionRefs.current.get(id);
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setActiveSection(id);
    setIsMobileNavOpen(false);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      let current: DocSection = "overview";
      let closestTop = Infinity;
      const scrollY = window.scrollY + 200;

      sectionRefs.current.forEach((el, id) => {
        const rect = el.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        if (absoluteTop <= scrollY && scrollY - absoluteTop < closestTop) {
          closestTop = scrollY - absoluteTop;
          current = id as DocSection;
        }
      });
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background-50">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "ObPay API Documentation",
          url: `${import.meta.env.VITE_SITE_URL}/docs`,
          description: "Complete API reference for the ObPay payment gateway. Learn how to collect money, send payouts, check balances, and integrate mobile money payments across East Africa.",
          about: {
            "@type": "Thing",
            name: "Payment Gateway API",
          },
        }}
      />
      <Navbar />
      <div className="pt-16 md:pt-20 flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 xl:w-72 bg-background-50 border-r border-background-200/70 sticky top-16 md:top-20 h-[calc(100vh-4rem)] overflow-y-auto shrink-0">
          <div className="p-5">
            <div className="mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground-400 mb-2 px-2">ObPay API Docs</p>
              <div className="flex items-center gap-2 px-2 py-1.5 bg-primary-100 rounded-lg border border-primary-200/60 mb-3">
                <span className="text-xs text-primary-700 font-semibold">OBPay Payment Platform</span>
                <i className="ri-shield-check-line text-xs text-primary-500 ml-auto" />
              </div>
            </div>
            <nav className="space-y-0.5">
              {navSections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => scrollToSection(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                    activeSection === s.id
                      ? "bg-primary-100 text-primary-700"
                      : "text-foreground-600 hover:bg-background-100 hover:text-foreground-900"
                  }`}
                >
                  <i className={`${s.icon} text-base`} />
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile Nav Toggle */}
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="lg:hidden fixed bottom-6 left-6 z-50 w-12 h-12 bg-primary-500 text-background-50 rounded-full flex items-center justify-center cursor-pointer"
        >
          <i className={isMobileNavOpen ? "ri-close-line text-lg" : "ri-menu-line text-lg"} />
        </button>

        {isMobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40 bg-foreground-900/40" onClick={() => setIsMobileNavOpen(false)}>
            <aside className="w-64 bg-background-50 h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
              <nav className="space-y-0.5 mt-16">
                {navSections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left cursor-pointer ${
                      activeSection === s.id ? "bg-primary-100 text-primary-700" : "text-foreground-600 hover:bg-background-100"
                    }`}
                  >
                    <i className={`${s.icon} text-base`} />
                    {s.label}
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content - All sections in one scrolling page */}
        <main ref={mainRef} className="flex-1 min-w-0 px-4 md:px-8 lg:px-10 py-8 max-w-4xl">

          {/* ======================== OVERVIEW ======================== */}
          <section
            id="overview"
            ref={(el) => { if (el) sectionRefs.current.set("overview", el); }}
            className="pb-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-home-4-line" label="ObPay API Documentation" subtitle={`Base URL: https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt`} />

            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-error-warning-line text-accent-600 text-lg shrink-0 mt-0.5" />
              <div className="text-sm text-foreground-700">
                <strong className="text-accent-700">Two integration methods — pick what works for your stack.</strong>
                <span className="block mt-2">
                  <strong>Option A — Direct HTTP (any hosting):</strong> Use your <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">X-API-Key: sk_live_YOUR_KEY</code> header directly. Works with raw <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">fetch</code>, <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">axios</code>, <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">curl</code>, PHP, Python requests, or any HTTP client. No SDK needed. See <strong>Direct HTTP</strong> section in SDK Examples.
                </span>
                <span className="block mt-2">
                  <strong>Option B — Supabase SDK:</strong> Install <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">@supabase/supabase-js</code> (JS) or <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">supabase</code> (Python) and use <code className="font-mono text-xs bg-accent-100 px-1 py-0.5 rounded">functions.invoke()</code>. The SDK handles JWT automatically.
                </span>
              </div>
            </div>

            <div className="bg-background-50 border-2 border-primary-300/60 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ri-plug-line text-primary-600 text-lg" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-foreground-900 mb-2">What You Need — 3 Things</h3>
                  <p className="text-xs text-foreground-500 mb-3">
                    Only 3 things needed to integrate. The first two are the same for every ObPay user — only your Secret Key is unique.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-background-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-foreground-900 mb-1">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold mr-1.5">1</span>
                        API URL
                      </p>
                      <code className="text-[11px] font-mono text-foreground-600 break-all">...helloreaddy.com/functions/v1/obpay-api-no-jwt</code>
                      <p className="text-[10px] text-foreground-400 mt-1">Same for everyone</p>
                    </div>
                    <div className="bg-background-100 rounded-lg p-3">
                      <p className="text-xs font-semibold text-foreground-900 mb-1">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-background-50 text-[10px] font-bold mr-1.5">2</span>
                        Public Key
                      </p>
                      <code className="text-[11px] font-mono text-foreground-600">sb_publishable...</code>
                      <p className="text-[10px] text-foreground-400 mt-1">Supabase anon key — safe to commit</p>
                    </div>
                    <div className="bg-accent-50 rounded-lg p-3 border border-accent-200/60">
                      <p className="text-xs font-semibold text-foreground-900 mb-1">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent-500 text-background-50 text-[10px] font-bold mr-1.5">3</span>
                        Secret Key
                      </p>
                      <code className="text-[11px] font-mono text-foreground-600">sk_live_YOUR_KEY</code>
                      <p className="text-[10px] text-foreground-400 mt-1">
                        <i className="ri-shield-check-line mr-0.5 text-accent-500" />
                        Server-side only — never expose
                      </p>
                    </div>
                  </div>
                  <div className="bg-primary-50 border border-primary-200/60 rounded-lg p-3 mt-3">
                    <div className="flex items-start gap-2">
                      <i className="ri-information-line text-primary-600 text-sm shrink-0 mt-0.5" />
                      <div className="text-xs text-foreground-700">
                        <strong>How it works:</strong> Install the Supabase client SDK (<code className="text-[11px] font-mono bg-primary-100 px-1 rounded">@supabase/supabase-js</code> or <code className="text-[11px] font-mono bg-primary-100 px-1 rounded">supabase</code> for Python), create a client with #1 + #2 (both public), then pass #3 as <code className="text-[11px] font-mono bg-primary-100 px-1 rounded">_api_key</code> in every request body. The SDK handles JWT auth automatically. Raw HTTP / curl will return 401.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ObPay Public Key — the Supabase Anon Key */}
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-key-2-line text-primary-600 text-lg shrink-0 mt-0.5" />
              <div className="text-sm text-foreground-700">
                <strong className="text-primary-700">ObPay Public Key (Supabase Anon Key)</strong>
                <span className="block mt-1">
                  This is your <strong>public key</strong> — the same for all ObPay integrations. Use it with <code className="font-mono text-xs bg-primary-100 px-1 py-0.5 rounded">createClient(url, publicKey)</code>. It's already public and safe to commit.
                </span>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 text-xs font-mono bg-primary-100 px-3 py-1.5 rounded-lg border border-primary-200/60 text-primary-800 break-all select-all">
                    sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText('sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt'); }}
                    className="w-10 h-10 rounded-lg bg-primary-100 hover:bg-primary-200 flex items-center justify-center shrink-0 text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
                    title="Copy public key"
                  >
                    <i className="ri-file-copy-line" />
                  </button>
                </div>
                <p className="text-xs text-foreground-500 mt-1.5">
                  <i className="ri-information-line mr-1" />
                  This key is already public (it ships in the ObPay website's browser code). Your <strong>Secret Key</strong> (from Dashboard → API Keys) is what actually controls access.
                </p>
              </div>
            </div>

            <div className="prose prose-sm max-w-none text-foreground-700 space-y-4">
              <p>
                ObPay is a complete payment platform for mobile money collections and payouts across East Africa. It gives you a RESTful API, real-time webhooks, a merchant dashboard, and built-in wallet management — everything you need to accept and send mobile money payments.
              </p>
              <p>
                Under the hood, ObPay routes transactions through trusted mobile money aggregators to reach MTN, Airtel, and bank networks. But you only need your <strong>ObPay API key</strong> — we handle the rest.
              </p>
              <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 flex items-start gap-3">
                <i className="ri-information-line text-primary-600 mt-0.5" />
                <p className="text-sm text-foreground-700">
                  <strong>One platform, one API key.</strong> Get your API credentials from <strong>Dashboard → API Keys</strong> after completing KYC verification. All endpoints use the same base URL and authentication.
                </p>
              </div>

              <h2 className="text-lg font-semibold text-foreground-900 mt-6">Supported Countries &amp; Networks (MarzPay)</h2>
              <div className="overflow-x-auto rounded-xl border border-background-200/70">
                <table className="w-full text-sm">
                  <thead className="bg-background-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Country</th>
                      <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Currency</th>
                      <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Networks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-background-200/70">
                    {[
                      { flag: "🇺🇬", country: "Uganda", code: "UGX", networks: ["MTN", "AIRTEL"] },
                      { flag: "🇰🇪", country: "Kenya", code: "KES", networks: ["SAFARICOM", "AIRTEL"] },
                      { flag: "🇬🇭", country: "Ghana", code: "GHS", networks: ["MTN", "AIRTELTIGO", "VODAFONE"] },
                      { flag: "🇨🇲", country: "Cameroon", code: "XAF", networks: ["MTN", "ORANGE"] },
                    ].map((r) => (
                      <tr key={r.country}>
                        <td className="px-4 py-3"><span className="text-lg mr-2">{r.flag}</span><span className="text-foreground-800 font-medium">{r.country}</span></td>
                        <td className="px-4 py-3"><code className="font-mono text-xs bg-background-100 px-1.5 py-0.5 rounded text-foreground-700">{r.code}</code></td>
                        <td className="px-4 py-3 flex flex-wrap gap-1.5">
                          {r.networks.map((n) => (
                            <span key={n} className="px-2 py-0.5 bg-secondary-100 text-secondary-700 text-xs font-medium rounded-full">{n}</span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="text-lg font-semibold text-foreground-900 mt-6">Quick Start — Request Format</h2>
              <CodeBlock title="Terminal (Format only — see SDK for working code)" code={`curl "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{
    "_action": "collect",
    "phoneNumber": "0777123456",
    "amount": 50000,
    "currency": "UGX",
    "reference": "INVOICE123456789",
    "description": "Payment for invoice"
  }'`} />
              <div className="bg-accent-50 border border-accent-200/60 rounded-lg px-3 py-2.5 mt-2">
                <p className="text-xs text-foreground-700">
                  <i className="ri-information-line text-accent-600 mr-1" />
                  <strong>Raw HTTP returns 401.</strong> The Supabase gateway requires JWT. Jump to <a href="#sdk" className="text-primary-600 hover:underline font-medium">SDK Examples</a> for copy-paste-ready working code.
                </p>
              </div>
            </div>
          </section>

          {/* ======================== AUTHENTICATION ======================== */}
          <section
            id="authentication"
            ref={(el) => { if (el) sectionRefs.current.set("authentication", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-shield-keyhole-line" label="Authentication" badge={{ text: "AUTH", color: "secondary" }} />
            <p className="text-foreground-700 mb-4">All API requests require your <strong>ObPay Secret Key</strong> in the <code className="text-xs font-mono bg-background-100 px-1.5 py-0.5 rounded text-foreground-800">X-API-Key</code> header.</p>
            <CodeBlock title="Header Format" code="X-API-Key: sk_live_YOUR_OBPAY_SECRET_KEY" />
            <p className="text-sm text-foreground-600 mb-6">Your API key is validated against ObPay's database. The key must be active and your account must be verified (KYC approved).</p>

            <h3 className="font-semibold text-foreground-900 mb-3">Available Endpoints</h3>
            <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
              {[
                { method: "POST", path: "/collect", desc: "Request mobile money collection" },
                { method: "POST", path: "/payout", desc: "Send money to mobile wallet" },
                { method: "GET", path: "/balance", desc: "Check wallet balance" },
                { method: "GET", path: "/transaction/{ref}", desc: "Check transaction status" },
                { method: "GET", path: "/health", desc: "API health check (no auth needed)" },
              ].map((ep) => (
                <div key={ep.path} className="flex items-center gap-3 px-4 py-3 border-b border-background-200/60 last:border-0">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded w-10 text-center ${ep.method === "POST" ? "bg-primary-500 text-background-50" : "bg-secondary-500 text-background-50"}`}>{ep.method}</span>
                  <code className="text-sm font-mono text-foreground-800 flex-1">{ep.path}</code>
                  <span className="text-xs text-foreground-500 hidden md:block">{ep.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ======================== COLLECT ======================== */}
          <section
            id="collect"
            ref={(el) => { if (el) sectionRefs.current.set("collect", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-download-cloud-line" label="Collect Money API" badge={{ text: "POST", color: "primary" }} subtitle="/obpay-api  (with _action: collect)" />
            <p className="text-foreground-700 mb-4">Receive payments from mobile money users. Funds are added to your ObPay wallet balance when the transaction is successful.</p>
            <CodeBlock title="Terminal (Request Format — see SDK for working code)" code={`curl "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{
    "_action": "collect",
    "phoneNumber": "0777123456",
    "amount": 50000,
    "currency": "UGX",
    "reference": "INVOICE123456789",
    "description": "Payment for invoice"
  }'`} />
            <div className="bg-accent-50 border border-accent-200/60 rounded-lg px-3 py-2.5 mt-2">
              <p className="text-xs text-foreground-700">
                <i className="ri-information-line text-accent-600 mr-1" />
                <strong>Note:</strong> Raw HTTP / curl calls return <strong>HTTP 401</strong> due to Supabase JWT verification. This example shows the request format. For working code, see the <a href="#sdk" className="text-primary-600 hover:underline font-medium">SDK Examples</a> section below which uses the Supabase client SDK.
              </p>
            </div>
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Request Parameters</h3>
            <ParamTable rows={[
              { param: "_action", type: "String", required: true, desc: "Must be 'collect' for collection requests" },
              { param: "phoneNumber", type: "String", required: true, desc: "Customer's phone number (any format accepted)" },
              { param: "amount", type: "Number", required: true, desc: "Amount to collect in the specified currency" },
              { param: "currency", type: "String", required: true, desc: "Currency code (e.g., UGX, KES)" },
              { param: "reference", type: "String", required: false, desc: "Unique reference ID (auto-generated if empty)" },
              { param: "description", type: "String", required: false, desc: "Transaction description or reason" },
              { param: "network", type: "String", required: false, desc: "For non-UGX currencies (e.g., SAFARICOM, AIRTEL)" },
            ]} />
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Success Response (200 OK)</h3>
            <CodeBlock title="success.json" code={`{
  "success": true,
  "data": {
    "reference": "INVOICE123456789",
    "transaction_id": "uuid-here",
    "status": "pending",
    "amount": 50000,
    "currency": "UGX",
    "message": "Collection request sent. Awaiting customer confirmation."
  }
}`} />
            <div className="mt-4">
              <Link to="/dashboard/api-sandbox" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                <i className="ri-terminal-box-line" /> Try in Sandbox
              </Link>
            </div>
          </section>

          {/* ======================== SEND ======================== */}
          <section
            id="send"
            ref={(el) => { if (el) sectionRefs.current.set("send", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-upload-cloud-line" label="Send Money (Payout) API" badge={{ text: "POST", color: "primary" }} subtitle="/obpay-api  (with _action: payout)" />
            <p className="text-foreground-700 mb-4">Send money directly to mobile money users. Funds are deducted from your ObPay wallet balance.</p>
            <CodeBlock title="Terminal" code={`curl "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{
    "_action": "payout",
    "phoneNumber": "0777123456",
    "amount": 50000,
    "currency": "UGX",
    "reference": "WITHDRAW123",
    "description": "Salary payment"
  }'`} />
            <div className="bg-accent-50 border border-accent-200/60 rounded-lg px-3 py-2.5 mt-2">
              <p className="text-xs text-foreground-700">
                <i className="ri-information-line text-accent-600 mr-1" />
                <strong>Note:</strong> Raw HTTP / curl calls return <strong>HTTP 401</strong>. See the <a href="#sdk" className="text-primary-600 hover:underline font-medium">SDK Examples</a> for working Supabase client code.
              </p>
            </div>
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Request Parameters</h3>
            <ParamTable rows={[
              { param: "_action", type: "String", required: true, desc: "Must be 'payout' for send money requests" },
              { param: "phoneNumber", type: "String", required: true, desc: "Recipient's phone number" },
              { param: "amount", type: "Number", required: true, desc: "Amount to send" },
              { param: "currency", type: "String", required: true, desc: "Currency code (UGX, KES, etc.)" },
              { param: "reference", type: "String", required: false, desc: "Unique reference (auto-generated if empty)" },
              { param: "description", type: "String", required: false, desc: "Payment description" },
              { param: "network", type: "String", required: false, desc: "Required for non-UGX currencies" },
            ]} />
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Success Response (200 OK)</h3>
            <CodeBlock title="success.json" code={`{
  "success": true,
  "data": {
    "reference": "WITHDRAW123",
    "transaction_id": "uuid-here",
    "status": "pending",
    "amount": 50000,
    "currency": "UGX",
    "message": "Payout request submitted. Awaiting processing."
  }
}`} />
            <div className="mt-4">
              <Link to="/dashboard/api-sandbox" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                <i className="ri-terminal-box-line" /> Try in Sandbox
              </Link>
            </div>
          </section>

          {/* ======================== BALANCE ======================== */}
          <section
            id="balance"
            ref={(el) => { if (el) sectionRefs.current.set("balance", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-wallet-3-line" label="Check Balance API" badge={{ text: "POST", color: "secondary" }} subtitle="/obpay-api  (with _action: balance)" />
            <p className="text-foreground-700 mb-4">Check your ObPay wallet balance.</p>
            <CodeBlock title="Terminal" code={`curl "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{
    "_action": "balance"
  }'`} />
            <div className="bg-accent-50 border border-accent-200/60 rounded-lg px-3 py-2.5 mt-2">
              <p className="text-xs text-foreground-700">
                <i className="ri-information-line text-accent-600 mr-1" />
                <strong>Note:</strong> Raw HTTP / curl calls return <strong>HTTP 401</strong>. See the <a href="#sdk" className="text-primary-600 hover:underline font-medium">SDK Examples</a> for working Supabase client code.
              </p>
            </div>
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Parameters</h3>
            <ParamTable rows={[
              { param: "_action", type: "String", required: true, desc: "Must be 'balance'" },
            ]} />
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Success Response (200 OK)</h3>
            <CodeBlock title="success.json" code={`{
  "success": true,
  "data": {
    "available_balance": 1500000,
    "pending_balance": 200000,
    "currency": "UGX"
  }
}`} />
          </section>

          {/* ======================== STATUS ======================== */}
          <section
            id="status"
            ref={(el) => { if (el) sectionRefs.current.set("status", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-search-eye-line" label="Transaction Status API" badge={{ text: "POST", color: "secondary" }} subtitle="/obpay-api  (with _action: transaction-status)" />
            <p className="text-foreground-700 mb-4">Check the status of any transaction using its reference ID.</p>
            <CodeBlock title="Terminal" code={`curl "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{
    "_action": "transaction-status",
    "reference": "INVOICE123"
  }'`} />
            <div className="bg-accent-50 border border-accent-200/60 rounded-lg px-3 py-2.5 mt-2">
              <p className="text-xs text-foreground-700">
                <i className="ri-information-line text-accent-600 mr-1" />
                <strong>Note:</strong> Raw HTTP / curl calls return <strong>HTTP 401</strong>. See the <a href="#sdk" className="text-primary-600 hover:underline font-medium">SDK Examples</a> for working Supabase client code.
              </p>
            </div>
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Parameters</h3>
            <ParamTable rows={[
              { param: "_action", type: "String", required: true, desc: "Must be 'transaction-status'" },
              { param: "reference", type: "String", required: true, desc: "Your transaction reference" },
            ]} />
            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Success Response (200 OK)</h3>
            <CodeBlock title="success.json" code={`{
  "success": true,
  "data": {
    "id": "uuid",
    "reference": "INVOICE123456789",
    "status": "success",
    "amount": 50000,
    "currency": "UGX",
    "fee_amount": 2500,
    "net_amount": 47500,
    "customer_phone": "+256777123456",
    "payment_method": "MTN",
    "created_at": "2024-01-15 10:30:00",
    "completed_at": "2024-01-15 10:32:15"
  }
}`} />
          </section>

          {/* ======================== WEBHOOKS ======================== */}
          <section
            id="webhooks"
            ref={(el) => { if (el) sectionRefs.current.set("webhooks", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-webhook-line" label="Webhooks" badge={{ text: "EVENT", color: "secondary" }} />
            <p className="text-foreground-700 mb-4">Receive real-time notifications when a transaction status changes. ObPay sends an HTTP POST to your configured webhook URL with the transaction result. But more importantly, the payment provider sends webhooks to <strong>ObPay's webhook receiver</strong> — which automatically credits your wallet the moment a payment completes.</p>

            {/* Two-direction webhook flow */}
            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">How Auto-Sync Works (Two Webhook Directions)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200/60">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-arrow-down-circle-line text-emerald-600" />
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Provider → ObPay</span>
                </div>
                <p className="text-xs text-foreground-600">
                  The payment provider sends webhooks to <strong>ObPay's receiver</strong> when payments complete. ObPay automatically updates the transaction status and credits your wallet. <strong>You must configure the webhook URL in your provider's dashboard</strong> for this to work.
                </p>
              </div>
              <div className="bg-primary-50 rounded-xl p-4 border border-primary-200/60">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-arrow-up-circle-line text-primary-600" />
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wide">ObPay → Your Server</span>
                </div>
                <p className="text-xs text-foreground-600">
                  ObPay forwards the event to <strong>your webhook URL</strong> (configured in Dashboard → Webhooks) so your own server is notified in real-time. This is optional but recommended for production.
                </p>
              </div>
            </div>
            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-error-warning-line text-accent-600 mt-0.5" />
              <p className="text-sm text-foreground-700">Your webhook endpoint must return a <strong>200 OK</strong> within 10 seconds. Failed deliveries are retried 3 times with a 30-second delay.</p>
            </div>

            {/* ─── CRITICAL: Provider Webhook URL ─── */}
            <div className="bg-accent-50 border-2 border-accent-300/60 rounded-xl p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center shrink-0 mt-0.5">
                  <i className="ri-alert-line text-accent-600 text-xl" />
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-2">
                    <i className="ri-error-warning-fill text-accent-500 mr-1" />
                    CRITICAL: Configure This Webhook URL in Your Provider
                  </h3>
                  <p className="text-xs text-foreground-600 mb-3">
                    <strong>Without this, payments complete with the provider but NEVER show in your ObPay wallet.</strong> You MUST configure your payment provider to send webhooks to ObPay's webhook receiver URL.
                  </p>
                  <div className="bg-background-50 rounded-lg p-3 mb-3 border border-background-200/70">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-foreground-400 mb-1">Webhook URL</p>
                    <code className="block text-xs font-mono text-accent-800 bg-accent-100 px-3 py-2 rounded-lg break-all select-all">
                      https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/marz-webhook
                    </code>
                  </div>
                  <div className="space-y-1.5 text-xs text-foreground-600">
                    <p><strong>Steps:</strong></p>
                    <p>1. Copy the URL above</p>
                    <p>2. Login to your payment provider dashboard</p>
                    <p>3. Go to Settings → Webhooks or Developer → Webhooks</p>
                    <p>4. Paste the URL as the webhook endpoint</p>
                    <p>5. Select events: <strong>all transaction events</strong> or specifically Success and Failed</p>
                  </div>
                  <p className="text-xs text-accent-700 mt-3">
                    <i className="ri-information-line mr-1" />
                    This is the <strong>#1 reason payments don't show in ObPay</strong>. Configure this once and all future payments sync automatically.
                  </p>
                </div>
              </div>
            </div>

            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Webhook Payload (ObPay → Your Server)</h3>
            <CodeBlock title="webhook-payload.json" code={`{
  "event": "payment.success",
  "data": {
    "reference": "INV-123456789",
    "transaction_id": "uuid",
    "status": "success",
    "gross_amount": 50000,
    "fee_amount": 2500,
    "net_amount": 47500,
    "currency": "UGX",
    "customer_phone": "+256777123456",
    "payment_method": "MTN",
    "completed_at": "2024-01-15 10:35:00"
  },
  "timestamp": "2024-01-15T10:35:00Z"
}`} />
            <h2 className="text-lg font-semibold text-foreground-900 mt-8 mb-3">What Happens When a Webhook Arrives</h2>
            <div className="space-y-3 mb-6">
              {[
                { step: "1", title: "Provider processes the payment", desc: "Customer enters PIN on their phone. The provider confirms the transaction and sends a webhook to ObPay's receiver." },
                { step: "2", title: "ObPay matches the transaction", desc: "The webhook receiver matches the incoming event to a pending transaction using provider_reference, merchant_reference, or phone+amount." },
                { step: "3", title: "Wallet is credited instantly", desc: "On success: transaction status updated, fee deducted, wallet balance increased. On failure: marked failed, payout wallet refunded." },
                { step: "4", title: "Your server is notified (if configured)", desc: "ObPay forwards the event to your webhook URL so you can update your order status, send confirmation emails, etc." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-background-100">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-emerald-700">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{item.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-refresh-line text-accent-600 text-lg shrink-0 mt-0.5" />
              <div className="text-sm text-foreground-700">
                <strong>Webhook didn't arrive?</strong> If the provider's webhook wasn't configured and a payment completed, the v3.8+ status API auto-checks the provider on your next poll. See the <a href="#polling" className="text-primary-600 hover:underline font-medium">Polling &amp; Sync section</a> for the polling + auto-sync pattern.
              </div>
            </div>

            <h3 className="font-semibold text-foreground-900 mb-2 mt-6">Signature Verification</h3>
            <p className="text-sm text-foreground-600 mb-3">Each webhook includes an <code className="font-mono text-xs bg-background-100 px-1.5 py-0.5 rounded">X-ObPay-Signature</code> header. Format: <code className="font-mono text-xs bg-background-100 px-1.5 py-0.5 rounded">t=TIMESTAMP,v=HASH</code></p>
            <CodeBlock title="verify.js" code={`const crypto = require('crypto');

function verifyWebhookSignature(payload, signatureHeader, webhookUrl, secret) {
  const [tPart, vPart] = signatureHeader.split(',');
  const timestamp = tPart.split('=')[1];
  const received = vPart.split('=')[1];

  const params = {
    status: payload.status,
    customer_reference: payload.customer_reference,
    internal_reference: payload.internal_reference
  };

  const sorted = Object.keys(params).sort();
  let str = webhookUrl + timestamp;
  sorted.forEach(k => str += k + params[k]);

  const expected = crypto
    .createHmac('sha256', secret)
    .update(str)
    .digest('hex');

  return received === expected;
}`} />
          </section>

          {/* ======================== POLLING ======================== */}
          <section
            id="polling"
            ref={(el) => { if (el) sectionRefs.current.set("polling", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-refresh-line" label="Polling, Sync &amp; Status Checking" subtitle="How external websites check transaction results — automatic sync via webhooks + real-time polling" />

            {/* Architecture overview */}
            <div className="bg-foreground-900 rounded-xl p-5 mb-6">
              <p className="text-xs font-bold text-foreground-400 uppercase tracking-wide mb-3">How ObPay Syncs with Payment Providers</p>
              <div className="flex flex-col sm:flex-row items-center gap-2 text-xs">
                <div className="bg-primary-900 border border-primary-700 rounded-lg px-3 py-2 text-primary-300 font-mono text-center">Your Website</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-accent-900 border border-accent-700 rounded-lg px-3 py-2 text-accent-300 font-mono text-center">ObPay API</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-foreground-800 rounded-lg px-3 py-2 text-foreground-300 font-mono text-center">Provider</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-foreground-800 rounded-lg px-3 py-2 text-foreground-300 font-mono text-center">MTN / Airtel</div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 text-xs mt-3">
                <div className="bg-foreground-800 rounded-lg px-3 py-2 text-foreground-300 font-mono text-center">Provider</div>
                <i className="ri-arrow-left-line text-foreground-400 hidden sm:block" />
                <div className="bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-300 font-mono text-center">Webhook Receiver</div>
                <i className="ri-arrow-left-line text-foreground-400 hidden sm:block" />
                <div className="bg-emerald-900 border border-emerald-700 rounded-lg px-3 py-2 text-emerald-300 font-mono text-center">ObPay Wallet</div>
              </div>
              <p className="text-[10px] text-foreground-500 mt-3 text-center">Two sync paths: (1) Webhooks push results in real-time — configure once, auto-syncs forever. (2) Status API pulls on-demand with v3.8+ auto-checking the provider for stale pending transactions.</p>
            </div>

            {/* Two approaches */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                    <i className="ri-webhook-line text-emerald-600 text-lg" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-sm text-foreground-900">Auto-Sync (Webhooks)</h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Real-time</span>
                  </div>
                </div>
                <p className="text-xs text-foreground-600 mb-3">The payment provider sends webhooks to ObPay automatically when payments complete. ObPay credits your wallet instantly. Nothing to code on your side.</p>
                <div className="bg-emerald-50 border border-emerald-200/60 rounded-lg p-2.5">
                  <p className="text-[10px] text-foreground-600"><strong>Requires:</strong> Paste the webhook URL into your provider dashboard once. See the <a href="#webhooks" className="text-primary-600 hover:underline font-medium">Webhooks section</a> for the URL.</p>
                </div>
              </div>
              <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <i className="ri-search-eye-line text-primary-600 text-lg" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-sm text-foreground-900">Status Polling (API)</h3>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded-full">On-demand</span>
                  </div>
                </div>
                <p className="text-xs text-foreground-600 mb-3">Your website calls ObPay's status API with a transaction reference. As of v3.8, pending transactions older than 30 seconds are auto-checked against the provider in real-time.</p>
                <div className="bg-primary-50 border border-primary-200/60 rounded-lg p-2.5">
                  <p className="text-[10px] text-foreground-600"><strong>Best for:</strong> External websites that need to confirm payment status before delivering goods or services.</p>
                </div>
              </div>
            </div>

            {/* How Status Polling Works — Step by Step */}
            <h2 className="text-lg font-semibold text-foreground-900 mb-3">How Status Polling Works (v3.8+)</h2>
            <p className="text-sm text-foreground-600 mb-4">When your website calls the ObPay status API, here's what happens behind the scenes:</p>
            <div className="space-y-3 mb-6">
              {[
                { step: "1", title: "Your website sends request", desc: "POST to ObPay API with _action: 'transaction-status' and your transaction reference. Authenticated with your Secret Key." },
                { step: "2", title: "ObPay looks up the transaction", desc: "Finds your transaction in the database and checks its current status." },
                { step: "3", title: "Auto-check provider if stale (NEW v3.8)", desc: "If the transaction is still 'pending' and older than 30 seconds, ObPay automatically calls the provider to check the real status. This means even without webhooks configured, your status checks return accurate results." },
                { step: "4", title: "Wallet auto-credited on success", desc: "If the provider confirms the payment went through, ObPay updates the transaction to 'success' and credits your wallet — all in one status check." },
                { step: "5", title: "Response returned to your site", desc: "You get the final status: success, failed, or still pending. The response includes an 'auto_synced' flag so you know if the provider was checked live." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-background-100">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary-700">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{item.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Status API Reference */}
            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Status Check API Reference</h2>
            <p className="text-sm text-foreground-600 mb-3">Use <code className="font-mono text-xs bg-background-100 px-1.5 py-0.5 rounded">_action: "transaction-status"</code> with your transaction reference. Requires your Secret Key for authentication.</p>
            <CodeBlock title="Request Format" code={`curl "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" \\
  -X POST \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -d '{
    "_action": "transaction-status",
    "reference": "INVOICE123"
  }'`} />
            <div className="bg-accent-50 border border-accent-200/60 rounded-lg px-3 py-2.5 mt-2 mb-4">
              <p className="text-xs text-foreground-700">
                <i className="ri-information-line text-accent-600 mr-1" />
                <strong>Note:</strong> Raw HTTP / curl calls return <strong>HTTP 401</strong> due to Supabase JWT verification. Use the Supabase client SDK below for working code.
              </p>
            </div>
            <CodeBlock title="Success Response (with auto-sync)" code={`{
  "success": true,
  "data": {
    "id": "uuid",
    "reference": "INVOICE123",
    "status": "success",
    "amount": 50000,
    "currency": "UGX",
    "fee_amount": 2500,
    "net_amount": 47500,
    "customer_phone": "+256777123456",
    "created_at": "2024-01-15T10:30:00Z",
    "completed_at": "2024-01-15T10:32:15Z",
    "auto_synced": true,
    "previous_status": "pending"
  }
}`} />
            <div className="bg-primary-50 border border-primary-200/60 rounded-lg px-3 py-2.5 mt-2 mb-6">
              <p className="text-xs text-foreground-700">
                <i className="ri-sparkling-line text-primary-600 mr-1" />
                <strong>New in v3.8:</strong> When <code className="font-mono text-[11px] bg-primary-100 px-1 rounded">auto_synced: true</code> appears, it means ObPay checked the provider live during your request and found the payment completed — your wallet was credited right then.
              </p>
            </div>

            {/* Complete Polling Code — JS */}
            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Complete Status Polling (JavaScript — Supabase SDK)</h2>
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-4">
              <i className="ri-information-line text-primary-600 mr-2" />
              <strong>Installation:</strong> <code className="font-mono text-xs bg-primary-100 px-1 py-0.5 rounded">npm install @supabase/supabase-js</code>
              <span className="block mt-2 text-xs text-foreground-500">
                <i className="ri-check-line text-primary-500 mr-1" />
                Uses Supabase client SDK — handles JWT automatically. Works 100%.
              </span>
            </div>
            <CodeBlock title="status-check.js — Check transaction status with auto-sync" code={`const { createClient } = require('@supabase/supabase-js');

const obpay = createClient(
  'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com',
  'sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt'
);

const OBPAY_KEY = process.env.OBPAY_SECRET_KEY || 'sk_live_YOUR_KEY';

// Check a single transaction — auto-syncs with provider if pending > 30s
async function checkStatus(reference) {
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: {
      _api_key: OBPAY_KEY,
      _action: 'transaction-status',
      reference
    }
  });

  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Status check failed');

  const txn = data.data;
  return {
    reference: txn.reference,
    status: txn.status,              // 'pending' | 'success' | 'failed'
    amount: txn.amount,
    fee: txn.fee_amount || 0,
    netAmount: txn.net_amount || txn.amount,
    wasAutoSynced: txn.auto_synced || false,  // true = provider checked live
    completedAt: txn.completed_at || null
  };
}`} />

            {/* Polling Loop */}
            <h2 className="text-lg font-semibold text-foreground-900 mt-8 mb-3">Complete Polling Loop — Wait for Payment Confirmation</h2>
            <p className="text-sm text-foreground-600 mb-4">
              This is the full pattern external websites use: initiate a payment, then poll until the result comes back. The v3.8 auto-sync means even if the provider's webhooks aren't configured, your poll will still get accurate results.
            </p>
            <CodeBlock title="full-payment-flow.js" code={`const { createClient } = require('@supabase/supabase-js');

const obpay = createClient(
  'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com',
  'sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt'
);

const OBPAY_KEY = process.env.OBPAY_SECRET_KEY;

// Step 1: Initiate collection
async function startPayment(phone, amount) {
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: {
      _api_key: OBPAY_KEY,
      _action: 'collect',
      phoneNumber: phone,
      amount: Number(amount),
      currency: 'UGX',
      reference: 'INV-' + Date.now().toString(36).toUpperCase(),
      description: 'Payment for order'
    }
  });
  if (error || !data.success) throw new Error(data.error || error.message);
  return data.data.reference;  // Save this reference
}

// Step 2: Poll until resolved
async function waitForPayment(reference, maxSeconds = 120) {
  const start = Date.now();
  const pollInterval = 4000;  // 4 seconds

  while (Date.now() - start < maxSeconds * 1000) {
    await new Promise(r => setTimeout(r, pollInterval));

    const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
      body: { _api_key: OBPAY_KEY, _action: 'transaction-status', reference }
    });

    if (error || !data?.success) continue;  // transient error, keep polling

    const txn = data.data;

    if (txn.status === 'success') {
      return {
        confirmed: true,
        reference: txn.reference,
        amount: txn.amount,
        fee: txn.fee_amount || 0,
        netAmount: txn.net_amount || txn.amount,
        autoSynced: txn.auto_synced || false
      };
    }

    if (txn.status === 'failed') {
      return { confirmed: false, error: 'Payment was declined or cancelled' };
    }

    // Still pending — continue polling (auto-sync runs on each check)
  }

  return { confirmed: false, error: 'Payment timed out' };
}

// Step 3: Full flow
async function processPayment(phone, amount) {
  console.log('Initiating payment...');
  const ref = await startPayment(phone, amount);
  console.log('Transaction reference:', ref);

  console.log('Waiting for customer to enter PIN...');
  const result = await waitForPayment(ref, 120);

  if (result.confirmed) {
    console.log('Payment confirmed!');
    console.log('Received:', result.netAmount, 'UGX (fee:', result.fee, 'UGX)');
    // Deliver goods, update order status, send confirmation email, etc.
    return { success: true, ...result };
  } else {
    console.log('Payment failed:', result.error);
    // Prompt customer to retry
    return { success: false, error: result.error };
  }
}`} />

            {/* Polling in Python */}
            <h2 className="text-lg font-semibold text-foreground-900 mt-8 mb-3">Status Polling (Python)</h2>
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-4">
              <i className="ri-information-line text-primary-600 mr-2" />
              <strong>Installation:</strong> <code className="font-mono text-xs bg-primary-100 px-1 py-0.5 rounded">pip install supabase</code>
            </div>
            <CodeBlock title="poll_status.py" code={`from supabase import create_client
import time

obpay = create_client(
    "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com",
    "sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt"
)

OBPAY_KEY = "sk_live_YOUR_KEY"

def check_status(reference: str):
    """Check transaction status — auto-syncs with provider for pending txns."""
    resp = obpay.functions.invoke("obpay-api-no-jwt", {
        "body": {
            "_api_key": OBPAY_KEY,
            "_action": "transaction-status",
            "reference": reference
        }
    })
    if not resp.get("success"):
        raise Exception(resp.get("error", "Status check failed"))
    return resp["data"]

def wait_for_payment(reference: str, max_seconds: int = 120):
    """Poll until payment succeeds or fails."""
    deadline = time.time() + max_seconds
    while time.time() < deadline:
        time.sleep(4)
        try:
            txn = check_status(reference)
            if txn["status"] == "success":
                return {"confirmed": True, **txn}
            if txn["status"] == "failed":
                return {"confirmed": False, "error": "Payment declined"}
        except Exception:
            continue  # transient error, keep polling
    return {"confirmed": False, "error": "Timeout"}`} />

            {/* Best Practices */}
            <h2 className="text-lg font-semibold text-foreground-900 mt-8 mb-3">Best Practices for Status Checking</h2>
            <div className="space-y-3 mb-6">
              {[
                { icon: "ri-timer-flash-line", title: "Poll every 4 seconds", desc: "Most mobile money payments confirm within 10-30 seconds. 4-second intervals balance speed with API load." },
                { icon: "ri-time-line", title: "Set reasonable timeouts", desc: "60-120 seconds for collections, up to 5 minutes for payouts. Mobile money is fast but not instant." },
                { icon: "ri-shield-check-line", title: "Handle all three outcomes", desc: "Success = deliver goods. Failed = prompt retry. Timeout = show pending message with manual refresh option." },
                { icon: "ri-error-warning-line", title: "Don't stop on transient errors", desc: "Network blips happen. Use try/catch inside the poll loop — only stop when you get a definitive status." },
                { icon: "ri-refresh-line", title: "Auto-sync is your safety net (v3.8+)", desc: "Even without webhooks configured, each status check auto-verifies with the provider for pending transactions older than 30 seconds." },
                { icon: "ri-webhook-line", title: "Webhooks + Polling = best combo", desc: "Configure webhooks for instant updates, use polling as fallback. Webhooks handle 95% of cases instantly; polling catches the rest." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-background-100">
                  <i className={`${item.icon} text-primary-600 text-lg shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{item.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Sync All Pending — Bulk operation */}
            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">Bulk Sync: Check All Pending Transactions at Once</h2>
            <p className="text-sm text-foreground-600 mb-3">
              Use <code className="font-mono text-xs bg-background-100 px-1.5 py-0.5 rounded">_action: "sync-all-pending"</code> to check the payment provider for all your pending transactions in one call. Useful for reconciliation or after webhook outages.
            </p>
            <CodeBlock title="Sync All Pending (JavaScript)" code={`const { data } = await obpay.functions.invoke('obpay-api-no-jwt', {
  body: { _api_key: OBPAY_KEY, _action: 'sync-all-pending' }
});
// Response: { synced: 10, updated: [{ id, reference, status }, ...], logs: [] }`} />
          </section>

          {/* ======================== ERRORS ======================== */}
          <section
            id="errors"
            ref={(el) => { if (el) sectionRefs.current.set("errors", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-error-warning-line" label="Error Codes" badge={{ text: "REFERENCE", color: "accent" }} />
            <div className="overflow-x-auto rounded-xl border border-background-200/70">
              <table className="w-full text-sm">
                <thead className="bg-background-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Error</th>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200/70">
                  {[
                    { code: "400", msg: "Missing required fields", desc: "A required parameter was not provided" },
                    { code: "400", msg: "Invalid amount", desc: "Amount is not a valid number" },
                    { code: "400", msg: "Reference already used", desc: "Reference ID is a duplicate" },
                    { code: "400", msg: "Reference must not contain spaces", desc: "Use hyphens or underscores instead" },
                    { code: "400", msg: "Reference must be at most 30 characters", desc: "Shorten your reference string" },
                    { code: "400", msg: "Network is required for non-UGX currencies", desc: "Add the network field for KES/GHS/XAF" },
                    { code: "400", msg: "Insufficient balance", desc: "Not enough funds in wallet" },
                    { code: "401", msg: "Authorization required", desc: "Missing API key header" },
                    { code: "401", msg: "Invalid API key", desc: "Key format or value is incorrect" },
                    { code: "403", msg: "Account number does not match API key owner", desc: "Account number mismatch" },
                    { code: "403", msg: "User account pending approval", desc: "KYC not yet approved" },
                    { code: "403", msg: "User account suspended", desc: "Account has been suspended" },
                    { code: "404", msg: "Transaction not found", desc: "No transaction with given reference" },
                    { code: "429", msg: "Too many requests", desc: "Rate limit exceeded" },
                    { code: "500", msg: "Internal server error", desc: "Server-side issue — retry with exponential backoff" },
                    { code: "504", msg: "Payment service timeout", desc: "Payment gateway timed out" },
                  ].map((e, i) => (
                    <tr key={i} className="hover:bg-background-50/50">
                      <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full font-mono ${e.code.startsWith("4") ? "bg-accent-100 text-accent-700" : "bg-foreground-100 text-foreground-700"}`}>{e.code}</span></td>
                      <td className="px-4 py-3"><code className="text-xs font-mono text-foreground-700">{e.msg}</code></td>
                      <td className="px-4 py-3 text-xs text-foreground-600">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ======================== SDK ======================== */}
          <section
            id="sdk"
            ref={(el) => { if (el) sectionRefs.current.set("sdk", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-code-s-slash-line" label="SDK Examples" subtitle="Full code examples for integrating ObPay's API into your application." />
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-5">
              <i className="ri-sparkling-line text-primary-600 mr-2" />
              <strong>New: Direct HTTP integration.</strong> ObPay now supports raw HTTP requests with <code className="font-mono text-xs bg-primary-100 px-1 rounded">X-API-Key: sk_live_YOUR_KEY</code> — no SDK, no Supabase, works on any hosting. See the <strong>Direct HTTP</strong> tab below for copy-paste examples that work everywhere.
            </div>
            <div className="flex gap-1 bg-background-100 rounded-xl p-1 mb-6 w-fit">
              {(["javascript", "php", "python", "direct-http"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setSdkLang(l)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer capitalize ${sdkLang === l ? "bg-background-50 text-foreground-900 border border-background-200/70" : "text-foreground-600 hover:text-foreground-900"}`}
                >
                  {l === "direct-http" ? "Direct HTTP" : l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>

            {sdkLang === "javascript" && (
              <>
                <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-4">
                  <i className="ri-information-line text-primary-600 mr-2" />
                  <strong>Installation:</strong> <code className="font-mono text-xs bg-primary-100 px-1 py-0.5 rounded">npm install @supabase/supabase-js</code>
                  <span className="block mt-2 text-xs text-foreground-500">
                    <i className="ri-check-line text-primary-500 mr-1" />
                    This uses the Supabase client SDK which handles JWT automatically — works 100%. Raw HTTP / axios calls return 401.
                  </span>
                </div>
                <h3 className="font-semibold text-foreground-900 mb-2">Complete ObPay Client (Node.js — Supabase SDK)</h3>
                <CodeBlock title="obpay.js" code={`const { createClient } = require('@supabase/supabase-js');

// Create Supabase client (URL + ObPay Public Key — both safe to commit)
const obpay = createClient(
  'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com',
  'sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt'
);

const OBPAY_SECRET_KEY = process.env.OBPAY_SECRET_KEY || 'sk_live_YOUR_KEY';

async function collect({ phone, amount, currency = 'UGX', reference, description = '' }) {
  const ref = reference || 'INV' + Date.now().toString(36).toUpperCase();
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: {
      _api_key: OBPAY_SECRET_KEY,
      _action: 'collect',
      phoneNumber: phone,
      amount: Number(amount),
      currency,
      reference: ref.slice(0, 30),
      description
    }
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Collection failed');
  return data.data;
}

async function payout({ phone, amount, currency = 'UGX', reference, description = '' }) {
  const ref = reference || 'PAY' + Date.now().toString(36).toUpperCase();
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: {
      _api_key: OBPAY_SECRET_KEY,
      _action: 'payout',
      phoneNumber: phone,
      amount: Number(amount),
      currency,
      reference: ref.slice(0, 30),
      description
    }
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Payout failed');
  return data.data;
}

async function getBalance() {
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: { _api_key: OBPAY_SECRET_KEY, _action: 'balance' }
  });
  if (error) throw new Error(error.message);
  return data.data;
}

async function getTransactionStatus(reference) {
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: { _api_key: OBPAY_SECRET_KEY, _action: 'transaction-status', reference }
  });
  if (error) throw new Error(error.message);
  return data.data;
}

async function waitForPayment(reference, maxWaitSeconds = 120) {
  const start = Date.now();
  while (Date.now() - start < maxWaitSeconds * 1000) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const txn = await getTransactionStatus(reference);
      if (txn.status === 'success') return { confirmed: true, ...txn };
      if (txn.status === 'failed') return { confirmed: false, error: 'Payment declined' };
    } catch (e) {}
  }
  return { confirmed: false, error: 'Timeout' };
}

module.exports = { collect, payout, getBalance, getTransactionStatus, waitForPayment };`} />
              </>
            )}

            {sdkLang === "php" && (
              <>
                <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-4">
                  <i className="ri-error-warning-line text-accent-600 mr-2" />
                  <strong>PHP — Raw cURL returns HTTP 401.</strong>
                  <span className="block mt-2 text-xs text-foreground-600">
                    The Supabase gateway requires JWT verification, which PHP's built-in cURL cannot provide. Options:
                  </span>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-foreground-600">
                    <li>Use a community Supabase PHP client like <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">supabase-php</code> (handles JWT automatically)</li>
                    <li>Run a lightweight Node.js microservice as a proxy: PHP → Node.js (with supabase-js) → ObPay</li>
                    <li>Use Python as your payment backend alongside your PHP app (see Python tab above)</li>
                  </ul>
                </div>
                <h3 className="font-semibold text-foreground-900 mb-2">Option 1: Community Supabase PHP Client</h3>
                <CodeBlock title="composer.json" code={`composer require supabase/supabase-php`} />
                <p className="text-xs text-foreground-600 mt-1 mb-4">
                  The community PHP client works similarly to the JS/Python SDKs — create a client with the Supabase URL and anon key, then call <code className="font-mono text-xs bg-background-100 px-1 rounded">invoke()</code>.
                </p>

                <h3 className="font-semibold text-foreground-900 mt-4 mb-2">Option 2: Node.js Proxy (Reliable)</h3>
                <CodeBlock title="proxy.js (Node.js microservice)" code={`// php-proxy.js — lightweight proxy your PHP app calls locally
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const obpay = createClient(
  'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com',
  'sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt'
);

const app = express();
app.use(express.json());

app.post('/proxy/collect', async (req, res) => {
  try {
    const { apiKey, phone, amount, currency, ref, desc } = req.body;
    const { data } = await obpay.functions.invoke('obpay-api-no-jwt', {
      body: { _api_key: apiKey, _action: 'collect', phoneNumber: phone, amount, currency, reference: ref, description: desc }
    });
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(3001, () => console.log('ObPay PHP proxy on :3001'));`} />
                <p className="text-xs text-foreground-600 mt-1">
                  Then from PHP: <code className="font-mono text-xs bg-background-100 px-1 rounded">file_get_contents('http://localhost:3001/proxy/collect', ...)</code>
                </p>
              </>
            )}

            {sdkLang === "python" && (
              <>
                <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-4">
                  <i className="ri-information-line text-primary-600 mr-2" />
                  <strong>Installation:</strong> <code className="font-mono text-xs bg-primary-100 px-1 py-0.5 rounded">pip install supabase</code>
                  <span className="block mt-2 text-xs text-foreground-500">
                    <i className="ri-check-line text-primary-500 mr-1" />
                    Uses the Supabase Python client — handles JWT automatically. Works 100%.
                  </span>
                </div>
                <h3 className="font-semibold text-foreground-900 mb-2">Complete ObPay Client (Python — Supabase SDK)</h3>
                <CodeBlock title="obpay.py" code={`from supabase import create_client, Client

# Create Supabase client (URL + anon key are public)
obpay: Client = create_client(
    "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com",
    "sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt"
)

OBPAY_SECRET_KEY = "sk_live_YOUR_KEY"

def collect_payment(phone: str, amount: int, currency: str = "UGX", ref: str = "", description: str = ""):
    resp = obpay.functions.invoke("obpay-api-no-jwt", {
        "body": {
            "_api_key": OBPAY_SECRET_KEY,
            "_action": "collect",
            "phoneNumber": phone,
            "amount": amount,
            "currency": currency,
            "reference": ref,
            "description": description,
        }
    })
    if not resp.get("success"):
        raise Exception(resp.get("error", "Collection failed"))
    return resp["data"]

def send_payout(phone: str, amount: int, currency: str = "UGX", ref: str = "", description: str = ""):
    resp = obpay.functions.invoke("obpay-api-no-jwt", {
        "body": {
            "_api_key": OBPAY_SECRET_KEY,
            "_action": "payout",
            "phoneNumber": phone,
            "amount": amount,
            "currency": currency,
            "reference": ref,
            "description": description,
        }
    })
    if not resp.get("success"):
        raise Exception(resp.get("error", "Payout failed"))
    return resp["data"]

def check_balance():
    resp = obpay.functions.invoke("obpay-api-no-jwt", {
        "body": {"_api_key": OBPAY_SECRET_KEY, "_action": "balance"}
    })
    return resp["data"]

def get_transaction_status(reference: str):
    resp = obpay.functions.invoke("obpay-api-no-jwt", {
        "body": {"_api_key": OBPAY_SECRET_KEY, "_action": "transaction-status", "reference": reference}
    })
    return resp["data"]`} />
              </>
            )}

            {sdkLang === "direct-http" && (
              <>
                <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 text-sm text-foreground-700 mb-5">
                  <i className="ri-check-line text-primary-600 mr-2" />
                  <strong>Works everywhere — no Supabase SDK required.</strong>
                  <span className="block mt-2 text-xs text-foreground-500">
                    Just include <code className="font-mono text-[11px] bg-primary-100 px-1 rounded">X-API-Key: sk_live_YOUR_KEY</code> in every request header. That&apos;s all you need. Works on Express, Fastify, Django, Laravel, Rails, Go, any hosting.
                  </span>
                </div>
                <h3 className="font-semibold text-foreground-900 mb-2">Direct HTTP — Node.js (no SDK)</h3>
                <CodeBlock title="obpay-direct.js" code={`// No @supabase/supabase-js needed!
const OBPAY_URL = 'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt';
const OBPAY_KEY = process.env.OBPAY_SECRET_KEY; // sk_live_YOUR_KEY

async function obpayRequest(body) {
  const resp = await fetch(OBPAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': OBPAY_KEY   // ← that's the only auth you need
    },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'ObPay request failed');
  return data.data;
}

// Collect money (STK push)
async function collect(phone, amount) {
  return obpayRequest({
    _action: 'collect',
    phoneNumber: phone,
    amount: Number(amount),
    currency: 'UGX',
    reference: 'INV' + Date.now().toString(36).toUpperCase(),
    description: 'Payment via ObPay'
  });
}

// Send money (payout)
async function payout(phone, amount) {
  return obpayRequest({
    _action: 'payout',
    phoneNumber: phone,
    amount: Number(amount),
    currency: 'UGX',
    reference: 'PAY' + Date.now().toString(36).toUpperCase(),
    description: 'Payout via ObPay'
  });
}

// Check transaction status (polls MarzPay if still pending)
async function status(reference) {
  return obpayRequest({ _action: 'transaction-status', reference });
}

// Check wallet balance
async function balance() {
  return obpayRequest({ _action: 'balance' });
}

// Poll until payment confirmed (or timeout)
async function waitForPayment(reference, maxSeconds = 120) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const txn = await status(reference);
      if (txn.status === 'success') return { confirmed: true, ...txn };
      if (txn.status === 'failed') return { confirmed: false, error: 'Payment declined' };
    } catch (e) {} // transient error — keep polling
  }
  return { confirmed: false, error: 'Timeout' };
}

module.exports = { collect, payout, status, balance, waitForPayment };`} />

                <h3 className="font-semibold text-foreground-900 mt-6 mb-2">Direct HTTP — PHP (raw cURL)</h3>
                <CodeBlock title="obpay.php" code={`<?php
// No Composer package needed! Pure PHP.

define('OBPAY_URL', 'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt');
define('OBPAY_KEY', getenv('OBPAY_SECRET_KEY')); // sk_live_YOUR_KEY

function obpay_request(array $body): array {
    $ch = curl_init(OBPAY_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'X-API-Key: ' . OBPAY_KEY,  // ← simple Bearer-style key header
        ],
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_TIMEOUT => 30,
    ]);
    $raw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) throw new Exception('cURL error: network failure');
    $data = json_decode($raw, true);
    if (!($data['success'] ?? false)) {
        throw new Exception($data['error'] ?? "ObPay HTTP $code");
    }
    return $data['data'];
}

function obpay_collect(string $phone, int $amount, string $currency = 'UGX'): array {
    $ref = 'INV' . strtoupper(base_convert(time(), 10, 36));
    return obpay_request([
        '_action' => 'collect',
        'phoneNumber' => $phone,
        'amount' => $amount,
        'currency' => $currency,
        'reference' => $ref,
        'description' => 'Payment via ObPay',
    ]);
}

function obpay_payout(string $phone, int $amount, string $currency = 'UGX'): array {
    $ref = 'PAY' . strtoupper(base_convert(time(), 10, 36));
    return obpay_request([
        '_action' => 'payout',
        'phoneNumber' => $phone,
        'amount' => $amount,
        'currency' => $currency,
        'reference' => $ref,
        'description' => 'Payout via ObPay',
    ]);
}

function obpay_status(string $reference): array {
    return obpay_request(['_action' => 'transaction-status', 'reference' => $reference]);
}

function obpay_balance(): array {
    return obpay_request(['_action' => 'balance']);
}

// Poll until resolved
function obpay_wait_for_payment(string $reference, int $maxSeconds = 120): array {
    $deadline = time() + $maxSeconds;
    while (time() < $deadline) {
        sleep(4);
        try {
            $txn = obpay_status($reference);
            if ($txn['status'] === 'success') return ['confirmed' => true] + $txn;
            if ($txn['status'] === 'failed') return ['confirmed' => false, 'error' => 'Payment declined'];
        } catch (Exception $e) {} // transient error — keep polling
    }
    return ['confirmed' => false, 'error' => 'Timeout'];
}`} />

                <h3 className="font-semibold text-foreground-900 mt-6 mb-2">Direct HTTP — Python (requests library)</h3>
                <CodeBlock title="obpay.py" code={`import os, requests, time

OBPAY_URL = 'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt'
OBPAY_KEY = os.environ['OBPAY_SECRET_KEY']  # sk_live_YOUR_KEY

def obpay_request(body: dict) -> dict:
    resp = requests.post(OBPAY_URL,
        json=body,
        headers={'X-API-Key': OBPAY_KEY},  # ← simple header auth
        timeout=30
    )
    data = resp.json()
    if not data.get('success'):
        raise Exception(data.get('error', f'ObPay HTTP {resp.status_code}'))
    return data['data']

def collect(phone: str, amount: int, currency: str = 'UGX') -> dict:
    import random, string
    ref = 'INV' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    return obpay_request({
        '_action': 'collect', 'phoneNumber': phone, 'amount': amount,
        'currency': currency, 'reference': ref, 'description': 'Payment via ObPay'
    })

def payout(phone: str, amount: int, currency: str = 'UGX') -> dict:
    import random, string
    ref = 'PAY' + ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    return obpay_request({
        '_action': 'payout', 'phoneNumber': phone, 'amount': amount,
        'currency': currency, 'reference': ref, 'description': 'Payout via ObPay'
    })

def get_status(reference: str) -> dict:
    return obpay_request({'_action': 'transaction-status', 'reference': reference})

def get_balance() -> dict:
    return obpay_request({'_action': 'balance'})

def wait_for_payment(reference: str, max_seconds: int = 120) -> dict:
    deadline = time.time() + max_seconds
    while time.time() < deadline:
        time.sleep(4)
        try:
            txn = get_status(reference)
            if txn['status'] == 'success': return {'confirmed': True, **txn}
            if txn['status'] == 'failed': return {'confirmed': False, 'error': 'Payment declined'}
        except Exception: pass  # transient error — keep polling
    return {'confirmed': False, 'error': 'Timeout'}`} />

                <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <i className="ri-shield-check-line text-accent-600 text-lg shrink-0 mt-0.5" />
                    <div className="text-sm text-foreground-700">
                      <strong>Where to store your Secret Key:</strong>
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-foreground-600">
                        <li>Node.js: <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">process.env.OBPAY_SECRET_KEY</code> via <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">.env</code></li>
                        <li>PHP: <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">$_ENV['OBPAY_SECRET_KEY']</code> via server environment or <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">.env</code> with vlucas/phpdotenv</li>
                        <li>Python: <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">os.environ['OBPAY_SECRET_KEY']</code> via .env with python-dotenv</li>
                        <li>Vercel/Netlify/Railway: Set <code className="font-mono text-[11px] bg-accent-100 px-1 rounded">OBPAY_SECRET_KEY</code> in environment variables dashboard</li>
                      </ul>
                      <p className="text-xs text-foreground-500 mt-2">Never commit your secret key to git. Never expose it in browser/client-side code.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          {/* ======================== OBPAY API ======================== */}
          <section
            id="obpay-api"
            ref={(el) => { if (el) sectionRefs.current.set("obpay-api", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-plug-line" label="ObPay API Reference" subtitle="Your gateway to mobile money — use ObPay's REST API to collect and send payments." />
            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-information-line text-accent-600 mt-0.5 shrink-0" />
              <div className="text-sm text-foreground-700">
                <strong>Important:</strong> You authenticate with your <strong>ObPay API key</strong> (Dashboard → API Keys), and ObPay routes requests to payment providers automatically. You never need provider credentials.
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Architecture</h2>
            <div className="bg-foreground-900 rounded-xl p-5 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-3 text-sm">
                <div className="bg-primary-900 border border-primary-700 rounded-lg px-4 py-2 text-primary-300 font-mono text-xs">Your Website</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-accent-900 border border-accent-700 rounded-lg px-4 py-2 text-accent-300 font-mono text-xs">ObPay API</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-foreground-800 rounded-lg px-4 py-2 text-foreground-300 font-mono text-xs">Payment Providers</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-foreground-800 rounded-lg px-4 py-2 text-foreground-300 font-mono text-xs">MTN / Airtel</div>
              </div>
              <p className="text-xs text-foreground-400 mt-3 text-center">Your API key never reaches the browser — all calls go through Supabase Edge Functions.</p>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Base URL</h2>
            <CodeBlock title="Base URL" code="https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt" />

            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">Authentication</h2>
            <p className="text-foreground-700 mb-4">All API requests require your <strong>ObPay Secret Key</strong>. Use either header:</p>
            <CodeBlock title="Using X-API-Key (Recommended for server-to-server)" code="X-API-Key: sk_live_xxxxxxxxxxxxxxxx" />
            <CodeBlock title="Using Bearer Token" code="Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx" />

            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">Platform Fee</h2>
            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 mb-4">
              <p className="text-sm text-foreground-700">
                ObPay deducts a platform fee from every successful collection before crediting your wallet. Default <strong>5%</strong>. For a 50,000 UGX collection, you receive <strong>47,500 UGX</strong> net.
              </p>
            </div>
          </section>

          {/* ======================== INTEGRATION ======================== */}
          <section
            id="integration"
            ref={(el) => { if (el) sectionRefs.current.set("integration", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-global-line" label="Website Integration" subtitle="Integrate ObPay payments into any website — from a simple button to a full checkout flow." />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {[
                { icon: "ri-link", title: "Payment Link", desc: "Share a link. No code needed.", color: "bg-emerald-100 text-emerald-600", href: "/dashboard/payment-links" },
                { icon: "ri-code-box-line", title: "Embed Button", desc: "Copy-paste HTML into your site.", color: "bg-primary-100 text-primary-600", href: "/dashboard/api-keys" },
                { icon: "ri-terminal-box-line", title: "API Integration", desc: "Full REST API for developers.", color: "bg-accent-100 text-accent-600", href: "/dashboard/api-sandbox" },
              ].map((opt) => (
                <a key={opt.title} href={opt.href} className="bg-background-50 rounded-xl p-4 border border-background-200/70 hover:border-primary-300/60 transition-all group cursor-pointer">
                  <div className={`w-8 h-8 rounded-lg ${opt.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <i className={`${opt.icon} text-sm`} />
                  </div>
                  <p className="text-sm font-semibold text-foreground-900 mb-0.5">{opt.title}</p>
                  <p className="text-xs text-foreground-500">{opt.desc}</p>
                </a>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Option 1: Payment Link (Simplest)</h2>
            <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 mb-4">
              <p className="text-xs font-medium text-foreground-600 mb-2">Your payment page URL:</p>
              <code className="text-sm font-mono text-primary-600 break-all">https://obpay.online/pay/YOUR_MERCHANT_SLUG</code>
              <p className="text-xs text-foreground-500 mt-2">Find your exact URL in <strong>Dashboard → API Keys</strong>.</p>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">Option 2: Embed a Payment Button</h2>
            <CodeBlock title="pay-button.html" code={`<a href="https://obpay.online/pay/YOUR_MERCHANT_SLUG"
   target="_blank"
   style="display:inline-flex;align-items:center;gap:8px;
          padding:12px 24px;background:#10B981;color:white;
          border-radius:8px;text-decoration:none;font-weight:600;
          font-family:system-ui,sans-serif;font-size:14px;">
  Pay with ObPay
</a>`} />

            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 mt-6">
              <div className="flex items-start gap-3">
                <i className="ri-shield-check-line text-accent-600 text-lg shrink-0 mt-0.5" />
                <div className="text-sm text-foreground-700">
                  <strong>Security Note:</strong> Always call the ObPay API from your <strong>backend server</strong>. Your secret key should never be exposed in client-side JavaScript.
                </div>
              </div>
            </div>
          </section>

          {/* ======================== HOW PAYMENTS WORK ======================== */}
          <section
            id="livepay-guide"
            ref={(el) => { if (el) sectionRefs.current.set("livepay-guide", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-guide-line" label="How ObPay + MarzPay Work Together" subtitle="Behind the scenes — how ObPay uses MarzPay to reach mobile money networks across East Africa." />
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-information-line text-primary-600 mt-0.5 shrink-0" />
              <div className="text-sm text-foreground-700">
                <strong>How it works:</strong> ObPay is powered by <a href="https://wallet.wearemarz.com" target="_blank" rel="noopener noreferrer" className="text-primary-600 font-medium underline">MarzPay</a> as the underlying payment provider. When you request a collection or payout, ObPay's Edge Functions securely forward the request to MarzPay's API, which then routes it to MTN Mobile Money, Airtel Money, and other networks across Uganda, Kenya, Ghana, and Cameroon.
              </div>
            </div>

            <div className="bg-background-50 border border-background-200/70 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-semibold text-foreground-900 mb-3">MarzPay API Charges (applied by MarzPay to the transaction)</h3>
              <div className="overflow-x-auto rounded-lg border border-background-200/70">
                <table className="w-full text-xs">
                  <thead className="bg-background-100"><tr>
                    <th className="text-left font-semibold text-foreground-600 uppercase px-3 py-2">Type</th>
                    <th className="text-left font-semibold text-foreground-600 uppercase px-3 py-2">Charge</th>
                    <th className="text-left font-semibold text-foreground-600 uppercase px-3 py-2">Applied By</th>
                  </tr></thead>
                  <tbody className="divide-y divide-background-200/70">
                    <tr><td className="px-3 py-2 text-foreground-700">Collection (receive money)</td><td className="px-3 py-2 font-medium text-foreground-900">Variable charge per transaction</td><td className="px-3 py-2 text-foreground-500">MarzPay (see wallet.wearemarz.com dashboard)</td></tr>
                    <tr><td className="px-3 py-2 text-foreground-700">Send Money (payout to others)</td><td className="px-3 py-2 font-medium text-foreground-900">Variable charge per transaction</td><td className="px-3 py-2 text-foreground-500">MarzPay (see wallet.wearemarz.com dashboard)</td></tr>
                    <tr className="bg-accent-50"><td className="px-3 py-2 text-accent-700 font-medium">ObPay Platform Fee (collections)</td><td className="px-3 py-2 font-medium text-accent-700">5% of collected amount</td><td className="px-3 py-2 text-foreground-500">ObPay (before crediting your wallet)</td></tr>
                    <tr className="bg-accent-50"><td className="px-3 py-2 text-accent-700 font-medium">ObPay Payout Fee</td><td className="px-3 py-2 font-medium text-accent-700">500–70K: 2,000 UGX flat / 70K+–5M: 3%</td><td className="px-3 py-2 text-foreground-500">ObPay (deducted from your wallet)</td></tr>
                    <tr className="bg-accent-50"><td className="px-3 py-2 text-accent-700 font-medium">ObPay Withdrawal Fee</td><td className="px-3 py-2 font-medium text-accent-700">Same tiered pricing as payouts</td><td className="px-3 py-2 text-foreground-500">ObPay (deducted from your wallet)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Payment Flow</h2>
            <div className="space-y-3 mb-6">
              {[
                { step: "1", title: "You Initiate a Collection", desc: "Your website sends a request to ObPay with the customer's phone number and amount." },
                { step: "2", title: "ObPay Routes the Payment", desc: "ObPay's Edge Function securely forwards your request to the mobile money aggregator." },
                { step: "3", title: "Customer Gets USSD Prompt", desc: "MTN or Airtel triggers a USSD prompt. Customer enters their PIN to approve." },
                { step: "4", title: "ObPay Receives Confirmation", desc: "The aggregator sends a webhook back to ObPay with the result." },
                { step: "5", title: "ObPay Updates Your Wallet", desc: "On success: fee is deducted and balance credited. On failure: marked failed." },
                { step: "6", title: "You Get Notified", desc: "If webhooks are configured, ObPay forwards the event to your server." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-background-50 border border-background-200/70">
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary-700">{item.step}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{item.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Important Notes</h2>
            <div className="space-y-3 mb-6">
              {[
                { icon: "ri-time-line", title: "Transactions are asynchronous", desc: "A collection returns 'pending'. Actual payment takes 30-90 seconds while customer enters PIN." },
                { icon: "ri-money-dollar-circle-line", title: "Platform fee is auto-deducted", desc: "ObPay deducts the platform fee before crediting your wallet. Default 5%." },
                { icon: "ri-shield-check-line", title: "Payouts require sufficient balance", desc: "Your available balance must cover the payout amount plus fees." },
                { icon: "ri-refresh-line", title: "Failed transactions are not charged", desc: "If a collection fails, no fee is charged and no money moves." },
              ].map((note) => (
                <div key={note.title} className="flex items-start gap-3 p-3 rounded-xl bg-background-100">
                  <i className={`${note.icon} text-primary-600 text-lg shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{note.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{note.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ======================== RATE LIMITING ======================== */}
          <section
            id="rate-limiting"
            ref={(el) => { if (el) sectionRefs.current.set("rate-limiting", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-speed-line" label="Rate Limiting" subtitle="Understand API rate limits and how to handle them gracefully." />
            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-information-line text-accent-600 mt-0.5 shrink-0" />
              <div className="text-sm text-foreground-700">
                Exceeding limits returns a <strong>429 Too Many Requests</strong> response.
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-background-200/70 mb-6">
              <table className="w-full text-sm">
                <thead className="bg-background-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Endpoint</th>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Method</th>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Limit</th>
                    <th className="text-left text-xs font-semibold text-foreground-600 uppercase tracking-wider px-4 py-3">Window</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200/70">
                  {[
                    { ep: "collect", method: "POST", limit: "50", window: "15 minutes" },
                    { ep: "payout", method: "POST", limit: "5", window: "1 minute" },
                    { ep: "balance", method: "POST", limit: "50", window: "15 minutes" },
                    { ep: "transaction-status", method: "POST", limit: "100", window: "15 minutes" },
                    { ep: "health", method: "GET", limit: "Unlimited", window: "—" },
                  ].map((r) => (
                    <tr key={r.ep} className="hover:bg-background-50/50">
                      <td className="px-4 py-3"><code className="text-xs font-mono text-primary-600">{r.ep}</code></td>
                      <td className="px-4 py-3"><span className="text-[10px] font-bold px-1.5 py-0.5 bg-primary-500 text-background-50 rounded font-mono">{r.method}</span></td>
                      <td className="px-4 py-3 text-foreground-800 font-medium">{r.limit}</td>
                      <td className="px-4 py-3 text-xs text-foreground-600">{r.window}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Best Practices</h2>
            <div className="space-y-3">
              {[
                { icon: "ri-timer-line", title: "Poll at reasonable intervals", desc: "For status checks, poll every 5-10 seconds, not every second." },
                { icon: "ri-database-2-line", title: "Cache balance results", desc: "Cache balance for 30-60 seconds instead of calling on every page render." },
                { icon: "ri-shield-check-line", title: "Handle 429 gracefully", desc: "Respect the Retry-After header. Use exponential backoff with jitter." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-xl bg-background-100">
                  <i className={`${item.icon} text-primary-600 text-lg shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground-900">{item.title}</p>
                    <p className="text-xs text-foreground-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ======================== SECURITY ======================== */}
          <section
            id="security"
            ref={(el) => { if (el) sectionRefs.current.set("security", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-shield-star-line" label="Security Best Practices" subtitle="Protect your API keys, validate webhooks, and secure your integration." />
            <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-error-warning-line text-accent-600 mt-0.5 shrink-0" />
              <div className="text-sm text-foreground-700">
                <strong>Critical:</strong> Your secret API key grants full access to your ObPay wallet. Treat it like a password. Never expose it in client-side code.
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">1. Never Expose Your Secret Key</h2>
            <div className="space-y-3 mb-6">
              <div className="bg-background-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground-900 mb-2">DO — Server-side only</p>
                <CodeBlock title="server.js (secure)" code={`// ✅ GOOD: API key stored in environment variable
const OBPAY_KEY = process.env.OBPAY_SECRET_KEY;
app.post('/api/pay', async (req, res) => {
  const result = await fetch(OBPAY_API, {
    headers: { 'X-API-Key': OBPAY_KEY },
    body: JSON.stringify({ _action: 'collect', ...req.body })
  });
});`} />
              </div>
              <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4">
                <p className="text-sm font-semibold text-foreground-900 mb-2">DON'T — Client-side exposure</p>
                <CodeBlock title="browser.js (insecure)" code={`// ❌ BAD: Secret key exposed in browser — anyone can steal it
const OBPAY_KEY = 'sk_live_abc123'; // Visible in browser DevTools`} />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">2. Validate Webhook Signatures</h2>
            <CodeBlock title="webhook-verify.js" code={`const crypto = require('crypto');

function verifyObPayWebhook(req) {
  const signature = req.headers['x-obpay-signature'];
  if (!signature) return false;
  const [tPart, vPart] = signature.split(',');
  const timestamp = tPart.split('=')[1];
  const receivedHash = vPart.split('=')[1];
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false; // Replay attack prevention
  const payload = JSON.stringify(req.body);
  const expectedHash = crypto.createHmac('sha256', process.env.OBPAY_WEBHOOK_SECRET)
    .update(timestamp + '.' + payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expectedHash));
}`} />

            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">Security Checklist</h2>
            <div className="space-y-3 mb-6">
              {[
                "Secret key stored in environment variables, never in code or git",
                "All API calls made from backend server, never from browser JavaScript",
                "Webhook signatures validated on every incoming event",
                "HTTPS enforced on your webhook endpoint",
                "API keys rotated every 90 days",
                "Unique references used for every transaction (idempotency)",
                "Webhook replay attacks prevented (timestamp check within 5 minutes)",
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-background-100">
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary-700">{i + 1}</span>
                  </div>
                  <p className="text-sm text-foreground-700">{item}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ======================== TESTING ======================== */}
          <section
            id="testing"
            ref={(el) => { if (el) sectionRefs.current.set("testing", el); }}
            className="py-16 border-b border-background-200/70"
          >
            <SectionHeader icon="ri-test-tube-line" label="Testing &amp; Go-Live Checklist" subtitle="Verify your integration before accepting real payments." />
            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Phase 1: Sandbox Testing</h2>
            <div className="space-y-3 mb-6">
              {[
                "Call the collect endpoint with test phone numbers and amounts",
                "Verify the response structure matches documentation",
                "Test error scenarios: missing fields, invalid amounts, wrong currency",
                "Test the transaction-status endpoint with a known reference",
                "Verify balance endpoint returns correct format",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background-100">
                  <i className="ri-checkbox-circle-line text-primary-500 text-lg" />
                  <span className="text-sm text-foreground-700">{item}</span>
                </div>
              ))}
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mt-6 mb-3">Phase 2: Go-Live Checklist</h2>
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-5 mb-6">
              <div className="space-y-3">
                {[
                  { label: "KYC Verified", desc: "Your merchant account is approved and active" },
                  { label: "API Keys Secured", desc: "Secret keys stored in environment variables" },
                  { label: "Webhook Configured", desc: "Webhook URL set up with signature verification" },
                  { label: "Error Handling", desc: "All API calls wrapped in try/catch" },
                  { label: "Rate Limiting Handled", desc: "Exponential backoff implemented for 429" },
                  { label: "Idempotency", desc: "Unique references prevent duplicate charges" },
                  { label: "HTTPS Enforced", desc: "All endpoints use HTTPS" },
                  { label: "Logging", desc: "Transaction logs stored for debugging" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 rounded border-background-300/60 text-primary-500 focus:ring-primary-400 cursor-pointer" />
                    <div>
                      <p className="text-sm font-semibold text-foreground-900">{item.label}</p>
                      <p className="text-xs text-foreground-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Link to="/dashboard/api-sandbox" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                <i className="ri-terminal-box-line" /> Open API Sandbox
              </Link>
              <a href="mailto:support@obpay.com" className="inline-flex items-center gap-2 bg-background-50 hover:bg-background-100 text-foreground-900 font-semibold px-4 py-2 rounded-lg text-sm border border-background-300/60 cursor-pointer whitespace-nowrap">
                <i className="ri-mail-line" /> Contact Support
              </a>
            </div>
          </section>

          {/* ======================== BUILD A PAYMENT WEBSITE ======================== */}
          <section
            id="complete-integration"
            ref={(el) => { if (el) sectionRefs.current.set("complete-integration", el); }}
            className="py-16"
          >
            <SectionHeader icon="ri-layout-masonry-line" label="Build a Payment Website with ObPay" subtitle="Complete production-ready integration — backend API module, frontend checkout, webhooks, and automatic payment flow." />
            <div className="bg-primary-50 border border-primary-200/60 rounded-xl p-4 flex items-start gap-3 mb-6">
              <i className="ri-information-line text-primary-600 mt-0.5 shrink-0" />
              <div className="text-sm text-foreground-700">
                <strong>What you'll build:</strong> A complete payment system. Customer enters phone &amp; amount → ObPay sends USSD prompt → Customer confirms on phone → Your website shows confirmation. All code is copy-paste ready.
              </div>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Architecture Overview</h2>
            <div className="bg-foreground-900 rounded-xl p-5 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-3 text-sm">
                <div className="bg-primary-900 border border-primary-700 rounded-lg px-4 py-2 text-primary-300 font-mono text-xs text-center">Customer's<br/>Browser</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-foreground-800 rounded-lg px-4 py-2 text-foreground-300 font-mono text-xs text-center">Your Backend<br/>Server</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-accent-900 border border-accent-700 rounded-lg px-4 py-2 text-accent-300 font-mono text-xs text-center">ObPay<br/>Edge Function</div>
                <i className="ri-arrow-right-line text-foreground-400 hidden sm:block" />
                <div className="bg-foreground-800 rounded-lg px-4 py-2 text-foreground-300 font-mono text-xs text-center">MTN / Airtel</div>
              </div>
              <p className="text-xs text-foreground-400 mt-3 text-center">Browser never touches ObPay directly — all API calls go through your backend.</p>
            </div>

            <h2 className="text-lg font-semibold text-foreground-900 mb-3">Step 1: Backend API Module (Node.js — Supabase SDK)</h2>
            <CodeBlock title="obpay-client.js" code={`const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const obpay = createClient(
  'https://k5nkqygnd0i42zb1n5c3.helloreaddy.com',
  'sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt'
);

const OBPAY_SECRET_KEY = process.env.OBPAY_SECRET_KEY || 'sk_live_YOUR_KEY';

async function collect({ phone, amount, currency = 'UGX', reference, description = '' }) {
  const ref = reference || 'INV' + Date.now().toString(36).toUpperCase();
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: { _api_key: OBPAY_SECRET_KEY, _action: 'collect', phoneNumber: phone, amount: Number(amount), currency, reference: ref.slice(0, 30), description }
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Collection failed');
  const result = data.data;
  return { reference: result.reference, transactionId: result.transaction_id, status: result.status, amount: result.amount, fee: result.collection_fee || 0, netAmount: result.net_amount_to_receive || result.amount };
}

async function payout({ phone, amount, currency = 'UGX', reference, description = '' }) {
  const ref = reference || 'PAY' + Date.now().toString(36).toUpperCase();
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: { _api_key: OBPAY_SECRET_KEY, _action: 'payout', phoneNumber: phone, amount: Number(amount), currency, reference: ref.slice(0, 30), description }
  });
  if (error) throw new Error(error.message);
  if (!data.success) throw new Error(data.error || 'Payout failed');
  const result = data.data;
  return { reference: result.reference, transactionId: result.transaction_id, status: result.status, amount: result.amount, fee: result.fee_amount || 0 };
}

async function getBalance() {
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: { _api_key: OBPAY_SECRET_KEY, _action: 'balance' }
  });
  if (error) throw new Error(error.message);
  const result = data.data;
  return { available: result.available_balance || 0, pending: result.pending_balance || 0, currency: result.currency || 'UGX' };
}

async function getTransactionStatus(reference) {
  if (!reference) throw new Error('reference is required');
  const { data, error } = await obpay.functions.invoke('obpay-api-no-jwt', {
    body: { _api_key: OBPAY_SECRET_KEY, _action: 'transaction-status', reference }
  });
  if (error) throw new Error(error.message);
  const result = data.data;
  return { reference: result.reference, status: result.status, amount: result.amount, fee: result.fee_amount || 0, netAmount: result.net_amount || result.amount };
}

async function waitForPayment(reference, maxWaitSeconds = 120) {
  const start = Date.now();
  while (Date.now() - start < maxWaitSeconds * 1000) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const txn = await getTransactionStatus(reference);
      if (txn.status === 'success') return { confirmed: true, reference: txn.reference, amount: txn.amount, fee: txn.fee, netAmount: txn.netAmount };
      if (txn.status === 'failed') return { confirmed: false, error: 'Payment declined' };
    } catch (e) {}
  }
  return { confirmed: false, error: 'Timeout' };
}

module.exports = { collect, payout, getBalance, getTransactionStatus, waitForPayment };`} />

            <h2 className="text-lg font-semibold text-foreground-900 mt-8 mb-3">Step 2: Express Server with API Routes</h2>
            <CodeBlock title="server.js" code={`const express = require('express');
const cors = require('cors');
const obpay = require('./obpay-client');
const app = express();
app.use(cors()); app.use(express.json());

app.post('/api/pay', async (req, res) => {
  try {
    const { phone, amount, currency, description } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount are required' });
    const payment = await obpay.collect({ phone, amount: Number(amount), currency: currency || 'UGX', description });
    res.json({ success: true, reference: payment.reference, status: 'pending', amount: payment.amount });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/pay/status/:reference', async (req, res) => {
  try { res.json({ success: true, ...(await obpay.getTransactionStatus(req.params.reference)) }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/balance', async (req, res) => {
  try { res.json({ success: true, ...(await obpay.getBalance()) }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/webhooks/obpay', (req, res) => {
  console.log('[Webhook]', req.body.event, req.body.data?.reference);
  res.status(200).json({ received: true });
});

app.listen(process.env.PORT || 3000, () => console.log('ObPay Server running on port', process.env.PORT || 3000));`} />

            <h2 className="text-lg font-semibold text-foreground-900 mt-8 mb-3">Complete Project Structure</h2>
            <div className="bg-foreground-900 rounded-xl p-4 mb-6">
              <pre className="text-xs text-primary-300 font-mono leading-relaxed">
{`your-payment-website/
├── obpay-client.js          # Payment module (Step 1)
├── server.js                # Express server (Step 2)
├── checkout.html            # Frontend checkout page
├── package.json             # npm init && npm install express cors @supabase/supabase-js
└── .env                     # OBPAY_SECRET_KEY=sk_live_YOUR_KEY
                            # OBPAY_PUBLIC_KEY=sb_publishable_dFKnLJZfWkXfRVr9l97rEm5s8RweReFt`}
              </pre>
            </div>

            <div className="mt-6 flex gap-3 flex-wrap">
              <Link to="/dashboard/api-keys" className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-4 py-2 rounded-lg text-sm cursor-pointer whitespace-nowrap">
                <i className="ri-key-2-line" /> Get Your API Key
              </Link>
              <Link to="/dashboard/api-sandbox" className="inline-flex items-center gap-2 bg-background-50 hover:bg-background-100 text-foreground-900 font-semibold px-4 py-2 rounded-lg text-sm border border-background-300/60 cursor-pointer whitespace-nowrap">
                <i className="ri-terminal-box-line" /> Test in Sandbox
              </Link>
              <Link to="/support" className="inline-flex items-center gap-2 bg-background-50 hover:bg-background-100 text-foreground-900 font-semibold px-4 py-2 rounded-lg text-sm border border-background-300/60 cursor-pointer whitespace-nowrap">
                <i className="ri-customer-service-2-line" /> Get Help
              </Link>
            </div>
          </section>

          {/* Final CTA */}
          <div className="mt-12 bg-primary-50 border border-primary-200/60 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground-900">Ready to test?</p>
              <p className="text-sm text-foreground-600 mt-0.5">Use the API Sandbox to make real test calls without moving money.</p>
            </div>
            <Link
              to="/dashboard/api-sandbox"
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-background-50 font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-terminal-box-line" />
              Open Sandbox
            </Link>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}