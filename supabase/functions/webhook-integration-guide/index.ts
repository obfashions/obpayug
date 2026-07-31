import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/feature/DashboardLayout";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

interface WebhookConfig {
  id: string;
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

export default function WebhooksPage() {
  const { user, profile } = useAuth();
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [marzWebhookUrl, setMarzWebhookUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; statusCode?: number } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showPayloads, setShowPayloads] = useState(false);
  const [showVerifyCode, setShowVerifyCode] = useState(false);

  const isVerified = profile?.status === "active";

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [cfgRes, logRes, settingsRes] = await Promise.all([
        supabase.from("webhook_configs").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("webhook_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
        supabase.from("platform_settings").select("webhook_url").limit(1).maybeSingle(),
      ]);
      if (cfgRes.error) throw cfgRes.error;
      setConfig(cfgRes.data as WebhookConfig | null);
      if (cfgRes.data) setUrlInput(cfgRes.data.webhook_url || "");
      setLogs((logRes.data as WebhookLog[]) || []);

      const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL || "";
      const baseUrl = supabaseUrl.replace(/\/$/, "");
      const defaultWebhookUrl = `${baseUrl}/functions/v1/obpay-webhook-receiver`;
      const configuredUrl = settingsRes.data?.webhook_url || "";
      setMarzWebhookUrl(configuredUrl || defaultWebhookUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!user || !config) return;
    setSaving(true);
    try {
      await supabase.from("webhook_configs").update({ webhook_url: urlInput, is_active: urlInput.trim().length > 0, failed_count: 0 }).eq("id", config.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!config) return;
    await supabase.from("webhook_configs").update({ is_active: !config.is_active }).eq("id", config.id);
    fetchData();
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(marzWebhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    if (!user) return;
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const { data } = await supabase.functions.invoke("obpay-api", {
        body: { _action: "test-webhook" },
      });
      setTestResult({
        ok: data?.success ?? false,
        message: data?.message || "Unknown result",
        statusCode: data?.data?.status_code,
      });
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err?.message || "Failed to send test webhook",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <i className="ri-loader-4-line animate-spin text-3xl text-accent-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <p className="text-sm mb-4">{error}</p>
          <button onClick={fetchData} className="bg-accent-500 text-background-50 px-4 py-2 rounded-lg text-sm cursor-pointer">Retry</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground-900">Webhooks</h1>
          <p className="text-sm text-foreground-600 mt-1">Configure how ObPay notifies your server about payment events in real time</p>
        </div>

        {/* MarzPay Webhook URL Card */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
              <i className="ri-link-m text-accent-600 text-lg" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground-900 text-sm">MarzPay Webhook URL</h3>
              <p className="text-xs text-foreground-600 mt-0.5">Paste this URL into your MarzPay dashboard so they can send us payment updates</p>
            </div>
          </div>

          <div className="bg-foreground-900 rounded-lg p-4 mb-3">
            <p className="text-[11px] text-foreground-400 mb-2 font-medium">Copy this URL and paste it into MarzPay Settings → Webhooks:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-primary-300 font-mono bg-foreground-800 px-3 py-2 rounded-lg break-all select-all">
                {marzWebhookUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                className="shrink-0 w-10 h-10 rounded-lg bg-foreground-700 hover:bg-foreground-600 flex items-center justify-center text-foreground-300 transition-colors cursor-pointer"
              >
                <i className={copied ? "ri-check-line text-primary-500" : "ri-file-copy-line"} />
              </button>
            </div>
          </div>

          <div className="bg-accent-50 rounded-lg p-4 border border-accent-200/50">
            <h4 className="text-xs font-semibold text-accent-800 mb-2">How to configure in MarzPay:</h4>
            <ol className="text-xs text-accent-700 space-y-1.5 list-decimal list-inside">
              <li>Log in to your <strong>MarzPay dashboard</strong></li>
              <li>Go to <strong>Settings → Webhooks</strong></li>
              <li>Paste the URL above into the <strong>Webhook URL</strong> field</li>
              <li>Set the webhook events to: <strong>Payment Received</strong> and <strong>Payout / Withdrawal</strong></li>
              <li>Save — MarzPay will now instantly notify ObPay when payments succeed or fail</li>
            </ol>
          </div>
        </div>

        {/* Your Server Webhook */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3">Your Server Webhook</h3>
          <p className="text-xs text-foreground-600 mb-4">ObPay will POST event notifications to this URL when payments are confirmed or payouts complete on your account.</p>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-foreground-600 mb-1">Webhook URL</label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://yourserver.com/webhooks/obpay"
                className="w-full px-3 py-2 rounded-lg border border-background-300/60 bg-background-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-accent-500 hover:bg-accent-600 disabled:bg-accent-300 text-background-50 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
              >
                {saving ? "Saving..." : saved ? "Saved!" : "Save Webhook"}
              </button>
              {config?.webhook_url && (
                <button
                  onClick={handleTestWebhook}
                  disabled={testingWebhook}
                  className="border border-background-300/60 hover:bg-background-100 text-foreground-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap transition-colors"
                >
                  {testingWebhook ? "Testing..." : "Test Webhook"}
                </button>
              )}
            </div>
          </div>

          {config && (
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${config.is_active ? "bg-emerald-500" : "bg-background-300"}`} />
                <span className="text-xs text-foreground-600">{config.is_active ? "Active" : "Inactive"}</span>
              </div>
              <button onClick={handleToggleActive} className="text-xs font-medium cursor-pointer whitespace-nowrap text-primary-600 hover:text-primary-700">
                {config.is_active ? "Disable" : "Enable"}
              </button>
              {config.last_delivery_at && <span className="text-xs text-foreground-500">Last: {formatDate(config.last_delivery_at)}</span>}
              {config.failed_count > 0 && <span className="text-xs text-accent-600">Failed: {config.failed_count}x</span>}
            </div>
          )}

          {testResult && (
            <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${testResult.ok ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>
              <div className="flex items-start gap-2">
                <i className={`${testResult.ok ? "ri-checkbox-circle-line text-emerald-500" : "ri-error-warning-line text-accent-500"} mt-0.5`} />
                <div className="flex-1">
                  <p>{testResult.message}</p>
                  {testResult.statusCode && <p className="text-xs mt-1 opacity-75">HTTP {testResult.statusCode}</p>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Webhook Secret Key */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
              <i className="ri-key-2-line text-accent-600 text-lg" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground-900 text-sm">Webhook Secret Key</h3>
              <p className="text-xs text-foreground-600 mt-0.5">Used to sign outgoing webhooks so your server can verify they came from ObPay</p>
            </div>
          </div>

          <div className="max-w-lg">
            <div className="bg-foreground-900 rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-foreground-400 font-medium">Secret Key</span>
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="text-xs text-primary-400 hover:text-primary-300 cursor-pointer whitespace-nowrap"
                >
                  {showSecret ? "Hide" : "Show"}
                </button>
              </div>
              <code className="block text-xs font-mono break-all select-all text-primary-300 bg-foreground-800 px-3 py-2 rounded-lg">
                {showSecret ? (config?.webhook_secret || "(not set)") : (config?.webhook_secret ? "••••••••••••••••••••••••••••••••" : "(not set)")}
              </code>
            </div>

            {config?.webhook_secret && (
              <div className="mt-3 p-3 rounded-lg bg-accent-50 border border-accent-200/50">
                <p className="text-[11px] text-accent-700">
                  <i className="ri-lightbulb-line mr-1" />
                  Share this secret with your backend team. ObPay signs every webhook with HMAC-SHA256 using this key. Your server should validate the <code className="bg-accent-100 px-1 rounded text-[10px]">X-ObPay-Signature</code> header against the raw body.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Webhook Integration Guide */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
              <i className="ri-book-open-line text-primary-600 text-lg" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-foreground-900">How to Receive Webhooks on Your Website</h3>
              <p className="text-xs text-foreground-500 mt-0.5">Step-by-step guide to integrate ObPay webhooks into your backend</p>
            </div>
          </div>

          {/* Step 1 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary-500 text-background-50 text-xs font-bold flex items-center justify-center">1</div>
              <p className="text-sm font-semibold text-foreground-900">Create a Webhook Endpoint on Your Server</p>
            </div>
            <p className="text-xs text-foreground-600 mb-2 ml-8">
              Create a POST endpoint on your website that can receive JSON payloads. Examples:
            </p>
            <div className="ml-8 grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
              <div className="bg-background-100 rounded-lg p-2.5">
                <p className="text-[11px] font-medium text-foreground-500 mb-0.5">Node.js / Express</p>
                <code className="text-xs font-mono text-primary-600 break-all">app.post('/webhooks/obpay', ...)</code>
              </div>
              <div className="bg-background-100 rounded-lg p-2.5">
                <p className="text-[11px] font-medium text-foreground-500 mb-0.5">PHP / Laravel</p>
                <code className="text-xs font-mono text-primary-600 break-all">Route::post('/webhooks/obpay', ...)</code>
              </div>
              <div className="bg-background-100 rounded-lg p-2.5">
                <p className="text-[11px] font-medium text-foreground-500 mb-0.5">Python / Django</p>
                <code className="text-xs font-mono text-primary-600 break-all">@csrf_exempt def obpay_webhook(request)</code>
              </div>
            </div>
            <p className="text-xs text-foreground-500 ml-8">
              <i className="ri-error-warning-line mr-1" />
              Your endpoint must return HTTP <strong>200 OK</strong> within 10 seconds. Otherwise ObPay will retry the delivery.
            </p>
          </div>

          {/* Step 2 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary-500 text-background-50 text-xs font-bold flex items-center justify-center">2</div>
              <p className="text-sm font-semibold text-foreground-900">Paste Your Webhook URL into ObPay</p>
            </div>
            <p className="text-xs text-foreground-600 ml-8">
              Enter your endpoint URL (e.g., <code className="font-mono text-xs bg-background-100 px-1 rounded">https://yourwebsite.com/webhooks/obpay</code>) in the <strong>Your Server Webhook</strong> section above, then click <strong>Save Webhook</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary-500 text-background-50 text-xs font-bold flex items-center justify-center">3</div>
              <p className="text-sm font-semibold text-foreground-900">Verify the Webhook Signature (Security)</p>
            </div>
            <p className="text-xs text-foreground-600 mb-2 ml-8">
              Every webhook from ObPay includes an <code className="font-mono text-xs bg-background-100 px-1 rounded">X-ObPay-Signature</code> header. Verify it using your Webhook Secret to ensure the request genuinely came from ObPay.
            </p>

            <div className="ml-8 mb-2">
              <button
                onClick={() => setShowVerifyCode(!showVerifyCode)}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer mb-2"
              >
                <i className={showVerifyCode ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
                {showVerifyCode ? "Hide verification code examples" : "Show verification code examples (Node.js, PHP, Python)"}
              </button>

              {showVerifyCode && (
                <div className="space-y-3">
                  {/* Node.js */}
                  <div>
                    <p className="text-xs font-semibold text-foreground-700 mb-1">Node.js / Express</p>
                    <div className="bg-foreground-900 rounded-lg overflow-hidden">
                      <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`const crypto = require('crypto');

function verifyWebhookSignature(payload, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}

// Usage in your route:
app.post('/webhooks/obpay', express.json(), (req, res) => {
  const signature = req.headers['x-obpay-signature'];
  const secret = process.env.OBPAY_WEBHOOK_SECRET;

  if (!verifyWebhookSignature(req.body, signature, secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Process the webhook...
  res.status(200).json({ received: true });
});`}
                      </pre>
                    </div>
                  </div>

                  {/* PHP */}
                  <div>
                    <p className="text-xs font-semibold text-foreground-700 mb-1">PHP / Laravel</p>
                    <div className="bg-foreground-900 rounded-lg overflow-hidden">
                      <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`<?php
function verifyWebhookSignature($payload, $signatureHeader, $secret) {
    if (!$signatureHeader) return false;

    $expected = hash_hmac('sha256', json_encode($payload), $secret);

    return hash_equals($signatureHeader, $expected);
}

// Usage in your controller:
public function handleWebhook(Request $request) {
    $signature = $request->header('X-ObPay-Signature');
    $secret = env('OBPAY_WEBHOOK_SECRET');

    if (!verifyWebhookSignature($request->all(), $signature, $secret)) {
        return response()->json(['error' => 'Invalid signature'], 400);
    }

    // Process the webhook...
    return response()->json(['received' => true], 200);
}
?>`}
                      </pre>
                    </div>
                  </div>

                  {/* Python */}
                  <div>
                    <p className="text-xs font-semibold text-foreground-700 mb-1">Python / Django</p>
                    <div className="bg-foreground-900 rounded-lg overflow-hidden">
                      <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`import hmac
import hashlib
import json

def verify_webhook_signature(payload, signature_header, secret):
    if not signature_header:
        return False

    expected = hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload, separators=(',', ':')).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(signature_header, expected)

# Usage in your view:
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def obpay_webhook(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    signature = request.headers.get('X-ObPay-Signature')
    secret = os.environ['OBPAY_WEBHOOK_SECRET']

    payload = json.loads(request.body)

    if not verify_webhook_signature(payload, signature, secret):
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    # Process the webhook...
    return JsonResponse({'received': True}, status=200)`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-primary-500 text-background-50 text-xs font-bold flex items-center justify-center">4</div>
              <p className="text-sm font-semibold text-foreground-900">Handle Events in Your Code</p>
            </div>
            <p className="text-xs text-foreground-600 mb-2 ml-8">
              ObPay sends different event types. Handle each one appropriately in your application:
            </p>
            <div className="ml-8 space-y-2">
              <div className="bg-background-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">payment.success</span>
                  <span className="text-xs text-foreground-700 font-medium">Payment Successful</span>
                </div>
                <p className="text-[11px] text-foreground-500">
                  A collection was confirmed. Fulfill the order, send a receipt email, update inventory, and mark the invoice as paid. The payload includes <code className="font-mono text-[10px] bg-background-50 px-1 rounded">reference</code>, <code className="font-mono text-[10px] bg-background-50 px-1 rounded">gross_amount</code>, <code className="font-mono text-[10px] bg-background-50 px-1 rounded">net_amount</code>, and <code className="font-mono text-[10px] bg-background-50 px-1 rounded">fee_amount</code>.
                </p>
              </div>
              <div className="bg-background-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-accent-100 text-accent-700 rounded">payment.failed</span>
                  <span className="text-xs text-foreground-700 font-medium">Payment Failed</span>
                </div>
                <p className="text-[11px] text-foreground-500">
                  A collection failed. Notify the customer to retry, log the failure, and possibly offer alternative payment methods. No money was moved and no fee was charged.
                </p>
              </div>
              <div className="bg-background-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded">payout.success</span>
                  <span className="text-xs text-foreground-700 font-medium">Payout Successful</span>
                </div>
                <p className="text-[11px] text-foreground-500">
                  A payout was delivered to the recipient. Update your internal records, send a confirmation, and deduct the amount from your ledger.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Payload Examples */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
                <i className="ri-file-list-3-line text-secondary-600 text-lg" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-sm text-foreground-900">Complete Webhook Payload Examples</h3>
                <p className="text-xs text-foreground-500 mt-0.5">Exact JSON structure ObPay sends to your server</p>
              </div>
            </div>
            <button
              onClick={() => setShowPayloads(!showPayloads)}
              className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 cursor-pointer"
            >
              <i className={showPayloads ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
              {showPayloads ? "Hide" : "Show"}
            </button>
          </div>

          {showPayloads && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  payment.success
                </p>
                <div className="bg-foreground-900 rounded-lg overflow-hidden">
                  <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`{
  "event": "payment.success",
  "data": {
    "reference": "INV-12345",
    "transaction_id": "txn-uuid-here",
    "status": "success",
    "gross_amount": 50000,
    "fee_amount": 2500,
    "net_amount": 47500,
    "currency": "UGX",
    "customer_phone": "+256777123456",
    "payment_method": "MTN",
    "description": "Order #12345 payment",
    "provider_reference": "LP-89345",
    "completed_at": "2026-06-27T10:35:00Z"
  },
  "timestamp": "2026-06-27T10:35:00Z"
}`}
                  </pre>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-accent-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-accent-500" />
                  payment.failed
                </p>
                <div className="bg-foreground-900 rounded-lg overflow-hidden">
                  <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`{
  "event": "payment.failed",
  "data": {
    "reference": "INV-12345",
    "transaction_id": "txn-uuid-here",
    "status": "failed",
    "gross_amount": 50000,
    "currency": "UGX",
    "customer_phone": "+256777123456",
    "payment_method": "MTN",
    "description": "Order #12345 payment",
    "failure_reason": "Customer declined or insufficient balance",
    "completed_at": "2026-06-27T10:36:00Z"
  },
  "timestamp": "2026-06-27T10:36:00Z"
}`}
                  </pre>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-primary-700 mb-1.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary-500" />
                  payout.success
                </p>
                <div className="bg-foreground-900 rounded-lg overflow-hidden">
                  <pre className="text-xs text-primary-300 font-mono p-3 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`{
  "event": "payout.success",
  "data": {
    "reference": "WITHDRAW-001",
    "transaction_id": "txn-uuid-here",
    "status": "success",
    "amount": 100000,
    "currency": "UGX",
    "recipient_phone": "+256777123456",
    "recipient_name": "John Doe",
    "payment_method": "MTN",
    "description": "Salary payment - June 2026",
    "provider_reference": "LP-89350",
    "completed_at": "2026-06-27T11:00:00Z"
  },
  "timestamp": "2026-06-27T11:00:00Z"
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Retry Logic */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
              <i className="ri-repeat-line text-secondary-600 text-lg" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-sm text-foreground-900">Retry Logic & Best Practices</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-background-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-foreground-700 mb-1">Retry Schedule</p>
              <p className="text-[11px] text-foreground-500">
                If your server doesn't return 200 OK, ObPay retries: <strong>Attempt 1</strong> immediately, <strong>Attempt 2</strong> after 30 seconds, <strong>Attempt 3</strong> after 2 minutes. After 3 failures, the webhook is marked failed.
              </p>
            </div>
            <div className="bg-background-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-foreground-700 mb-1">Response Timeout</p>
              <p className="text-[11px] text-foreground-500">
                Your server must respond within <strong>10 seconds</strong>. If it takes longer, ObPay treats it as a failure and retries. Return 200 immediately, then process asynchronously.
              </p>
            </div>
            <div className="bg-background-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-foreground-700 mb-1">Idempotency</p>
              <p className="text-[11px] text-foreground-500">
                The same webhook may be sent multiple times. Use the <code className="font-mono text-[10px] bg-background-50 px-1 rounded">reference</code> or <code className="font-mono text-[10px] bg-background-50 px-1 rounded">transaction_id</code> to deduplicate and prevent double-processing.
              </p>
            </div>
            <div className="bg-background-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-foreground-700 mb-1">Return 200 Always</p>
              <p className="text-[11px] text-foreground-500">
                Even if your processing fails internally, return HTTP 200 to ObPay. Log the error locally and handle it separately. This prevents unnecessary retries.
              </p>
            </div>
          </div>
        </div>

        {/* Events We Send */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 p-5">
          <h3 className="font-heading font-semibold text-sm text-foreground-900 mb-3">Events We Send</h3>
          <div className="space-y-2">
            {[
              { event: "payment.success", label: "Collection Successful", desc: "A collection was successfully confirmed by the mobile money provider", color: "bg-emerald-500" },
              { event: "payment.failed", label: "Collection Failed", desc: "A collection failed (customer declined, timeout, or insufficient funds)", color: "bg-accent-500" },
              { event: "payout.success", label: "Payout Successful", desc: "A payout was successfully delivered to the recipient's wallet", color: "bg-primary-500" },
              { event: "payout.failed", label: "Payout Failed", desc: "A payout failed (invalid number, network error, or insufficient balance)", color: "bg-accent-500" },
            ].map((e) => (
              <div key={e.event} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-background-100">
                <div className={`w-2 h-2 rounded-full ${e.color} shrink-0 mt-1.5`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-mono text-foreground-800">{e.event}</p>
                    <span className="text-[10px] font-medium text-foreground-500">{e.label}</span>
                  </div>
                  <p className="text-xs text-foreground-500 mt-0.5">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery Logs */}
        <div className="bg-background-50 rounded-xl border border-background-200/70 overflow-hidden">
          <div className="p-5 border-b border-background-200/70">
            <h3 className="font-heading font-semibold text-sm text-foreground-900">Delivery Logs</h3>
          </div>
          {logs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-foreground-500">No webhook deliveries yet</p>
              <p className="text-xs text-foreground-400 mt-1">Webhooks will appear here when ObPay sends them to your server</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-background-200/70">
                    <th className="text-left px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Event</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Status</th>
                    <th className="text-center px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Code</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-foreground-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 10).map((log) => (
                    <tr key={log.id} className="border-b border-background-100">
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono text-foreground-900">{log.event_type}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-flex text-[11px] font-medium px-1.5 py-0.5 rounded-full ${log.status === "delivered" ? "bg-emerald-100 text-emerald-700" : "bg-accent-100 text-accent-700"}`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs text-foreground-600">{log.response_code || "—"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs text-foreground-500">{formatDate(log.created_at)}</span>
                      </td>
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
