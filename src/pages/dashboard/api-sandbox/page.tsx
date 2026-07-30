import { useState, useCallback, useEffect } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  getLivePayConnectionStatus,
  type LivePayConnectionStatus,
} from "@/services/obpay";
import { invokeObpay } from "@/lib/edge-function";

type TestEndpoint = "collect" | "payout" | "balance" | "status";

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  response: Record<string, unknown> | null;
  error?: string;
  duration: number;
  timestamp: string;
}

const endpointConfig = {
  collect: {
    label: "Collect Money",
    method: "POST" as const,
    path: "/obpay-api/collect",
    description: "Request mobile money collection from a customer via the payment provider",
    icon: "ri-download-cloud-line",
    color: "primary",
    fields: [
      { key: "phoneNumber", label: "Customer Phone Number", type: "text", placeholder: "0777123456", required: true },
      { key: "amount", label: "Amount (UGX)", type: "number", placeholder: "500", required: true },
      { key: "currency", label: "Currency", type: "select", options: ["UGX", "KES", "GHS", "XAF"], required: true },
      { key: "reference", label: "Reference", type: "text", placeholder: "INVOICE123", required: true },
      { key: "description", label: "Description", type: "text", placeholder: "Test collection", required: true },
      { key: "network", label: "Network (for non-UGX)", type: "select", options: ["", "MTN", "AIRTEL", "SAFARICOM", "AIRTELTIGO", "VODAFONE", "ORANGE"], required: false },
    ],
  },
  payout: {
    label: "Send Money (Payout)",
    method: "POST" as const,
    path: "/obpay-api/payout",
    description: "Send money to a mobile money wallet via the payment provider",
    icon: "ri-upload-cloud-line",
    color: "accent",
    fields: [
      { key: "phoneNumber", label: "Recipient Phone Number", type: "text", placeholder: "0777123456", required: true },
      { key: "amount", label: "Amount (UGX)", type: "number", placeholder: "1000", required: true },
      { key: "currency", label: "Currency", type: "select", options: ["UGX", "KES", "GHS", "XAF"], required: true },
      { key: "reference", label: "Reference", type: "text", placeholder: "PAYOUT123", required: true },
      { key: "description", label: "Description", type: "text", placeholder: "Test payout", required: true },
      { key: "network", label: "Network (for non-UGX)", type: "select", options: ["", "MTN", "AIRTEL", "SAFARICOM", "AIRTELTIGO", "VODAFONE", "ORANGE"], required: false },
    ],
  },
  balance: {
    label: "Check Balance",
    method: "GET" as const,
    path: "/obpay-api/balance",
    description: "Retrieve your ObPay wallet balance",
    icon: "ri-wallet-3-line",
    color: "secondary",
    fields: [
      { key: "currency", label: "Currency", type: "select", options: ["UGX", "KES", "GHS", "XAF"], required: true },
    ],
  },
  status: {
    label: "Transaction Status",
    method: "GET" as const,
    path: "/obpay-api/transaction/{ref}",
    description: "Check the status of any transaction by reference",
    icon: "ri-search-eye-line",
    color: "primary",
    fields: [
      { key: "currency", label: "Currency", type: "select", options: ["UGX", "KES", "GHS", "XAF"], required: true },
      { key: "reference", label: "Reference", type: "text", placeholder: "COL_123456789", required: true },
    ],
  },
};

const OBPAY_API_BASE = "https://k5nkqygnd0i42zb1n5c3.helloreaddy.com/functions/v1/obpay-api-no-jwt";

const defaultFormData: Record<string, string> = {
  currency: "UGX",
  amount: "500",
  reference: "TEST" + Date.now().toString().slice(-8),
  description: "Sandbox test",
  phoneNumber: "0777123456",
};

export default function ApiSandboxPage() {
  const { user } = useAuth();
  const [activeEndpoint, setActiveEndpoint] = useState<TestEndpoint>("collect");
  const [formData, setFormData] = useState<Record<string, string>>(defaultFormData);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [useRealApi, setUseRealApi] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<LivePayConnectionStatus | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string>("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  // Load connection status and API key on mount
  useEffect(() => {
    getLivePayConnectionStatus().then((s) => {
      setConnectionStatus(s);
      setStatusLoaded(true);
    });

    // Fetch user's secret API key — filter by current user
    if (user?.id) {
      supabase.from("api_keys")
        .select("secret_key")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
        .then(({ data }) => {
          if (data?.secret_key) {
            setUserApiKey(data.secret_key);
          } else {
            // Auto-generate one if missing
            autoGenerateApiKey();
          }
          setApiKeyLoaded(true);
        });
    } else {
      setApiKeyLoaded(true);
    }
  }, [user]);

  const autoGenerateApiKey = async () => {
    if (!user?.id) return;
    const pk = "pk_live_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const sk = "sk_live_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const ws = "whsec_" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const { data, error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      public_key: pk,
      secret_key: sk,
      webhook_secret: ws,
      environment: "live",
      status: "active",
    }).select("secret_key").maybeSingle();
    if (data?.secret_key) {
      setUserApiKey(data.secret_key);
    }
  };

  const config = endpointConfig[activeEndpoint];

  const generateNewReference = useCallback(() => {
    return "TEST" + Date.now().toString().slice(-8);
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    const start = Date.now();

    if (!useRealApi) {
      // Mock mode — explicitly chosen by user
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      const duration = Date.now() - start;
      const mockResponses: Record<TestEndpoint, Record<string, unknown>> = {
        collect: {
          success: true,
          data: {
            transaction_id: Math.floor(100000 + Math.random() * 900000),
            reference: formData.reference || generateNewReference(),
            status: "success",
            gross_amount: Number(formData.amount) || 500,
            fee_amount: Math.round((Number(formData.amount) || 500) * 0.05),
            net_amount: Math.round((Number(formData.amount) || 500) * 0.95),
            currency: formData.currency || "UGX",
            provider_reference: "LP_MOCK_" + Date.now(),
          },
        },
        payout: {
          success: true,
          data: {
            payout_id: Math.floor(200000 + Math.random() * 900000),
            reference: formData.reference || generateNewReference(),
            status: "completed",
            amount: Number(formData.amount) || 1000,
            currency: formData.currency || "UGX",
            provider_reference: "LP_MOCK_" + Date.now(),
          },
        },
        balance: {
          success: true,
          data: {
            available_balance: 1500000,
            pending_balance: 0,
            total_collections: 5250000,
            total_payouts: 3750000,
            currency: formData.currency || "UGX",
          },
        },
        status: {
          success: true,
          data: {
            id: 100001,
            reference: formData.reference || "INVOICE123",
            status: "success",
            type: "collection",
            amount: 50000,
            currency: "UGX",
            fee_amount: 2500,
            net_amount: 47500,
            created_at: "2026-06-26T10:30:00Z",
            completed_at: "2026-06-26T10:32:15Z",
          },
        },
      };

      setResults((prev) => [{
        endpoint: config.path,
        method: config.method,
        status: 200,
        success: true,
        response: mockResponses[activeEndpoint],
        duration,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev.slice(0, 9)]);
    } else {
      // Real API mode — route through obpay-api edge function with X-API-Key header
      try {
        let body: Record<string, unknown> = {};

        if (activeEndpoint === "collect") {
          body = {
            _action: "collect",
            phoneNumber: formData.phoneNumber || "",
            amount: parseFloat(formData.amount || "0"),
            currency: formData.currency || "UGX",
            reference: formData.reference || generateNewReference(),
            description: formData.description || "",
            network: formData.network || undefined,
          };
        } else if (activeEndpoint === "payout") {
          body = {
            _action: "payout",
            phoneNumber: formData.phoneNumber || "",
            amount: parseFloat(formData.amount || "0"),
            currency: formData.currency || "UGX",
            reference: formData.reference || generateNewReference(),
            description: formData.description || "",
            network: formData.network || undefined,
          };
        } else if (activeEndpoint === "balance") {
          body = { _action: "balance" };
        } else if (activeEndpoint === "status") {
          body = { _action: "transaction-status", reference: formData.reference || "" };
        }

        // Belt AND suspenders: send API key as BOTH header AND _api_key in body
        if (userApiKey) {
          body._api_key = userApiKey;
        }

        const data = await invokeObpay(body, userApiKey ? { "X-API-Key": userApiKey } : undefined);

        const duration = Date.now() - start;

        // Some edge function actions wrap provider errors inside data.data
        // (e.g. test-connection returns { success:true, data:{ status:"error", error:"Invalid API key" } })
        // Check for nested provider errors so the sandbox shows red, not green
        const nestedError = data?.data?.error || null;
        const nestedFailed = data?.data?.status === "error" || data?.data?.status === "disconnected" || data?.data?.status === "partial";
        const isActuallyFailed = !data?.success || nestedFailed;
        const displayError = data?.error || (nestedFailed ? nestedError : null) || null;

        setResults((prev) => [{
          endpoint: config.path,
          method: config.method,
          status: isActuallyFailed ? (data?.httpStatus || 400) : 200,
          success: !isActuallyFailed,
          response: (data?.data || data) as Record<string, unknown> | null,
          error: displayError,
          duration,
          timestamp: new Date().toLocaleTimeString(),
        }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        const duration = Date.now() - start;
        setResults((prev) => [{
          endpoint: config.path,
          method: config.method,
          status: 0,
          success: false,
          response: null,
          error: err?.message || "Request failed",
          duration,
          timestamp: new Date().toLocaleTimeString(),
        }, ...prev.slice(0, 9)]);
      }
    }

    setIsRunning(false);
    setFormData((prev) => ({
      ...prev,
      reference: generateNewReference(),
    }));
  };

  const getColorClasses = (color: string) => ({
    bg: color === "primary" ? "bg-primary-100" : color === "accent" ? "bg-accent-100" : "bg-secondary-100",
    text: color === "primary" ? "text-primary-600" : color === "accent" ? "text-accent-600" : "text-secondary-600",
    badge: color === "primary" ? "bg-primary-100 text-primary-700" : color === "accent" ? "bg-accent-100 text-accent-700" : "bg-secondary-100 text-secondary-700",
    active: color === "primary" ? "border-primary-500 bg-primary-50" : color === "accent" ? "border-accent-500 bg-accent-50" : "border-secondary-500 bg-secondary-50",
  });

  const isProviderConnected = connectionStatus?.connected ?? false;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-heading font-bold text-xl text-foreground-900">API Sandbox</h2>
          <p className="text-sm text-foreground-600 mt-0.5">
            {useRealApi && isProviderConnected
              ? "Testing with REAL provider API via ObPay Edge Function. Money will actually move — use small amounts."
              : "Simulated responses via Mock mode — no real money is moved."}
          </p>
        </div>

        {/* Mode Toggle + Status */}
        <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-foreground-100 flex items-center justify-center shrink-0">
              <i className="ri-key-2-line text-foreground-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-foreground-700 mb-1">API Mode</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseRealApi(false)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    !useRealApi ? "bg-secondary-500 text-background-50" : "bg-background-200 text-foreground-600 hover:bg-background-300"
                  }`}
                >
                  Mock
                </button>
                <button
                  onClick={() => setUseRealApi(true)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    useRealApi ? "bg-primary-500 text-background-50" : "bg-background-200 text-foreground-600 hover:bg-background-300"
                  }`}
                >
                  Live API
                </button>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            {isProviderConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                Provider Connected — {connectionStatus?.accountNumber}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                {statusLoaded ? "Provider not connected — go to Payment Provider page" : "Checking connection..."}
              </span>
            )}
          </div>
        </div>

        {/* Real API Warning */}
        {useRealApi && isProviderConnected && (activeEndpoint === "collect" || activeEndpoint === "payout") && (
          <div className="bg-accent-50 border border-accent-200/60 rounded-xl p-4 flex items-start gap-3">
            <i className="ri-error-warning-line text-accent-600 text-lg shrink-0 mt-0.5" />
            <div className="text-sm text-foreground-700">
              <strong className="text-accent-700">Real Money Warning:</strong> Collect and Payout will initiate actual mobile money transactions through the payment provider.
              Use small test amounts (e.g., 500 UGX) and a phone number you control.
            </div>
          </div>
        )}

        {/* Architecture Note */}
        <div className="bg-secondary-50 border border-secondary-200/60 rounded-xl p-4 flex items-start gap-3">
          <i className="ri-information-line text-secondary-600 text-lg shrink-0 mt-0.5" />
          <div className="text-sm text-foreground-700">
            <strong>How it works:</strong> All requests go through the Supabase Edge Function. The Supabase client automatically attaches your session JWT (gateway requirement), and your Secret Key (passed as <code className="font-mono bg-secondary-100 px-1 py-0.5 rounded text-xs">X-API-Key</code> header) authenticates the specific API action. No CORS issues, no exposed credentials.
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Endpoint Selector + Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(endpointConfig) as TestEndpoint[]).map((ep) => {
                const c = endpointConfig[ep];
                const colors = getColorClasses(c.color);
                const isActive = activeEndpoint === ep;
                return (
                  <button
                    key={ep}
                    onClick={() => setActiveEndpoint(ep)}
                    className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                      isActive ? colors.active : "border-background-200 hover:border-background-300 bg-background-50"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${isActive ? colors.bg : "bg-background-100"}`}>
                      <i className={`${c.icon} text-sm ${isActive ? colors.text : "text-foreground-500"}`} />
                    </div>
                    <p className="text-xs font-semibold text-foreground-900 leading-tight">{c.label}</p>
                    <span className={`text-[10px] font-mono font-medium mt-0.5 px-1.5 py-0.5 rounded ${
                      c.method === "POST" ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"
                    }`}>{c.method}</span>
                  </button>
                );
              })}
            </div>

            {/* Form */}
            <div className="bg-background-50 rounded-xl p-4 border border-background-200/70 space-y-3">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${getColorClasses(config.color).bg}`}>
                  <i className={`${config.icon} text-sm ${getColorClasses(config.color).text}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground-900">{config.label}</p>
                  <p className="text-xs text-foreground-500">{config.description}</p>
                </div>
              </div>

              <div className="bg-foreground-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  config.method === "POST" ? "bg-primary-500 text-background-50" : "bg-secondary-500 text-background-50"
                }`}>{config.method}</span>
                <code className="text-xs text-foreground-700 font-mono">{OBPAY_API_BASE}</code>
              </div>

              {config.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-foreground-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-accent-500 ml-0.5">*</span>}
                  </label>
                  {field.type === "select" ? (
                    <select
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-800 focus:outline-none focus:border-primary-400"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>{opt || "— (optional)"}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key] || ""}
                      onChange={(e) => setFormData((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-100 text-sm text-foreground-800 focus:outline-none focus:border-primary-400"
                    />
                  )}
                </div>
              ))}

              <button
                onClick={handleRun}
                disabled={isRunning}
                className="w-full inline-flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-60 text-background-50 font-semibold py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Sending request...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line" />
                    {useRealApi && isProviderConnected ? "Run Live Request" : "Run Mock Request"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right: Response */}
          <div className="lg:col-span-3 space-y-4">
            {results.length === 0 ? (
              <div className="bg-background-50 rounded-xl border border-background-200/70 h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 rounded-xl bg-background-100 flex items-center justify-center mb-4">
                  <i className="ri-terminal-box-line text-2xl text-foreground-400" />
                </div>
                <p className="text-base font-medium text-foreground-700 mb-1">No requests yet</p>
                <p className="text-sm text-foreground-500">
                  Fill in the form and click "Run Request" to see the response from ObPay's API gateway.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result, idx) => (
                  <div key={idx} className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-background-100 border-b border-background-200/70">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          result.method === "POST" ? "bg-primary-500 text-background-50" : "bg-secondary-500 text-background-50"
                        }`}>{result.method}</span>
                        <code className="text-xs text-foreground-700 font-mono">{result.endpoint}</code>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          result.success ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"
                        }`}>
                          {result.status > 0 ? `${result.status} ${result.success ? "OK" : "Error"}` : "Failed"}
                        </span>
                        <span className="text-xs text-foreground-500">{result.duration}ms</span>
                        <span className="text-xs text-foreground-400">{result.timestamp}</span>
                      </div>
                    </div>
                    <div className="bg-foreground-900 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2 bg-foreground-800 border-b border-foreground-700">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 bg-red-500 rounded-full" />
                          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
                          <div className="w-2.5 h-2.5 bg-primary-500 rounded-full" />
                        </div>
                        <span className="text-xs text-foreground-400 font-mono">{result.success ? "response.json" : "error.json"}</span>
                      </div>
                      <pre className="text-xs text-primary-300 font-mono p-4 overflow-x-auto leading-relaxed max-h-72">
                        {JSON.stringify(result.success ? result.response : { error: result.error }, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Request History */}
        {results.length > 0 && (
          <div className="bg-background-50 rounded-xl border border-background-200/70">
            <div className="px-4 py-3 border-b border-background-200/70 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground-900">Request History</p>
              <button
                onClick={() => setResults([])}
                className="text-xs text-foreground-500 hover:text-accent-600 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>
            <div className="divide-y divide-background-200/60">
              {results.map((r, idx) => (
                <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.success ? "bg-primary-500" : "bg-accent-500"}`} />
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    r.method === "POST" ? "bg-primary-100 text-primary-700" : "bg-secondary-100 text-secondary-700"
                  }`}>{r.method}</span>
                  <code className="text-xs text-foreground-700 font-mono flex-1">{r.endpoint}</code>
                  <span className="text-xs text-foreground-400 shrink-0">{r.duration}ms</span>
                  <span className="text-xs text-foreground-400 shrink-0">{r.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}