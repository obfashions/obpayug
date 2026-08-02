import { useState } from "react";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";

const BASE = "https://obpay.online/api/public/v1";

type SectionId =
  | "overview"
  | "authentication"
  | "collect"
  | "status"
  | "payments"
  | "links"
  | "webhooks"
  | "errors"
  | "sdk"
  | "going-live";

const sections: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "ri-home-4-line" },
  { id: "authentication", label: "Authentication", icon: "ri-shield-keyhole-line" },
  { id: "collect", label: "Collect money", icon: "ri-download-cloud-line" },
  { id: "status", label: "Transaction status", icon: "ri-search-eye-line" },
  { id: "payments", label: "List payments", icon: "ri-list-check-2" },
  { id: "links", label: "Payment links", icon: "ri-links-line" },
  { id: "webhooks", label: "Webhooks", icon: "ri-webhook-line" },
  { id: "errors", label: "Errors", icon: "ri-error-warning-line" },
  { id: "sdk", label: "Code examples", icon: "ri-code-s-slash-line" },
  { id: "going-live", label: "Going live", icon: "ri-rocket-line" },
];

function CodeBlock({ title, code }: { title?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-foreground-900 rounded-xl overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-foreground-800 border-b border-foreground-700">
        <span className="text-xs text-background-200 font-mono">{title || "Terminal"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="text-xs text-background-200 hover:text-white cursor-pointer"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[12.5px] leading-relaxed text-background-100 font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function Header({ icon, label, subtitle }: { icon: string; label: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-foreground-900 flex items-center gap-2">
        <i className={`${icon} text-primary-600`} />
        {label}
      </h2>
      {subtitle && <p className="text-sm text-foreground-500 mt-1 break-all">{subtitle}</p>}
    </div>
  );
}

function Table({ rows }: { rows: Array<{ name: string; type: string; required: string; desc: string }> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-background-200">
      <table className="w-full text-sm">
        <thead className="bg-background-50 text-left text-foreground-500">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Required</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-background-100">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-3 py-2 font-mono text-xs text-foreground-900">{r.name}</td>
              <td className="px-3 py-2 text-foreground-600">{r.type}</td>
              <td className="px-3 py-2 text-foreground-600">{r.required}</td>
              <td className="px-3 py-2 text-foreground-600">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div className="min-h-screen bg-background-50">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "ObPay API documentation",
          description: "Integrate mobile money collections, payment links and webhooks with the ObPay REST API.",
        }}
      />
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-max">
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors ${
                  active === s.id
                    ? "bg-primary-600 text-white"
                    : "bg-white text-foreground-600 hover:bg-background-100 border border-background-200"
                }`}
              >
                <i className={s.icon} />
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="bg-white rounded-2xl border border-background-200 p-5 sm:p-8 min-w-0">
          {active === "overview" && (
            <section>
              <Header icon="ri-home-4-line" label="ObPay API" subtitle={`Base URL: ${BASE}`} />
              <p className="text-sm text-foreground-600">
                The ObPay API lets your website or app collect mobile money in Uganda, Kenya and Tanzania. Every request is
                JSON over HTTPS and is authenticated with your secret key. Collections are charged to the payer's mobile
                money wallet and settle into your ObPay balance.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {[
                  { t: "1. Create an API key", d: "Dashboard → API keys. Copy the secret once; it is never shown again." },
                  { t: "2. Start a collection", d: "POST /collect with the payer's number and the amount." },
                  { t: "3. Confirm the result", d: "Listen for a webhook, or poll GET /transactions/{reference}." },
                  { t: "4. Reconcile", d: "GET /payments returns your latest 100 records at any time." },
                ].map((c) => (
                  <div key={c.t} className="rounded-xl border border-background-200 p-4">
                    <p className="text-sm font-semibold text-foreground-900">{c.t}</p>
                    <p className="text-xs text-foreground-500 mt-1">{c.d}</p>
                  </div>
                ))}
              </div>
              <CodeBlock
                title="Quick start"
                code={`curl -X POST "${BASE}/collect" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 5000,
    "currency": "UGX",
    "phone_number": "+256700000000",
    "reference": "ORDER-1001",
    "description": "Order 1001"
  }'`}
              />
            </section>
          )}

          {active === "authentication" && (
            <section>
              <Header icon="ri-shield-keyhole-line" label="Authentication" subtitle="Bearer secret key" />
              <p className="text-sm text-foreground-600">
                Send your secret key in the <code className="font-mono text-xs">Authorization</code> header on every
                request. Keys are created in the dashboard and can be revoked at any time. Never expose a secret key in
                browser code — call ObPay from your server.
              </p>
              <CodeBlock title="Header" code={`Authorization: Bearer sk_live_your_secret_key`} />
              <Table
                rows={[
                  { name: "pk_live_…", type: "Public key", required: "—", desc: "Safe to reference publicly; identifies your account." },
                  { name: "sk_live_…", type: "Secret key", required: "Yes", desc: "Server-side only. Grants full API access." },
                  { name: "sk_sandbox_…", type: "Sandbox secret", required: "—", desc: "Use while testing your integration." },
                ]}
              />
            </section>
          )}

          {active === "collect" && (
            <section>
              <Header icon="ri-download-cloud-line" label="Collect money" subtitle={`POST ${BASE}/collect`} />
              <p className="text-sm text-foreground-600">
                Sends a payment prompt to the customer's phone. The response returns immediately with{" "}
                <code className="font-mono text-xs">status: "pending"</code> — the customer still has to approve on their
                handset.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "number", required: "Yes", desc: "Amount in the major unit, e.g. 5000 for UGX 5,000." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Payer's number. Local or +256… both work." },
                  { name: "currency", type: "string", required: "No", desc: "UGX (default), KES or TZS." },
                  { name: "reference", type: "string", required: "No", desc: "Your unique reference. Auto-generated if omitted." },
                  { name: "description", type: "string", required: "No", desc: "Shown on your statement." },
                ]}
              />
              <CodeBlock
                title="Request"
                code={`curl -X POST "${BASE}/collect" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":5000,"currency":"UGX","phone_number":"+256700000000","reference":"ORDER-1001"}'`}
              />
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": {
    "reference": "ORDER-1001",
    "provider_reference": "MRZ-9F2K…",
    "amount": 5000,
    "currency": "UGX",
    "status": "pending"
  }
}`}
              />
            </section>
          )}

          {active === "status" && (
            <section>
              <Header icon="ri-search-eye-line" label="Transaction status" subtitle={`GET ${BASE}/transactions/{reference}`} />
              <p className="text-sm text-foreground-600">
                Returns the stored record and re-checks the provider while the payment is still pending. Poll every few
                seconds for up to about two minutes, or rely on webhooks.
              </p>
              <CodeBlock
                title="Request"
                code={`curl "${BASE}/transactions/ORDER-1001" \\
  -H "Authorization: Bearer sk_live_your_secret_key"`}
              />
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": {
    "reference": "ORDER-1001",
    "amount": 5000,
    "currency": "UGX",
    "status": "success",
    "phone_number": "+256700000000",
    "created_at": "2026-08-02T09:14:11.000Z"
  }
}`}
              />
              <p className="text-sm text-foreground-600">
                <strong>Statuses:</strong> <code className="font-mono text-xs">pending</code>,{" "}
                <code className="font-mono text-xs">success</code>, <code className="font-mono text-xs">failed</code>.
              </p>
            </section>
          )}

          {active === "payments" && (
            <section>
              <Header icon="ri-list-check-2" label="List payments" subtitle={`GET ${BASE}/payments`} />
              <p className="text-sm text-foreground-600">Returns your 100 most recent payment records, newest first.</p>
              <CodeBlock
                title="Request"
                code={`curl "${BASE}/payments" -H "Authorization: Bearer sk_live_your_secret_key"`}
              />
            </section>
          )}

          {active === "links" && (
            <section>
              <Header icon="ri-links-line" label="Payment links" subtitle="No code required" />
              <p className="text-sm text-foreground-600">
                Create a link in the dashboard under <strong>Payment links</strong> and share it by WhatsApp, SMS or QR
                code. The hosted checkout at <code className="font-mono text-xs">obpay.online/pay/your-slug</code> collects
                the payer's number, sends the mobile money prompt and confirms the result on screen.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-foreground-600 list-disc pl-5">
                <li>Fixed amount, or let the payer type their own.</li>
                <li>Optional redirect URL after a successful payment.</li>
                <li>Pause or delete a link at any time; views and payments are counted for you.</li>
                <li>Successful link payments fire the same <code className="font-mono text-xs">collection.success</code> webhook.</li>
              </ul>
              <CodeBlock title="Pre-fill an amount" code={`https://obpay.online/pay/your-slug?amount=5000`} />
            </section>
          )}

          {active === "webhooks" && (
            <section>
              <Header icon="ri-webhook-line" label="Webhooks" subtitle="Dashboard → Webhooks" />
              <p className="text-sm text-foreground-600">
                Add an HTTPS endpoint and ObPay will POST every matching event to it. Each delivery is signed so you can
                confirm it really came from ObPay, and every attempt is logged in the dashboard with the response code.
              </p>
              <Table
                rows={[
                  { name: "collection.success", type: "event", required: "—", desc: "Money was received." },
                  { name: "collection.failed", type: "event", required: "—", desc: "The payer cancelled or the prompt expired." },
                  { name: "payout.success", type: "event", required: "—", desc: "A payout was completed." },
                  { name: "payout.failed", type: "event", required: "—", desc: "A payout could not be completed." },
                ]}
              />
              <CodeBlock
                title="Delivered payload"
                code={`POST https://your-site.com/obpay-webhook
X-ObPay-Event: collection.success
X-ObPay-Signature: 6f1c…   (HMAC-SHA256 of the raw body, using your endpoint secret)

{
  "event": "collection.success",
  "created_at": "2026-08-02T09:14:31.000Z",
  "data": {
    "reference": "ORDER-1001",
    "amount": 5000,
    "currency": "UGX",
    "phone_number": "+256700000000"
  }
}`}
              />
              <CodeBlock
                title="Verify the signature (Node.js)"
                code={`import crypto from "crypto";

app.post("/obpay-webhook", express.raw({ type: "application/json" }), (req, res) => {
  const expected = crypto
    .createHmac("sha256", process.env.OBPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");

  if (expected !== req.header("X-ObPay-Signature")) return res.sendStatus(401);

  const { event, data } = JSON.parse(req.body.toString());
  if (event === "collection.success") markOrderPaid(data.reference);

  res.sendStatus(200); // always answer 2xx quickly
});`}
              />
              <p className="text-sm text-foreground-600">
                Respond with any 2xx within a few seconds. Use the <strong>Send test event</strong> button in the dashboard
                to confirm your endpoint is reachable before going live.
              </p>
            </section>
          )}

          {active === "errors" && (
            <section>
              <Header icon="ri-error-warning-line" label="Errors" subtitle="Every response has a success flag" />
              <p className="text-sm text-foreground-600">
                Failures return <code className="font-mono text-xs">{'{ "success": false, "error": "…" }'}</code> with a
                plain-language message you can show to your customer.
              </p>
              <Table
                rows={[
                  { name: "401", type: "status", required: "—", desc: "Invalid or missing API secret key." },
                  { name: "400", type: "status", required: "—", desc: "The JSON body could not be parsed." },
                  { name: "404", type: "status", required: "—", desc: "Unknown endpoint or reference." },
                  { name: "200 + success:false", type: "status", required: "—", desc: "The request was understood but the payment could not start." },
                ]}
              />
              <p className="text-sm text-foreground-600 mt-3">
                Common messages: <em>“amount must be greater than zero”</em>, <em>“phone_number is required”</em>,{" "}
                <em>“Reference … has already been used”</em>.
              </p>
            </section>
          )}

          {active === "sdk" && (
            <section>
              <Header icon="ri-code-s-slash-line" label="Code examples" />
              <CodeBlock
                title="Node.js"
                code={`const res = await fetch("${BASE}/collect", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.OBPAY_SECRET_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    amount: 5000,
    currency: "UGX",
    phone_number: "+256700000000",
    reference: "ORDER-1001",
  }),
});

const { success, data, error } = await res.json();
if (!success) throw new Error(error);
console.log(data.reference, data.status); // ORDER-1001 pending`}
              />
              <CodeBlock
                title="PHP"
                code={`$ch = curl_init("${BASE}/collect");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("OBPAY_SECRET_KEY"),
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "amount" => 5000,
    "currency" => "UGX",
    "phone_number" => "+256700000000",
    "reference" => "ORDER-1001",
  ]),
]);
$response = json_decode(curl_exec($ch), true);`}
              />
              <CodeBlock
                title="Python"
                code={`import os, requests

r = requests.post(
    "${BASE}/collect",
    headers={"Authorization": f"Bearer {os.environ['OBPAY_SECRET_KEY']}"},
    json={
        "amount": 5000,
        "currency": "UGX",
        "phone_number": "+256700000000",
        "reference": "ORDER-1001",
    },
    timeout=30,
)
print(r.json())`}
              />
            </section>
          )}

          {active === "going-live" && (
            <section>
              <Header icon="ri-rocket-line" label="Going live" />
              <ol className="space-y-3 text-sm text-foreground-600 list-decimal pl-5">
                <li>Complete verification in the dashboard so settlements can be released to you.</li>
                <li>Create a <strong>live</strong> API key and store the secret in your server environment.</li>
                <li>Register your webhook endpoint and send a test event.</li>
                <li>Run one small real collection end to end and confirm it appears under Transactions.</li>
                <li>Handle the three statuses in your code: pending, success and failed.</li>
              </ol>
              <div className="mt-5 rounded-xl border border-background-200 bg-background-50 p-4 text-sm text-foreground-600">
                Need help integrating? Contact support from your dashboard and include your reference — every API call is
                logged against your account.
              </div>
            </section>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
