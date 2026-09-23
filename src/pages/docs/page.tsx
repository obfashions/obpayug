import { useState } from "react";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";

const BASE = "https://obpay.online/api/public/v1";

type SectionId =
  | "overview"
  | "authentication"
  | "collect"
  | "payouts"
  | "status"
  | "transactions"
  | "balance"
  | "links"
  | "webhooks"
  | "errors"
  | "sdk"
  | "going-live";

const sections: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "ri-home-4-line" },
  { id: "authentication", label: "Authentication", icon: "ri-shield-keyhole-line" },
  { id: "collect", label: "Receive money", icon: "ri-download-cloud-line" },
  { id: "payouts", label: "Send money", icon: "ri-upload-cloud-line" },
  { id: "status", label: "Transaction status", icon: "ri-search-eye-line" },
  { id: "transactions", label: "List transactions", icon: "ri-list-check-2" },
  { id: "balance", label: "Balance & account", icon: "ri-wallet-3-line" },
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
      {subtitle && <p className="text-sm text-foreground-500 mt-1 break-all font-mono">{subtitle}</p>}
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

const endpointList: Array<{ m: string; p: string; d: string }> = [
  { m: "GET", p: "/ping", d: "Check that your key works." },
  { m: "GET", p: "/account", d: "Merchant id and object counts." },
  { m: "GET", p: "/balance", d: "Collected, paid out and net balance." },
  { m: "POST", p: "/collect", d: "Charge a mobile money wallet and get a secure payment link." },
  { m: "POST", p: "/payouts", d: "Send money to a mobile money wallet or any Ugandan bank account." },
  { m: "GET", p: "/transactions", d: "List with filters and pagination." },
  { m: "GET", p: "/transactions/{reference}", d: "One transaction, re-checked live." },
  { m: "GET", p: "/payments", d: "Latest 100 records (shortcut)." },
  { m: "GET", p: "/payment-links", d: "List your payment links." },
  { m: "POST", p: "/payment-links", d: "Create a hosted checkout link." },
  { m: "PATCH", p: "/payment-links/{id}", d: "Pause, resume or edit a link." },
  { m: "DELETE", p: "/payment-links/{id}", d: "Delete a link." },
  { m: "GET", p: "/webhooks", d: "List endpoints and their secrets." },
  { m: "POST", p: "/webhooks", d: "Register an endpoint." },
  { m: "POST", p: "/webhooks/{id}/test", d: "Send a test event." },
  { m: "DELETE", p: "/webhooks/{id}", d: "Remove an endpoint." },
  { m: "GET", p: "/webhook-deliveries", d: "Recent delivery attempts." },
];

function methodClass(m: string) {
  if (m === "GET") return "bg-primary-50 text-primary-700";
  if (m === "POST") return "bg-emerald-50 text-emerald-700";
  if (m === "PATCH") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
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
          description:
            "Integrate mobile money collections, bank and mobile money payouts, payment links and webhooks with the ObPay REST API.",
        }}
      />
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-max">
          <div className="flex flex-wrap lg:flex-col gap-2">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm cursor-pointer transition-colors ${
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
                The ObPay API lets your website or app receive and send mobile money in Uganda, Kenya and Tanzania.
                Every request is JSON over HTTPS, authenticated with your secret key, and every response has the same
                shape: <code className="font-mono text-xs">{'{ "success": true, "data": … }'}</code> or{" "}
                <code className="font-mono text-xs">{'{ "success": false, "error": "…" }'}</code>.
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {[
                  { t: "1. Create an API key", d: "Dashboard → API keys. Copy the secret once; it is never shown again." },
                  { t: "2. Receive money", d: "POST /collect, then send the payer to the checkout_url you get back." },
                  { t: "3. Send money", d: "POST /payouts to pay a wallet or bank account." },
                  { t: "4. Confirm the result", d: "Listen for a webhook, or poll GET /transactions/{reference}." },
                ].map((c) => (
                  <div key={c.t} className="rounded-xl border border-background-200 p-4">
                    <p className="text-sm font-semibold text-foreground-900">{c.t}</p>
                    <p className="text-xs text-foreground-500 mt-1">{c.d}</p>
                  </div>
                ))}
              </div>

              <h3 className="text-sm font-semibold text-foreground-900 mt-6 mb-2">All endpoints</h3>
              <div className="rounded-xl border border-background-200 divide-y divide-background-100">
                {endpointList.map((e) => (
                  <div key={`${e.m}${e.p}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${methodClass(e.m)}`}>{e.m}</span>
                    <code className="font-mono text-xs text-foreground-900 break-all">{e.p}</code>
                    <span className="text-xs text-foreground-500 w-full sm:w-auto sm:ml-auto">{e.d}</span>
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
    "phone_number": "0772123456",
    "reference": "ORDER-1001",
    "description": "Order 1001"
  }'`}
              />
              <p className="text-sm text-foreground-600">
                Rate limit: 90 requests per minute per key. Amounts are in the major unit (5000 = UGX 5,000). Phone
                numbers can be local (<code className="font-mono text-xs">0700000000</code>) or international — ObPay
                converts them for you.
              </p>
            </section>
          )}

          {active === "authentication" && (
            <section>
              <Header icon="ri-shield-keyhole-line" label="Authentication" subtitle="Authorization: Bearer sk_live_…" />
              <p className="text-sm text-foreground-600">
                Send your secret key in the <code className="font-mono text-xs">Authorization</code> header on every
                request (an <code className="font-mono text-xs">X-API-Key</code> header also works). Keys are created in
                the dashboard and can be revoked at any time. Never expose a secret key in browser code — call ObPay
                from your server.
              </p>
              <CodeBlock
                title="Verify your key"
                code={`curl "${BASE}/ping" -H "Authorization: Bearer sk_live_your_secret_key"

{ "success": true, "data": { "merchant_id": "…", "live": true } }`}
              />
              <Table
                rows={[
                  { name: "pk_live_…", type: "Public key", required: "—", desc: "Safe to reference publicly; identifies your account." },
                  { name: "sk_live_…", type: "Secret key", required: "Yes", desc: "Server-side only. Grants full API access." },
                  { name: "sk_sandbox_…", type: "Sandbox secret", required: "—", desc: "Use while testing your integration." },
                ]}
              />
              <p className="text-sm text-foreground-600 mt-3">
                A missing, revoked or unknown key returns <code className="font-mono text-xs">401</code>. CORS is open,
                so server-to-server calls from any domain work without extra configuration.
              </p>
            </section>
          )}

          {active === "collect" && (
            <section>
              <Header icon="ri-download-cloud-line" label="Receive money" subtitle={`POST ${BASE}/collect`} />
              <p className="text-sm text-foreground-600">
                Sends a payment prompt to the customer's phone. The response returns immediately with{" "}
                <code className="font-mono text-xs">status: "pending"</code> — the customer still has to approve on
                their handset. Confirm with a webhook or by polling the transaction.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "number", required: "Yes", desc: "Whole number in UGX, e.g. 5000. Decimals are rejected." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Payer's mobile money number, e.g. 0772123456. +256… is accepted too." },
                  { name: "currency", type: "string", required: "No", desc: "UGX (default), KES or TZS." },
                  { name: "reference", type: "string", required: "No", desc: "Your unique reference, max 40 chars. Auto-generated if omitted." },
                  { name: "description", type: "string", required: "No", desc: "Shown on your statement and receipts." },
                  { name: "metadata", type: "object", required: "No", desc: "Any JSON you want returned with the transaction." },
                ]}
              />
              <CodeBlock
                title="Request"
                code={`curl -X POST "${BASE}/collect" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":5000,"currency":"UGX","phone_number":"0772123456","reference":"ORDER-1001","metadata":{"order_id":1001}}'`}
              />
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": {
    "reference": "ORDER-1001",
    "provider_reference": "87f2e5b0-48db-4d58-9bee-9348565fe444",
    "amount": 5000,
    "currency": "UGX",
    "status": "pending",
    "type": "collection"
  }
}`}
              />
            </section>
          )}

          {active === "payouts" && (
            <section>
              <Header icon="ri-upload-cloud-line" label="Send money" subtitle={`POST ${BASE}/payouts`} />
              <p className="text-sm text-foreground-600">
                Pays a mobile money wallet from your ObPay balance. <code className="font-mono text-xs">/send</code>,{" "}
                <code className="font-mono text-xs">/send-money</code> and{" "}
                <code className="font-mono text-xs">/withdraw</code> are accepted aliases. Payouts start as{" "}
                <code className="font-mono text-xs">pending</code> and settle within seconds.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "number", required: "Yes", desc: "Whole number in UGX. Must not exceed your available balance." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Recipient's mobile money number, e.g. 0772123456. For a bank payout send bank_code, account_number and customer_name instead." },
                  { name: "currency", type: "string", required: "No", desc: "UGX (default), KES or TZS." },
                  { name: "reference", type: "string", required: "No", desc: "Your unique reference. Auto-generated if omitted." },
                  { name: "description", type: "string", required: "No", desc: "Reason shown on your statement." },
                ]}
              />
              <CodeBlock
                title="Request"
                code={`curl -X POST "${BASE}/payouts" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":20000,"phone_number":"0700000000","reference":"PAYOUT-77","description":"Supplier payment"}'`}
              />
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": {
    "reference": "PAYOUT-77",
    "amount": 20000,
    "currency": "UGX",
    "status": "pending",
    "type": "payout"
  }
}`}
              />
              <p className="text-sm text-foreground-600">
                If you try to send more than you hold you get{" "}
                <em>“Insufficient balance. Available: … UGX.”</em> — check{" "}
                <code className="font-mono text-xs">GET /balance</code> first.
              </p>
            </section>
          )}

          {active === "status" && (
            <section>
              <Header icon="ri-search-eye-line" label="Transaction status" subtitle={`GET ${BASE}/transactions/{reference}`} />
              <p className="text-sm text-foreground-600">
                Returns the stored record and re-checks the provider while the payment is still pending. Poll every few
                seconds for up to about two minutes, or rely on webhooks. Works for collections and payouts.
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
    "type": "collection",
    "amount": 5000,
    "currency": "UGX",
    "status": "success",
    "phone_number": "0772123456",
    "created_at": "2026-08-02T09:14:11.000Z"
  }
}`}
              />
              <p className="text-sm text-foreground-600">
                <strong>Statuses:</strong> <code className="font-mono text-xs">pending</code>,{" "}
                <code className="font-mono text-xs">success</code>, <code className="font-mono text-xs">failed</code>.
                An unknown reference returns <code className="font-mono text-xs">404</code>. When a poll flips a
                transaction to success or failed, ObPay also fires your webhook and emails the receipt.
              </p>
            </section>
          )}

          {active === "transactions" && (
            <section>
              <Header icon="ri-list-check-2" label="List transactions" subtitle={`GET ${BASE}/transactions`} />
              <p className="text-sm text-foreground-600">
                Paginated history, newest first. <code className="font-mono text-xs">GET /payments</code> is a shortcut
                that returns the latest 100 records with no parameters.
              </p>
              <Table
                rows={[
                  { name: "status", type: "query", required: "No", desc: "pending, success or failed." },
                  { name: "type", type: "query", required: "No", desc: "collection or payout." },
                  { name: "from / to", type: "query", required: "No", desc: "ISO dates to bound created_at." },
                  { name: "limit", type: "query", required: "No", desc: "1–200, default 50." },
                  { name: "page", type: "query", required: "No", desc: "1-based page number." },
                ]}
              />
              <CodeBlock
                title="Request"
                code={`curl "${BASE}/transactions?type=collection&status=success&limit=25&page=1" \\
  -H "Authorization: Bearer sk_live_your_secret_key"`}
              />
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": [ { "reference": "ORDER-1001", "status": "success", "amount": 5000 } ],
  "meta": { "page": 1, "limit": 25, "total": 143 }
}`}
              />
            </section>
          )}

          {active === "balance" && (
            <section>
              <Header icon="ri-wallet-3-line" label="Balance & account" subtitle={`GET ${BASE}/balance · GET ${BASE}/account`} />
              <p className="text-sm text-foreground-600">
                <code className="font-mono text-xs">/balance</code> returns what you have collected, paid out and what
                remains available for payouts. <code className="font-mono text-xs">/account</code> returns your merchant
                id and object counts — useful as a health check in your admin panel.
              </p>
              <CodeBlock
                title="Response 200 — /balance"
                code={`{
  "success": true,
  "data": {
    "currency": "UGX",
    "collected": 1250000,
    "paid_out": 400000,
    "net": 850000
  }
}`}
              />
              <CodeBlock
                title="Response 200 — /account"
                code={`{
  "success": true,
  "data": { "merchant_id": "…", "transactions": 143, "payment_links": 4, "webhook_endpoints": 1 }
}`}
              />
            </section>
          )}

          {active === "links" && (
            <section>
              <Header icon="ri-links-line" label="Payment links" subtitle={`GET · POST ${BASE}/payment-links`} />
              <p className="text-sm text-foreground-600">
                Payment links are hosted checkout pages at{" "}
                <code className="font-mono text-xs">obpay.online/pay/your-slug</code>. Create them in the dashboard, or
                from the API so your own system can generate one per invoice.
              </p>
              <Table
                rows={[
                  { name: "title", type: "string", required: "Yes", desc: "Shown at the top of the checkout page." },
                  { name: "amount", type: "number", required: "No", desc: "Leave out to let the payer type their own amount." },
                  { name: "currency", type: "string", required: "No", desc: "UGX (default), KES or TZS." },
                  { name: "description", type: "string", required: "No", desc: "Extra detail for the payer." },
                  { name: "redirect_url", type: "string", required: "No", desc: "Where to send the payer after a successful payment." },
                ]}
              />
              <CodeBlock
                title="Create a link"
                code={`curl -X POST "${BASE}/payment-links" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Invoice 2043","amount":75000,"redirect_url":"https://your-site.com/thanks"}'

{ "success": true, "data": { "id": "…", "slug": "invoice-2043",
  "url": "https://obpay.online/pay/invoice-2043" } }`}
              />
              <CodeBlock
                title="Pause or delete"
                code={`curl -X PATCH "${BASE}/payment-links/{id}" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" -d '{"status":"paused"}'

curl -X DELETE "${BASE}/payment-links/{id}" \\
  -H "Authorization: Bearer sk_live_your_secret_key"`}
              />
              <ul className="mt-3 space-y-2 text-sm text-foreground-600 list-disc pl-5">
                <li>Pre-fill an amount with <code className="font-mono text-xs">?amount=5000</code>.</li>
                <li>Views and payments are counted for you on every link.</li>
                <li>Successful link payments fire the same <code className="font-mono text-xs">collection.success</code> webhook.</li>
              </ul>
            </section>
          )}

          {active === "webhooks" && (
            <section>
              <Header icon="ri-webhook-line" label="Webhooks" subtitle={`GET · POST ${BASE}/webhooks`} />
              <p className="text-sm text-foreground-600">
                Register an HTTPS endpoint and ObPay POSTs every matching event to it. Each delivery is signed so you can
                confirm it really came from ObPay, and every attempt is logged with the response code.
              </p>
              <CodeBlock
                title="Register an endpoint"
                code={`curl -X POST "${BASE}/webhooks" \\
  -H "Authorization: Bearer sk_live_your_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-site.com/obpay-webhook",
       "events":["collection.success","collection.failed"]}'

{ "success": true, "data": { "id": "…", "secret": "whsec_…" } }

# send yourself a test event
curl -X POST "${BASE}/webhooks/{id}/test" -H "Authorization: Bearer sk_live_your_secret_key"`}
              />
              <Table
                rows={[
                  { name: "collection.success", type: "event", required: "—", desc: "Money was received." },
                  { name: "collection.failed", type: "event", required: "—", desc: "The payer cancelled or the prompt expired." },
                  { name: "payout.success", type: "event", required: "—", desc: "A payout was completed." },
                  { name: "payout.failed", type: "event", required: "—", desc: "A payout could not be completed." },
                  { name: "test.ping", type: "event", required: "—", desc: "Sent by the test button; always delivered." },
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
    "type": "collection",
    "status": "success",
    "amount": 5000,
    "currency": "UGX",
    "phone_number": "0772123456"
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
                Respond with any 2xx within 8 seconds — slower endpoints are recorded as failed. Review attempts with{" "}
                <code className="font-mono text-xs">GET /webhook-deliveries</code> or in the dashboard.
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
                  { name: "401", type: "status", required: "—", desc: "Invalid, missing or revoked API secret key." },
                  { name: "400", type: "status", required: "—", desc: "The JSON body could not be parsed." },
                  { name: "404", type: "status", required: "—", desc: "Unknown endpoint or reference." },
                  { name: "429", type: "status", required: "—", desc: "More than 90 requests in a minute on one key." },
                  { name: "200 + success:false", type: "status", required: "—", desc: "The request was understood but the payment could not start." },
                ]}
              />
              <p className="text-sm text-foreground-600 mt-3">
                Common messages: <em>“amount must be greater than zero”</em>, <em>“phone_number is required”</em>,{" "}
                <em>“Reference … has already been used”</em>, <em>“Insufficient balance”</em>.
              </p>
            </section>
          )}

          {active === "sdk" && (
            <section>
              <Header icon="ri-code-s-slash-line" label="Code examples" />
              <CodeBlock
                title="Node.js — receive money"
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
                title="Node.js — send money"
                code={`const res = await fetch("${BASE}/payouts", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.OBPAY_SECRET_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ amount: 20000, phone_number: "0700000000", reference: "PAYOUT-77" }),
});
const { success, data, error } = await res.json();`}
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
        "phone_number": "0772123456",
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
                <li>Call <code className="font-mono text-xs">GET /ping</code> from your server to confirm the key works.</li>
                <li>Register your webhook endpoint and send a test event.</li>
                <li>Run one small real collection and one small payout end to end.</li>
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
