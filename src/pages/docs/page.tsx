import { useEffect, useState } from "react";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";

const BASE = "https://obpay.online/api/public/v1";

type SectionId =
  | "overview"
  | "quickstart"
  | "authentication"
  | "collect"
  | "payouts"
  | "status"
  | "transactions"
  | "balance"
  | "links"
  | "refunds"
  | "countries"
  | "webhooks"
  | "errors"
  | "going-live";

const sections: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "ri-home-4-line" },
  { id: "quickstart", label: "Quick start", icon: "ri-flashlight-line" },
  { id: "authentication", label: "Authentication", icon: "ri-shield-keyhole-line" },
  { id: "collect", label: "Receive money", icon: "ri-download-cloud-line" },
  { id: "payouts", label: "Send money", icon: "ri-upload-cloud-line" },
  { id: "status", label: "Check a payment", icon: "ri-search-eye-line" },
  { id: "transactions", label: "List transactions", icon: "ri-list-check-2" },
  { id: "balance", label: "Balance & account", icon: "ri-wallet-3-line" },
  { id: "links", label: "Payment links", icon: "ri-links-line" },
  { id: "countries", label: "Countries, crypto & rates", icon: "ri-global-line" },
  { id: "refunds", label: "Refunds", icon: "ri-refund-2-line" },
  { id: "webhooks", label: "Webhooks & signing", icon: "ri-webhook-line" },
  { id: "errors", label: "Errors & limits", icon: "ri-error-warning-line" },
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
  { m: "GET", p: "/account", d: "Your merchant id and counts." },
  { m: "GET", p: "/balance", d: "Collected, paid out and available balance." },
  { m: "POST", p: "/collect", d: "Send a PIN prompt to a customer's MTN or Airtel phone." },
  { m: "POST", p: "/payouts", d: "Send money to an MTN or Airtel mobile money number." },
  { m: "GET", p: "/transactions", d: "List with filters and pagination." },
  { m: "GET", p: "/transactions/{reference}", d: "One transaction, re-checked live." },
  { m: "GET", p: "/payment-links", d: "List your payment links." },
  { m: "POST", p: "/payment-links", d: "Create a shareable payment page." },
  { m: "PATCH", p: "/payment-links/{id}", d: "Pause, resume or edit a link." },
  { m: "DELETE", p: "/payment-links/{id}", d: "Delete a link." },
  { m: "GET", p: "/webhook-deliveries", d: "Recent notifications sent to your callback_url." },
];

function methodClass(m: string) {
  if (m === "GET") return "bg-primary-50 text-primary-700";
  if (m === "POST") return "bg-emerald-50 text-emerald-700";
  if (m === "PATCH") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

const P = "text-sm text-foreground-600 leading-relaxed";
const C = "font-mono text-xs bg-background-100 rounded px-1";

function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return (
    <div
      className={`mt-4 rounded-xl border p-4 text-sm ${
        tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-primary-200 bg-primary-50 text-foreground-700"
      }`}
    >
      {children}
    </div>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState<SectionId>("overview");

  useEffect(() => {
    const h = window.location.hash.replace("#", "") as SectionId;
    if (sections.some((s) => s.id === h)) setActive(h);
  }, []);

  const go = (id: SectionId) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background-50">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "ObPay (PawaPay Ptn) API documentation",
          description: "Receive and send MTN and Airtel mobile money in Uganda with the ObPay REST API.",
        }}
      />
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-max">
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 lg:flex-col -mx-4 px-4 lg:mx-0 lg:px-0">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => go(s.id)}
                className={`flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg px-3 py-2 text-xs sm:text-sm cursor-pointer transition-colors ${
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

        <main className="bg-white rounded-2xl border border-background-200 p-4 sm:p-8 min-w-0 space-y-4">
          {active === "overview" && (
            <section className="space-y-4">
              <Header icon="ri-home-4-line" label="ObPay API" subtitle={`Base URL: ${BASE}`} />
              <p className={P}>
                Receive and send MTN Mobile Money and Airtel Money in Uganda (UGX) from your own website or app. Every
                request is JSON over HTTPS, authenticated with your secret key. Every response looks like{" "}
                <code className={C}>{'{ "success": true, "data": {…} }'}</code> or{" "}
                <code className={C}>{'{ "success": false, "error": "…" }'}</code>.
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground-600">
                <li><strong>Collect:</strong> you call <code className={C}>POST /collect</code>, the customer gets a PIN prompt on their phone.</li>
                <li><strong>Get notified:</strong> ObPay POSTs the result to your <code className={C}>callback_url</code>, signed with your webhook signing secret.</li>
                <li><strong>Confirm:</strong> your server calls <code className={C}>GET /transactions/{"{reference}"}</code> before delivering goods.</li>
              </ol>
              <div className="overflow-x-auto rounded-xl border border-background-200">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-background-100">
                    {endpointList.map((e) => (
                      <tr key={e.m + e.p}>
                        <td className="px-3 py-2 w-16">
                          <span className={`text-[11px] font-bold rounded px-2 py-0.5 ${methodClass(e.m)}`}>{e.m}</span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-foreground-900 whitespace-nowrap">{e.p}</td>
                        <td className="px-3 py-2 text-foreground-600 min-w-[180px]">{e.d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {active === "quickstart" && (
            <section className="space-y-3">
              <Header icon="ri-flashlight-line" label="Quick start (5 minutes)" />
              <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground-600">
                <li>Sign in and open <strong>Dashboard → API Keys</strong>. Create a <strong>live</strong> key and copy the secret (<code className={C}>sk_live_…</code>). It is shown only once.</li>
                <li>On the same page copy your <strong>Webhook signing secret</strong> (<code className={C}>whsec_…</code>).</li>
                <li>Save both on your server — never in browser or mobile app code:</li>
              </ol>
              <CodeBlock title=".env" code={`OBPAY_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxx\nOBPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx`} />
              <p className={P}>Test the key:</p>
              <CodeBlock title="cURL" code={`curl ${BASE}/ping \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY"`} />
              <p className={P}>Then collect your first payment:</p>
              <CodeBlock
                title="cURL"
                code={`curl -X POST ${BASE}/collect \\
  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 1000,
    "currency": "UGX",
    "phone_number": "0772123456",
    "customer_name": "Jane Nakato",
    "customer_email": "jane@example.com",
    "reference": "ORDER-1001",
    "callback_url": "https://yoursite.com/obpay/callback"
  }'`}
              />
              <Note>
                Call the API from your <strong>server</strong> (PHP, Node.js, Python…). Calling it straight from browser
                JavaScript exposes your secret key.
              </Note>
            </section>
          )}

          {active === "authentication" && (
            <section className="space-y-3">
              <Header icon="ri-shield-keyhole-line" label="Authentication" />
              <p className={P}>Send your secret key on every request, in either header:</p>
              <CodeBlock title="Headers" code={`Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx\n# or\nX-API-Key: sk_live_xxxxxxxxxxxxxxxx\n\nContent-Type: application/json`} />
              <p className={P}>
                A missing or wrong key returns <code className={C}>401</code>. Revoked keys stop working immediately. There is
                no IP whitelist — your server can call from any address.
              </p>
            </section>
          )}

          {active === "collect" && (
            <section className="space-y-3">
              <Header icon="ri-download-cloud-line" label="Receive money" subtitle={`POST ${BASE}/collect`} />
              <p className={P}>
                Sends a PIN prompt to the customer's MTN or Airtel phone. The customer enters their PIN and the money
                lands in your ObPay balance. The payment starts as <code className={C}>pending</code> and becomes{" "}
                <code className={C}>success</code> or <code className={C}>failed</code> — usually within a minute.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "integer", required: "Yes", desc: "Whole UGX amount, e.g. 5000. No decimals." },
                  { name: "currency", type: "string", required: "No", desc: "Always UGX (default)." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Customer's MTN or Airtel number: 0772123456, 772123456 or 256772123456." },
                  { name: "customer_name", type: "string", required: "Yes", desc: "Customer's full name." },
                  { name: "customer_email", type: "string", required: "Yes", desc: "Customer's email (for the receipt)." },
                  { name: "reference", type: "string", required: "No", desc: "Your unique order id (max 40 chars). Reusing one is refused." },
                  { name: "callback_url", type: "string", required: "Recommended", desc: "Public https:// URL that receives the signed result." },
                  { name: "description", type: "string", required: "No", desc: "Shown to the customer." },
                  { name: "redirect_url", type: "string", required: "No", desc: "Where to send the customer if a payment page is needed." },
                  { name: "metadata", type: "object", required: "No", desc: "Any data you want back, returned in the callback." },
                ]}
              />
              <p className={P}>You can also send the customer as an object: <code className={C}>{'"customer": { "name", "email", "phone" }'}</code>.</p>
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": {
    "reference": "ORDER-1001",
    "status": "pending",
    "prompt_sent": true,
    "message": "A PIN prompt was sent to the customer's phone.",
    "checkout_url": null,
    "amount": 1000,
    "currency": "UGX",
    "type": "collection"
  }
}`}
              />
              <Note>
                If <code className={C}>prompt_sent</code> is <code className={C}>false</code>, redirect the customer to{" "}
                <code className={C}>checkout_url</code> to finish paying. Show "Check your phone and enter your PIN" while you wait.
              </Note>
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
    phone_number: "0772123456",
    customer_name: "Jane Nakato",
    customer_email: "jane@example.com",
    reference: "ORDER-1001",
    callback_url: "https://yoursite.com/obpay/callback",
  }),
});
const { success, data, error } = await res.json();
if (!success) throw new Error(error);
if (!data.prompt_sent && data.checkout_url) {
  // redirect the customer to data.checkout_url
}`}
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
    "phone_number" => "0772123456",
    "customer_name" => "Jane Nakato",
    "customer_email" => "jane@example.com",
    "reference" => "ORDER-" . time(),
    "callback_url" => "https://yoursite.com/obpay/callback.php",
  ]),
]);
$res = json_decode(curl_exec($ch), true);
if (!$res["success"]) { echo $res["error"]; exit; }
if (!$res["data"]["prompt_sent"] && $res["data"]["checkout_url"]) {
  header("Location: " . $res["data"]["checkout_url"]); exit;
}
echo "Check your phone and enter your PIN.";`}
              />
              <CodeBlock
                title="Python"
                code={`import os, requests

r = requests.post(
    "${BASE}/collect",
    headers={"Authorization": f"Bearer {os.environ['OBPAY_SECRET_KEY']}"},
    json={
        "amount": 5000,
        "phone_number": "0772123456",
        "customer_name": "Jane Nakato",
        "customer_email": "jane@example.com",
        "reference": "ORDER-1001",
        "callback_url": "https://yoursite.com/obpay/callback",
    },
    timeout=30,
)
print(r.json())`}
              />
            </section>
          )}

          {active === "payouts" && (
            <section className="space-y-3">
              <Header icon="ri-upload-cloud-line" label="Send money" subtitle={`POST ${BASE}/payouts`} />
              <p className={P}>
                Sends money from your ObPay balance to an MTN or Airtel mobile money number. The transfer fee is taken
                out of the amount, so sending 10,000 deducts 10,000 from your balance and the recipient gets 10,000 minus the fee.
                The response shows <code>fee</code> and <code>recipient_gets</code>. Minimum payout is <strong>UGX 10,000</strong>. Bank payouts are not available yet.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "integer", required: "Yes", desc: "Whole UGX amount taken from your balance (fee included)." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Recipient's MTN or Airtel number, e.g. 0772123456." },
                  { name: "customer_name", type: "string", required: "Yes", desc: "Recipient's name as registered on the wallet." },
                  { name: "reference", type: "string", required: "No", desc: "Your unique payout id." },
                  { name: "callback_url", type: "string", required: "Recommended", desc: "Receives payout.success / payout.failed." },
                  { name: "description", type: "string", required: "No", desc: "For your records." },
                  { name: "metadata", type: "object", required: "No", desc: "Returned in the callback." },
                ]}
              />
              <CodeBlock
                title="cURL"
                code={`curl -X POST ${BASE}/payouts \\
  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 20000,
    "phone_number": "0772123456",
    "customer_name": "John Okello",
    "reference": "PAYOUT-77",
    "callback_url": "https://yoursite.com/obpay/callback"
  }'`}
              />
              <CodeBlock title="Response 200" code={`{\n  "success": true,\n  "data": { "reference": "PAYOUT-77", "status": "pending", "amount": 20000, "currency": "UGX", "type": "payout" }\n}`} />
              <Note tone="warn">A payout larger than your available balance is refused with "Insufficient balance".</Note>
            </section>
          )}

          {active === "status" && (
            <section className="space-y-3">
              <Header icon="ri-search-eye-line" label="Check a payment" subtitle={`GET ${BASE}/transactions/{reference}`} />
              <p className={P}>
                Returns one collection or payout. If it is still pending, ObPay checks the mobile money network live
                before answering. <strong>Always call this before delivering goods</strong>, even after a callback.
              </p>
              <CodeBlock title="cURL" code={`curl ${BASE}/transactions/ORDER-1001 \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY"`} />
              <CodeBlock
                title="Response 200"
                code={`{
  "success": true,
  "data": {
    "reference": "ORDER-1001",
    "type": "collection",
    "status": "success",
    "amount": 5000,
    "fee_amount": 0,
    "net_amount": 5000,
    "currency": "UGX",
    "phone_number": "0772123456",
    "settled_at": "2026-09-26T11:02:41Z"
  }
}`}
              />
              <p className={P}>
                Statuses: <code className={C}>pending</code>, <code className={C}>success</code>, <code className={C}>failed</code>.
                If you don't use callbacks, poll every 5–10 seconds for up to 3 minutes.
              </p>
            </section>
          )}

          {active === "transactions" && (
            <section className="space-y-3">
              <Header icon="ri-list-check-2" label="List transactions" subtitle={`GET ${BASE}/transactions`} />
              <Table
                rows={[
                  { name: "type", type: "string", required: "No", desc: "collection or payout" },
                  { name: "status", type: "string", required: "No", desc: "pending, success or failed" },
                  { name: "limit", type: "integer", required: "No", desc: "1–200, default 50" },
                  { name: "page", type: "integer", required: "No", desc: "Starts at 1" },
                ]}
              />
              <CodeBlock title="cURL" code={`curl "${BASE}/transactions?type=collection&status=success&limit=20" \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY"`} />
            </section>
          )}

          {active === "balance" && (
            <section className="space-y-3">
              <Header icon="ri-wallet-3-line" label="Balance & account" subtitle={`GET ${BASE}/balance`} />
              <CodeBlock title="cURL" code={`curl ${BASE}/balance -H "Authorization: Bearer $OBPAY_SECRET_KEY"`} />
              <CodeBlock title="Response 200" code={`{\n  "success": true,\n  "data": { "currency": "UGX", "collected": 150000, "paid_out": 40000, "net": 110000 }\n}`} />
              <p className={P}><code className={C}>net</code> is what you can pay out. <code className={C}>GET /account</code> returns your merchant id and counts.</p>
            </section>
          )}

          {active === "countries" && (
            <section className="space-y-4">
              <h2 className="font-heading font-bold text-xl">Countries, crypto & rates</h2>
              <p className="text-sm">Pass <code>currency</code> on <code>/collect</code> and <code>/payout</code>. Amounts are whole numbers (USD allows cents).</p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                <li><b>UGX</b> Uganda – MTN, Airtel (<code>network: "mtn" | "airtel"</code>), phone <code>2567XXXXXXXX</code>. Payout min 10,000.</li>
                <li><b>KES</b> Kenya – M-Pesa PIN prompt (<code>network: "mpesa"</code>), phone <code>2547XXXXXXXX</code>. Payout min 500.</li>
                <li><b>RWF</b> Rwanda – MTN, Airtel, phone <code>2507XXXXXXXX</code>. Payout min 2,000.</li>
                <li><b>USD</b> crypto – set <code>crypto: true</code>; the response has <code>checkout_url</code> for the customer to pay in coins. Credits your USD balance.</li>
              </ul>
              <CodeBlock title="Kenya collection" code={`curl -X POST ${BASE}/collect \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" -H "Content-Type: application/json" \\\n  -d '{"currency":"KES","amount":100,"phone_number":"254712345678","network":"mpesa","customer_name":"Jane W","customer_email":"jane@example.com"}'`} />
              <CodeBlock title="Crypto collection" code={`curl -X POST ${BASE}/collect \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" -H "Content-Type: application/json" \\\n  -d '{"currency":"USD","crypto":true,"amount":5,"customer_name":"Sam","customer_email":"sam@example.com"}'`} />
              <p className="text-sm"><code>GET /rates</code> returns live rates against USD. <code>GET /payout-methods?currency=KES</code> returns availability, minimum and fees.</p>
            </section>
          )}

          {active === "refunds" && (
            <section className="space-y-4">
              <h2 className="font-heading font-bold text-xl">Refunds</h2>
              <p className="text-sm"><code>POST /refunds</code> sends money back to the phone that paid a successful collection. Omit <code>amount</code> for a full refund. It is paid from your balance and the normal payout fee applies. Status updates arrive as <code>payout.success</code> / <code>payout.failed</code> webhooks with the returned <code>refund_reference</code>.</p>
              <CodeBlock title="Refund" code={`curl -X POST ${BASE}/refunds \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" -H "Content-Type: application/json" \\\n  -d '{"reference":"OBP123ABC","amount":5000,"reason":"Order cancelled"}'`} />
              <p className="text-sm"><code>GET /refunds</code> lists refundable payments and past refunds.</p>
            </section>
          )}

          {active === "links" && (
            <section className="space-y-3">
              <Header icon="ri-links-line" label="Payment links" subtitle={`POST ${BASE}/payment-links`} />
              <p className={P}>
                A payment link is a ready-made ObPay payment page (<code className={C}>https://obpay.online/pay/your-slug</code>)
                you can share on WhatsApp, SMS or social media. No code is needed on your side.
              </p>
              <Table
                rows={[
                  { name: "title", type: "string", required: "Yes", desc: "Shown on the payment page." },
                  { name: "amount", type: "integer", required: "No", desc: "Fixed amount. Leave out to let the payer choose." },
                  { name: "description", type: "string", required: "No", desc: "Extra text on the page." },
                  { name: "slug", type: "string", required: "No", desc: "Custom URL ending." },
                  { name: "redirect_url", type: "string", required: "No", desc: "Where to send the payer after success." },
                ]}
              />
              <CodeBlock
                title="cURL"
                code={`curl -X POST ${BASE}/payment-links \\
  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "title": "School fees", "amount": 50000 }'`}
              />
              <p className={P}>
                Pause or resume with <code className={C}>{'PATCH /payment-links/{id}'}</code> and{" "}
                <code className={C}>{'{ "status": "paused" }'}</code> or <code className={C}>"active"</code>.
              </p>
            </section>
          )}

          {active === "webhooks" && (
            <section className="space-y-3">
              <Header icon="ri-webhook-line" label="Webhooks & signing" />
              <p className={P}>
                No webhook setup is needed. Send a <code className={C}>callback_url</code> with each collection or payout.
                When the payment finishes, ObPay POSTs the result there, signed with your{" "}
                <strong>Webhook signing secret</strong> (Dashboard → API Keys).
              </p>
              <CodeBlock
                title="What ObPay sends"
                code={`POST /obpay/callback
Content-Type: application/json
X-ObPay-Event: collection.success
X-ObPay-Signature: 5f2b9c…e41a   (HMAC-SHA256 hex of the raw body)

{
  "event": "collection.success",
  "created_at": "2026-09-26T11:02:41.000Z",
  "data": {
    "reference": "ORDER-1001",
    "type": "collection",
    "status": "success",
    "amount": 5000,
    "fee": 0,
    "net_amount": 5000,
    "currency": "UGX",
    "phone_number": "0772123456",
    "metadata": { "order_id": 1001 }
  }
}`}
              />
              <p className={P}>
                Events: <code className={C}>collection.success</code>, <code className={C}>collection.failed</code>,{" "}
                <code className={C}>payout.success</code>, <code className={C}>payout.failed</code>.
              </p>
              <CodeBlock
                title="PHP — verify"
                code={`<?php
$raw      = file_get_contents('php://input');
$received = $_SERVER['HTTP_X_OBPAY_SIGNATURE'] ?? '';
$expected = hash_hmac('sha256', $raw, getenv('OBPAY_WEBHOOK_SECRET'));

if (!hash_equals($expected, $received)) { http_response_code(401); exit; }

$event = json_decode($raw, true);
// Look up the order by $event['data']['reference'], skip if already paid,
// confirm with GET /transactions/{reference}, then fulfil.
http_response_code(200);`}
              />
              <CodeBlock
                title="Node.js (Express) — verify"
                code={`import crypto from "crypto";
import express from "express";
const app = express();

app.post("/obpay/callback", express.raw({ type: "application/json" }), (req, res) => {
  const expected = crypto
    .createHmac("sha256", process.env.OBPAY_WEBHOOK_SECRET)
    .update(req.body)            // raw Buffer — do NOT JSON.parse first
    .digest("hex");
  const got = req.get("X-ObPay-Signature") || "";
  if (got.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected))) {
    return res.sendStatus(401);
  }
  const event = JSON.parse(req.body.toString());
  res.sendStatus(200);           // reply fast, then do the work
});`}
              />
              <CodeBlock
                title="Python (Flask) — verify"
                code={`import hmac, hashlib, os
from flask import Flask, request, abort
app = Flask(__name__)

@app.post("/obpay/callback")
def obpay_callback():
    raw = request.get_data()
    expected = hmac.new(os.environ["OBPAY_WEBHOOK_SECRET"].encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-ObPay-Signature", "")):
        abort(401)
    event = request.get_json()
    return "", 200`}
              />
              <Note tone="warn">
                <ul className="list-disc pl-5 space-y-1">
                  <li>Your callback URL must be public <strong>https://</strong> and must <strong>not redirect</strong> (a 301/302 counts as failed).</li>
                  <li>Reply with HTTP 200 within 8 seconds. Failed deliveries are retried up to 3 times.</li>
                  <li>Expect duplicates — check whether the order is already paid.</li>
                  <li>Verify the signature on the <strong>raw</strong> body, before parsing JSON.</li>
                </ul>
              </Note>
              <p className={P}>See recent deliveries and your server's replies with <code className={C}>GET /webhook-deliveries</code>.</p>
            </section>
          )}

          {active === "errors" && (
            <section className="space-y-3">
              <Header icon="ri-error-warning-line" label="Errors & limits" />
              <div className="overflow-x-auto rounded-xl border border-background-200">
                <table className="w-full text-sm">
                  <thead className="bg-background-50 text-left text-foreground-500">
                    <tr><th className="px-3 py-2">HTTP</th><th className="px-3 py-2">Meaning</th><th className="px-3 py-2">What to do</th></tr>
                  </thead>
                  <tbody className="divide-y divide-background-100 text-foreground-600">
                    <tr><td className="px-3 py-2">200 + success:false</td><td className="px-3 py-2">Request refused (bad field, low balance, used reference)</td><td className="px-3 py-2">Show <code className={C}>error</code> to the user and fix the input</td></tr>
                    <tr><td className="px-3 py-2">400</td><td className="px-3 py-2">Body is not valid JSON</td><td className="px-3 py-2">Send <code className={C}>Content-Type: application/json</code></td></tr>
                    <tr><td className="px-3 py-2">401</td><td className="px-3 py-2">Missing or invalid secret key</td><td className="px-3 py-2">Check the Authorization header</td></tr>
                    <tr><td className="px-3 py-2">404</td><td className="px-3 py-2">Unknown endpoint or reference</td><td className="px-3 py-2">Check the URL and method</td></tr>
                    <tr><td className="px-3 py-2">429</td><td className="px-3 py-2">More than 90 requests per minute</td><td className="px-3 py-2">Wait a minute; use callbacks instead of fast polling</td></tr>
                  </tbody>
                </table>
              </div>
              <p className={P}>Always check <code className={C}>success</code> in the JSON, not only the HTTP status.</p>
            </section>
          )}

          {active === "going-live" && (
            <section className="space-y-3">
              <Header icon="ri-rocket-line" label="Going live checklist" />
              <ol className="space-y-2 text-sm text-foreground-600 list-decimal pl-5">
                <li>Complete verification (KYC) in the dashboard.</li>
                <li>Create a live API key and copy your webhook signing secret into your server's environment.</li>
                <li>Call <code className={C}>GET /ping</code> from your server.</li>
                <li>Make a callback endpoint that verifies <code className={C}>X-ObPay-Signature</code> and returns 200 without redirecting.</li>
                <li>Run one small real collection (e.g. UGX 1,000) and one payout of at least UGX 10,000.</li>
                <li>Handle pending, success and failed in your code, and confirm with <code className={C}>{'GET /transactions/{reference}'}</code> before delivering.</li>
              </ol>
              <Note>Need help? Contact support from your dashboard and include the payment reference.</Note>
            </section>
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
