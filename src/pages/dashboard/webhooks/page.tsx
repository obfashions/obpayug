import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { invokeObpay } from "@/lib/edge-function";

interface WebhookConfig {
  id: string;
  name: string;
  webhook_url: string;
  webhook_secret: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string;
  failed_count: number;
}

interface WebhookLog {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  response_code: number;
  payload: any;
  created_at: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-UG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handleCopy} className="text-xs text-foreground-400 hover:text-foreground-200 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap">
      <i className={copied ? "ri-check-line" : "ri-file-copy-line"} />
      {copied ? "Copied!" : label}
    </button>
  );
}

const NODE_VERIFY_CODE = `const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}

app.post('/webhooks/obpay', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-obpay-signature'];
  const secret = process.env.OBPAY_WEBHOOK_SECRET;
  if (!verifyWebhookSignature(req.body, sig, secret)) return res.status(400).json({ error: 'Invalid signature' });
  const event = JSON.parse(req.body);
  if (event.event === 'payment.success') { /* Fulfill order */ console.log('Paid:', event.data.reference, 'Net:', event.data.net_amount); }
  if (event.event === 'payment.failed') { console.log('Failed:', event.data.reference); }
  if (event.event === 'payout.success') { console.log('Payout sent:', event.data.reference); }
  res.status(200).json({ received: true });
});`;

const PHP_VERIFY_CODE = `<?php
function verifyWebhookSignature($rawBody, $signatureHeader, $secret) {
    if (!$signatureHeader) return false;
    return hash_equals($signatureHeader, hash_hmac('sha256', $rawBody, $secret));
}
public function handleWebhook(Request $request) {
    $sig = $request->header('X-ObPay-Signature');
    if (!verifyWebhookSignature($request->getContent(), $sig, env('OBPAY_WEBHOOK_SECRET'))) {
        return response()->json(['error' => 'Invalid signature'], 400);
    }
    $event = $request->all();
    if ($event['event'] === 'payment.success') { /* Fulfill order */ }
    return response()->json(['received' => true], 200);
}
?>`;

const PYTHON_VERIFY_CODE = `import hmac, hashlib, json, os

def verify_webhook_signature(raw_body, signature_header, secret):
    if not signature_header: return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature_header, expected)

@csrf_exempt
def obpay_webhook(request):
    sig = request.headers.get('X-ObPay-Signature')
    if not verify_webhook_signature(request.body, sig, os.environ['OBPAY_WEBHOOK_SECRET']):
        return JsonResponse({'error': 'Invalid signature'}, status=400)
    event = json.loads(request.body)
    if event['event'] == 'payment.success': print(f"Payment: {event['data']['reference']}")
    return JsonResponse({'received': True}, status=200)`;

const PAYMENT_SUCCESS_PAYLOAD = `{
  "event": "payment.success",
  "data": {
    "reference": "INV-12345", "transaction_id": "txn-uuid",
    "status": "success", "gross_amount": 50000, "fee_amount": 2500,
    "net_amount": 47500, "currency": "UGX",
    "customer_phone": "+256777123456", "payment_method": "MTN",
    "description": "Order #12345", "provider_reference": "LP-89345",
    "completed_at": "2026-06-27T10:35:00Z"
  }, "timestamp": "2026-06-27T10:35:00Z"
}`;

const PAYMENT_FAILED_PAYLOAD = `{
  "event": "payment.failed",
  "data": {
    "reference": "INV-12345", "status": "failed",
    "gross_amount": 50000, "currency": "UGX",
    "customer_phone": "+256777123456", "payment_method": "MTN",
    "failure_reason": "Customer declined or insufficient balance",
    "completed_at": "2026-06-27T10:36:00Z"
  }, "timestamp": "2026-06-27T10:36:00Z"
}`;

const PAYOUT_SUCCESS_PAYLOAD = `{
  "event": "payout.success",
  "data": {
    "reference": "WITHDRAW-001", "status": "success",
    "amount": 100000, "currency": "UGX",
    "recipient_phone": "+256777123456", "payment_method": "MTN",
    "description": "Salary payment", "provider_reference": "LP-89350",
    "completed_at": "2026-06-27T11:00:00Z"
  }, "timestamp": "2026-06-27T11:00:00Z"
}`;

export default function WebhooksPage() {
  const { user, profile } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Multi-webhook form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Testing
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; statusCode?: number; results?: any[] } | null>(null);

  // Guides
  const [showSecret, setShowSecret] = useState(false);
  const [showVerifyCode, setShowVerifyCode] = useState<"node" | "php" | "python" | null>(null);
  const [showPayloads, setShowPayloads] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [cfgRes, logRes] = await Promise.all([
        supabase.from("webhook_configs").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("webhook_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      ]);
      if (cfgRes.error) throw cfgRes.error;
      setWebhooks((cfgRes.data as WebhookConfig[]) || []);
      setLogs((logRes.data as WebhookLog[]) || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddWebhook = async () => {
    if (!user || !newName.trim() || !newUrl.trim()) return;

    // Basic URL validation
    const url = newUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("Webhook URL must start with http:// or https://");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // Generate a random webhook secret
      const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const { data, error: insertErr } = await supabase
        .from("webhook_configs")
        .insert({
          user_id: user.id,
          name: newName.trim(),
          webhook_url: url,
          webhook_secret: secret,
          events: ["payment.success", "payment.failed", "payout.success", "payout.failed"],
          is_active: true,
          failed_count: 0,
        })
        .select("id")
        .single();

      if (insertErr) {
        throw new Error(insertErr.message || "Failed to save webhook. Please try again.");
      }

      if (!data?.id) {
        throw new Error("Webhook was not created. Please try again.");
      }

      setNewName("");
      setNewUrl("");
      setShowAddForm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Something went wrong adding the webhook.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    setError("");
    try {
      const { error: updateErr } = await supabase
        .from("webhook_configs")
        .update({ is_active: !current })
        .eq("id", id);
      if (updateErr) throw new Error(updateErr.message);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to update webhook status.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove webhook "${name}"? This cannot be undone.`)) return;
    setError("");
    try {
      const { error: deleteErr } = await supabase
        .from("webhook_configs")
        .delete()
        .eq("id", id);
      if (deleteErr) throw new Error(deleteErr.message);
      fetchData();
    } catch (err: any) {
      setError(err?.message || "Failed to remove webhook.");
    }
  };

  const handleTestWebhook = async () => {
    if (!user) return;
    setTestingWebhook(true); setTestResult(null);
    try {
      const data = await invokeObpay({ _action: "test-webhook" });
      if (data?.success) {
        setTestResult({
          ok: data?.data?.all_ok ?? false,
          message: data?.data?.message || "Test completed",
          results: data?.data?.results || [],
        });
      } else {
        setTestResult({ ok: false, message: data?.error || data?.data?.message || "Test webhook failed", results: data?.data?.results || [] });
      }
    } catch (err: any) { setTestResult({ ok: false, message: err?.message || "Failed to send test webhook" }); }
    finally { setTestingWebhook(false); }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center py-24"><i className="ri-loader-4-line animate-spin text-3xl text-accent-500" /></div></DashboardLayout>;
  }

  if (error) {
    return <DashboardLayout><div className="text-center py-24"><p className="text-sm mb-4">{error}</p><button onClick={fetchData} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Webhooks</h1>
          <p className="text-sm text-foreground-600 mt-1">Configure how ObPay notifies your servers about payment events in real time. Connect multiple websites.</p>
        </div>

        {/* Architecture */}
        <div className="bg-foreground-900 rounded-xl p-5">
          <p className="text-xs text-foreground-400 uppercase tracking-wider font-medium mb-3">How Webhooks Work</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs">
            {[
              { icon: "ri-smartphone-line", label: "Customer pays", color: "bg-secondary-800 text-secondary-300" },
              { arrow: true }, { icon: "ri-bank-line", label: "MTN / Airtel confirms", color: "bg-foreground-800 text-foreground-300" },
              { arrow: true }, { icon: "ri-server-line", label: "ObPay receives event", color: "bg-accent-900 text-accent-300" },
              { arrow: true }, { icon: "ri-globe-line", label: "ObPay POSTs to your servers", color: "bg-primary-900 text-primary-300" },
            ].map((item, i) =>
              item.arrow ? <i key={i} className="ri-arrow-right-line text-foreground-500 hidden sm:block" /> :
              <div key={i} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono ${item.color}`}><i className={item.icon} />{item.label}</div>
            )}
          </div>
          <p className="text-[11px] text-foreground-400 text-center mt-3">Webhooks deliver events automatically — your servers stay in sync without polling</p>
        </div>

        {/* Step 1: Multi-Webhook Management */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center"><i className="ri-webhook-line text-primary-600 text-lg" /></div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-900">Step 1 — Connect Your Websites</h3>
                <p className="text-xs text-foreground-600 mt-0.5">Add webhook endpoints for each website or application that needs payment notifications</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1.5 bg-primary-500 hover:bg-primary-600 text-background-50 font-medium px-3 py-2 rounded-lg text-xs cursor-pointer whitespace-nowrap transition-colors"
            >
              <i className={showAddForm ? "ri-close-line" : "ri-add-line"} />
              {showAddForm ? "Cancel" : "Add Website"}
            </button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-background-100 rounded-lg p-4 mb-4 border border-primary-200/50">
              <p className="text-xs font-semibold text-foreground-700 mb-3">Add New Website Webhook</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-medium text-foreground-600 mb-1">Website / App Name *</label>
                  <input
                    type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., My E-Commerce Store"
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-foreground-600 mb-1">Webhook Endpoint URL *</label>
                  <input
                    type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://yourwebsite.com/webhooks/obpay"
                    className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>
              <p className="text-[11px] text-foreground-500 mb-3">
                <i className="ri-information-line mr-1" />
                Create a POST endpoint on your server, then paste the URL here. ObPay will deliver payment events to all active webhooks.
              </p>
              <button
                onClick={handleAddWebhook} disabled={saving || !newName.trim() || !newUrl.trim()}
                className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-background-50 font-medium px-4 py-2 rounded-lg text-xs cursor-pointer whitespace-nowrap transition-colors"
              >
                {saving ? (<><i className="ri-loader-4-line animate-spin" /> Adding...</>) : (<><i className="ri-check-line" /> Add Webhook</>)}
              </button>
              {saved && <span className="ml-3 text-xs text-emerald-600 font-medium"><i className="ri-check-line mr-1" />Added!</span>}
            </div>
          )}

          {/* Webhook List */}
          {webhooks.length === 0 && !showAddForm ? (
            <div className="text-center py-8 bg-background-100 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-background-200/70 flex items-center justify-center mx-auto mb-3">
                <i className="ri-webhook-line text-foreground-400 text-xl" />
              </div>
              <p className="text-sm text-foreground-500">No websites connected yet</p>
              <p className="text-xs text-foreground-400 mt-1">Click "Add Website" above to connect your first website or application.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className={`bg-background-100 rounded-lg p-4 border ${wh.is_active ? "border-background-200/70" : "border-background-200/40 opacity-60"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${wh.is_active ? "bg-primary-100" : "bg-background-200"}`}>
                        <i className={`ri-globe-line ${wh.is_active ? "text-primary-600" : "text-foreground-400"} text-base`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground-900">{wh.name || "Untitled"}</p>
                          <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-full ${wh.is_active ? "bg-emerald-100 text-emerald-700" : "bg-background-200 text-foreground-500"}`}>
                            {wh.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <code className="text-[11px] text-foreground-600 font-mono break-all block mt-0.5">{wh.webhook_url}</code>
                        {wh.last_delivery_at && (
                          <p className="text-[10px] text-foreground-400 mt-1">Last delivery: {formatDate(wh.last_delivery_at)}{wh.failed_count > 0 ? ` • ${wh.failed_count} failures` : ""}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleActive(wh.id, wh.is_active)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer ${wh.is_active ? "hover:bg-accent-100 text-foreground-500 hover:text-accent-600" : "hover:bg-emerald-50 text-foreground-400 hover:text-emerald-600"}`}
                        title={wh.is_active ? "Disable" : "Enable"}
                      >
                        <i className={wh.is_active ? "ri-pause-circle-line" : "ri-play-circle-line"} />
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id, wh.name || "Untitled")}
                        className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-foreground-500 hover:text-red-600 transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <i className="ri-delete-bin-line text-xs" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Test Webhook */}
          {webhooks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-background-200/70">
              <button
                onClick={handleTestWebhook} disabled={testingWebhook}
                className="inline-flex items-center gap-2 border border-background-300/60 hover:bg-background-100 text-foreground-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
              >
                {testingWebhook ? (<><i className="ri-loader-4-line animate-spin" /> Testing...</>) : (<><i className="ri-send-plane-line" /> Send Test Webhook to All Endpoints</>)}
              </button>
              {testResult && (
                <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${testResult.ok ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>
                  <div className="flex items-start gap-2">
                    <i className={`${testResult.ok ? "ri-checkbox-circle-line text-emerald-500" : "ri-error-warning-line text-accent-500"} mt-0.5`} />
                    <div className="flex-1">
                      <p className="font-medium">{testResult.message}</p>
                      {testResult.results && testResult.results.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {testResult.results.map((r: any, i: number) => (
                            <div key={i} className={`flex items-center gap-2 text-xs px-2.5 py-1.5 rounded ${r.ok ? "bg-emerald-200/50 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                              <i className={r.ok ? "ri-check-line" : "ri-close-line"} />
                              <span className="font-mono truncate flex-1">{r.webhook_url}</span>
                              <span className="font-medium">HTTP {r.status_code || "—"}</span>
                              {r.error && <span className="text-[10px] opacity-75">{r.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Webhook Secret */}
        {webhooks.length > 0 && (
          <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center"><i className="ri-key-2-line text-secondary-600 text-lg" /></div>
              <div><h3 className="font-heading font-semibold text-sm text-foreground-900">Webhook Signing Secret</h3><p className="text-xs text-foreground-600 mt-0.5">Verify webhook requests came from ObPay using HMAC-SHA256</p></div>
            </div>
            <div className="bg-foreground-900 rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-foreground-400 font-medium">Webhook Secret (<code className="font-mono text-[10px]">X-ObPay-Signature</code>)</span>
                <button onClick={() => setShowSecret(!showSecret)} className="text-xs text-primary-400 hover:text-primary-300 cursor-pointer whitespace-nowrap">{showSecret ? "Hide" : "Reveal"}</button>
              </div>
              <code className="block text-xs font-mono break-all select-all text-primary-300 bg-foreground-800 px-3 py-2 rounded-lg">
                {showSecret ? (webhooks[0]?.webhook_secret || "Auto-generated when you add a webhook") : "••••••••••••••••••••••••••••••••"}
              </code>
            </div>
            <p className="text-[11px] text-foreground-500">
              <i className="ri-shield-check-line mr-1 text-primary-500" />
              Store as <code className="font-mono text-[10px] bg-background-100 px-1 rounded">OBPAY_WEBHOOK_SECRET</code> on your server. Every webhook includes <code className="font-mono text-[10px] bg-background-100 px-1 rounded">X-ObPay-Signature</code>.
            </p>
          </div>
        )}

        {/* Step 4: Handler Code */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0"><i className="ri-book-open-line text-primary-600 text-lg" /></div>
            <div><h3 className="font-heading font-semibold text-sm text-foreground-900">Step 2 — Build Your Webhook Handler</h3><p className="text-xs text-foreground-500 mt-0.5">Handle webhooks on your server with signature verification</p></div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-foreground-700 mb-2">Headers ObPay Sends</p>
            <div className="overflow-x-auto rounded-xl border border-background-200/70">
              <table className="w-full text-sm">
                <thead className="bg-background-100">
                  <tr>
                    <th className="text-left text-[11px] font-semibold text-foreground-600 uppercase px-3 py-2">Header</th>
                    <th className="text-left text-[11px] font-semibold text-foreground-600 uppercase px-3 py-2">Description</th>
                    <th className="text-left text-[11px] font-semibold text-foreground-600 uppercase px-3 py-2">Use</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-background-200/70">
                  <tr><td className="px-3 py-2"><code className="text-xs font-mono text-primary-600">Content-Type</code></td><td className="px-3 py-2 text-xs text-foreground-700">application/json</td><td className="px-3 py-2 text-xs text-foreground-500">Parse as JSON</td></tr>
                  <tr><td className="px-3 py-2"><code className="text-xs font-mono text-primary-600">X-ObPay-Signature</code></td><td className="px-3 py-2 text-xs text-foreground-700">HMAC-SHA256 hex digest</td><td className="px-3 py-2 text-xs text-foreground-500">Verify authenticity</td></tr>
                  <tr><td className="px-3 py-2"><code className="text-xs font-mono text-primary-600">X-ObPay-Event</code></td><td className="px-3 py-2 text-xs text-foreground-700">payment.success, payment.failed, payout.success</td><td className="px-3 py-2 text-xs text-foreground-500">Event routing</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-foreground-700 mb-2">Handler Code</p>
            <div className="flex gap-1 bg-background-100 rounded-xl p-1 w-fit mb-4">
              {(["node", "php", "python"] as const).map((lang) => (
                <button key={lang} onClick={() => setShowVerifyCode(showVerifyCode === lang ? null : lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${showVerifyCode === lang ? "bg-background-50 text-foreground-900 border border-background-200/70" : "text-foreground-600 hover:text-foreground-900"}`}>
                  {lang === "node" ? "Node.js" : lang === "php" ? "PHP" : "Python"}
                </button>
              ))}
            </div>
            {showVerifyCode && (
              <div className="bg-foreground-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-foreground-800 border-b border-foreground-700">
                  <span className="text-xs text-foreground-400 font-mono">webhook_handler.{showVerifyCode === "node" ? "js" : showVerifyCode === "php" ? "php" : "py"}</span>
                  <CopyButton text={showVerifyCode === "node" ? NODE_VERIFY_CODE : showVerifyCode === "php" ? PHP_VERIFY_CODE : PYTHON_VERIFY_CODE} label="Copy" />
                </div>
                <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {showVerifyCode === "node" ? NODE_VERIFY_CODE : showVerifyCode === "php" ? PHP_VERIFY_CODE : PYTHON_VERIFY_CODE}
                </pre>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground-700 mb-2">Event Types</p>
            <div className="space-y-2">
              {[
                { event: "payment.success", label: "Collection Successful", desc: "Customer paid. Fulfill order, send receipt, mark invoice as paid.", color: "bg-emerald-500" },
                { event: "payment.failed", label: "Collection Failed", desc: "Declined or timed out. Notify customer to retry.", color: "bg-accent-500" },
                { event: "payout.success", label: "Payout Delivered", desc: "Funds reached recipient. Update records and deduct from ledger.", color: "bg-primary-500" },
                { event: "payout.failed", label: "Payout Failed", desc: "Didn't reach recipient. Log and retry.", color: "bg-accent-500" },
              ].map((e) => (
                <div key={e.event} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-background-100">
                  <div className={`w-2 h-2 rounded-full ${e.color} shrink-0 mt-1.5`} />
                  <div className="flex-1"><div className="flex flex-wrap items-center gap-2"><code className="text-xs font-mono text-foreground-800">{e.event}</code><span className="text-[10px] font-medium text-foreground-500">{e.label}</span></div><p className="text-[11px] text-foreground-500 mt-0.5">{e.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Payload Examples */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center"><i className="ri-file-list-3-line text-secondary-600 text-lg" /></div>
              <div><h3 className="font-heading font-semibold text-sm text-foreground-900">Payload Examples</h3><p className="text-xs text-foreground-500 mt-0.5">Exact JSON ObPay sends to your servers</p></div>
            </div>
            <button onClick={() => setShowPayloads(!showPayloads)} className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer whitespace-nowrap">
              <i className={showPayloads ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />{showPayloads ? "Hide" : "Show examples"}
            </button>
          </div>
          {showPayloads && (
            <div className="space-y-4">
              {[
                { title: "payment.success", code: PAYMENT_SUCCESS_PAYLOAD, color: "text-emerald-700", dot: "bg-emerald-500" },
                { title: "payment.failed", code: PAYMENT_FAILED_PAYLOAD, color: "text-accent-700", dot: "bg-accent-500" },
                { title: "payout.success", code: PAYOUT_SUCCESS_PAYLOAD, color: "text-primary-700", dot: "bg-primary-500" },
              ].map((p) => (
                <div key={p.title}>
                  <p className={`text-xs font-semibold mb-1.5 flex items-center gap-1.5 ${p.color}`}><span className={`w-2 h-2 rounded-full ${p.dot}`} />{p.title}</p>
                  <div className="bg-foreground-900 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-foreground-800 border-b border-foreground-700"><span className="text-xs text-foreground-400 font-mono">{p.title}.json</span><CopyButton text={p.code} label="Copy" /></div>
                    <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">{p.code}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Best Practices */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center"><i className="ri-repeat-line text-secondary-600 text-lg" /></div><h3 className="font-heading font-semibold text-sm text-foreground-900">Best Practices</h3></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: "ri-time-line", title: "Return 200 within 10s", desc: "Respond immediately, then process asynchronously in a queue." },
              { icon: "ri-refresh-line", title: "Automatic retries", desc: "Non-200 or timeout → retry immediately, 30s later, then 2 min. Stops after 3 failures." },
              { icon: "ri-fingerprint-line", title: "Idempotency", desc: "Use reference or transaction_id to skip duplicates." },
              { icon: "ri-shield-check-line", title: "Always verify signature", desc: "Verify X-ObPay-Signature before acting on any webhook." },
              { icon: "ri-error-warning-line", title: "Log all events", desc: "Store every webhook for audit trail and debugging." },
              { icon: "ri-checkbox-circle-line", title: "Return 200 on your errors", desc: "If your processing fails, still return 200. Retry internally." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 bg-background-100 rounded-lg p-3">
                <i className={`${item.icon} text-primary-600 text-lg shrink-0 mt-0.5`} />
                <div><p className="text-xs font-semibold text-foreground-800">{item.title}</p><p className="text-[11px] text-foreground-500 mt-0.5">{item.desc}</p></div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Logs */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="p-5 border-b border-background-200/70"><h3 className="font-heading font-semibold text-sm text-foreground-900">Delivery Logs</h3></div>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-background-100 flex items-center justify-center mx-auto mb-3"><i className="ri-inbox-line text-foreground-400 text-xl" /></div>
              <p className="text-sm text-foreground-500">No webhook deliveries yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-background-200/70">
                  <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Event</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Status</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Code</th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Attempts</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Date</th>
                </tr></thead>
                <tbody>
                  {logs.slice(0, 15).map((log) => (
                    <tr key={log.id} className="border-b border-background-100 hover:bg-background-100/50">
                      <td className="px-4 py-2.5"><span className="text-xs font-mono text-foreground-900">{log.event_type}</span></td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-full ${log.status === "delivered" ? "bg-emerald-100 text-emerald-700" : log.status === "received" ? "bg-primary-100 text-primary-700" : "bg-accent-100 text-accent-700"}`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center"><span className="text-xs text-foreground-600">{log.response_code || "—"}</span></td>
                      <td className="px-4 py-2.5 text-center"><span className="text-xs text-foreground-600">{log.attempts || 1}</span></td>
                      <td className="px-4 py-2.5 text-right"><span className="text-xs text-foreground-500">{formatDate(log.created_at)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}