import { useEffect, useState } from "react";
import { Link } from "@/lib/router-compat";
import Navbar from "@/components/feature/Navbar";
import Footer from "@/components/feature/Footer";
import { JsonLd } from "@/components/base/JsonLd";
import IntegrationDemo from "@/components/feature/IntegrationDemo";
import { MONEY_COUNTRIES } from "@/lib/countries";
const COUNTRY_NAMES = MONEY_COUNTRIES.map((c) => c.country);
const COUNTRY_AND = `${COUNTRY_NAMES.slice(0, -1).join(", ")} and ${COUNTRY_NAMES[COUNTRY_NAMES.length - 1]}`;
const COUNTRY_OR = `${COUNTRY_NAMES.slice(0, -1).join(", ")} or ${COUNTRY_NAMES[COUNTRY_NAMES.length - 1]}`;

const BASE = "https://obpay.online/api/public/v1";

type SectionId =
  | "overview"
  | "services"
  | "banks"
  | "operating"
  | "quickstart"
  | "subscriptions"
  | "testing"
  | "settlement"
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
  { id: "banks", label: "Bank payments", icon: "ri-bank-line" },
  { id: "services", label: "Card payments", icon: "ri-apps-line" },
  { id: "overview", label: "Overview", icon: "ri-home-4-line" },
  { id: "operating", label: "How ObPay works", icon: "ri-compass-3-line" },
  { id: "quickstart", label: "Quick start", icon: "ri-flashlight-line" },
  { id: "subscriptions", label: "Subscriptions & consent", icon: "ri-calendar-check-line" },
  { id: "testing", label: "Testing & demonstration", icon: "ri-flask-line" },
  { id: "settlement", label: "Settlement & custody", icon: "ri-bank-line" },
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
    <div className="bg-inverse text-on-inverse rounded-xl overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2.5 bg-on-inverse/10 border-b border-on-inverse/20">
        <span className="text-xs text-on-inverse/80 font-mono">{title || "Terminal"}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="text-xs text-on-inverse/80 hover:text-on-inverse cursor-pointer"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-[12.5px] leading-relaxed text-on-inverse font-mono whitespace-pre">
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
  { m: "GET", p: "/services/banks/catalog", d: "Bank capability status; currently disabled pending contract." },
  { m: "GET", p: "/services/banks/accounts", d: "Your retained saved bank accounts; no payment or automatic credit." },
  { m: "GET", p: "/services", d: "Current payment service availability." },
  { m: "POST", p: "/services/cards", d: "Hosted card checkout in USD, KES or NGN." },
  { m: "GET", p: "/services/history", d: "Historical discontinued services and restricted UGX card funds." },
  { m: "GET", p: "/ping", d: "Check that your key works." },
  { m: "GET", p: "/account", d: "Your merchant id and counts." },
  { m: "GET", p: "/balance", d: "Collected, paid out and available balance." },
  { m: "POST", p: "/collect", d: "Send a PIN prompt to a customer's MTN or Airtel phone." },
  { m: "POST", p: "/payouts", d: `Send money to a mobile money number in ${COUNTRY_OR}.` },
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
          headline: "ObPay API documentation",
          description: `Receive and send mobile money in ${COUNTRY_AND} with the ObPay REST API.`,
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
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-card-foreground text-foreground-600 hover:bg-background-100 border border-background-200"
                }`}
              >
                <i className={s.icon} />
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="bg-card text-card-foreground rounded-2xl border border-background-200 p-4 sm:p-8 min-w-0 space-y-4">
          {active === "banks" && <section className="space-y-4">
            <Header icon="ri-bank-line" label="Bank payments" />
            <p className={P}>Send UGX from your ObPay wallet to any supported Ugandan bank account, automatically. Always list banks, verify the account, read the live fee, then send with a unique reference. Receiving bank payments into an ObPay wallet is not available yet.</p>
            <CodeBlock title="1. Banks and live fee" code={`GET ${BASE}/services/banks
GET ${BASE}/services/banks/catalog
Authorization: Bearer $OBPAY_SECRET_KEY

{"success":true,"data":{"bank_transfer_available":true,"bank_transfer_settings":{...}}}`} />
            <CodeBlock title="2. Verify the recipient" code={`POST ${BASE}/services/banks/validate
{"bank_name":"Stanbic Bank","account_number":"9030012345678"}

{"success":true,"data":{"account_name":"JANE NAKATO","valid":true}}`} />
            <CodeBlock title="3. Send" code={`POST ${BASE}/services/banks/transfers
{"reference":"550e8400-e29b-41d4-a716-446655440000","amount":100000,"bank_name":"Stanbic Bank",
 "bank_account_number":"9030012345678","bank_branch":"Kampala Road","confirmed_name":"JANE NAKATO",
 "expected_fee":3000,"description":"Supplier payment"}`} />
            <p className={P}>The amount plus the exact fee is reserved from your UGX wallet before sending. If the fee changed or the name does not match the verified name, the request is refused and no money moves. Reuse the same reference to read status: GET /services/status/REFERENCE. Never resend with a new reference after an unclear result.</p>
            <CodeBlock title="Saved receiving accounts" code={`GET ${BASE}/services/banks/accounts
POST ${BASE}/services/banks/accounts  {"bank_name":"...","account_number":"..."}
DELETE ${BASE}/services/banks/accounts/ACCOUNT_UUID`} />
            <Note tone="warn">POST /services/banks/collect returns bank_contract_required: the bank network offers no documented way to receive bank payments into ObPay, so bank payment links are not offered. Use mobile money or card payment links to receive money.</Note>
            <Note tone="warn">No bank payment URL, beneficiary fields, fee quote, success response or automatic settlement is invented. Generic hosted checkout is not documented bank collection. Bank operations require the network’s official bank-specific endpoints, supported currencies, account validation, fee evidence and verification contract before activation.</Note>
            <p className={P}><Link to="/dashboard/bank-transfer" className="text-primary underline">Bank payments workspace</Link> · <Link to="/dashboard/service-history" className="text-primary underline">Historical records</Link></p>
          </section>}
          {active === "services" && <section className="space-y-4">
            <Header icon="ri-bank-card-line" label="Card payments" />
            <p className={P}>Accept card payments through hosted checkout in USD, KES and NGN. Existing mobile-money collections and payouts are unchanged. Bank collections and disbursements are awaiting a new connection; airtime, data and bill-payment operations are discontinued.</p>
            <Table rows={[
              {name:"currency",type:"string",required:"Yes",desc:"USD (minimum 0.50), KES (minimum 1) or NGN (minimum 100). UGX card payments are not supported."},
              {name:"amount",type:"number",required:"Yes",desc:"Main currency unit. USD permits two decimal places; KES and NGN require whole amounts."},
              {name:"customer_name",type:"string",required:"Yes",desc:"Customer full name."},
              {name:"customer_email",type:"string",required:"Yes",desc:"Valid customer email."},
              {name:"phone_number",type:"string",required:"KES only",desc:"Kenyan phone number required by checkout; no mobile-money PIN prompt is sent."},
              {name:"reference",type:"string",required:"Recommended",desc:"Unique payment reference. Keep it after a timeout; never resubmit with a new reference before checking status."},
              {name:"callback_url",type:"string",required:"Optional",desc:"Public HTTPS merchant notification address; existing webhook rules apply."},
              {name:"redirect_url",type:"string",required:"Optional",desc:"Return page after checkout; a redirect is never proof of payment."},
            ]}/>
            <CodeBlock title="Create hosted card checkout" code={`curl -X POST "${BASE}/services/cards" \
  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"CARD_ORDER_1001","amount":20,"currency":"USD","customer_name":"Jane Nakato","customer_email":"jane@example.com","description":"Order 1001"}'`} />
            <p className={P}>Alternatively call POST /collect with the same fields plus payment_method: "card". Redirect the payer to data.checkout_url and let them select card. Checkout may offer other supported methods; a requested card checkout does not prove the final payment method. Never collect card numbers, CVV or PINs in ObPay or your own forms. Currency access depends on the connected account's enabled currencies.</p>
            <CodeBlock title="Pending response and confirmation" code={`{"success":true,"data":{"reference":"CARD_ORDER_1001","amount":20,"currency":"USD","status":"pending","type":"collection","prompt_sent":false,"checkout_url":"https://payment-network.example/checkout"}}

GET /transactions/CARD_ORDER_1001
GET /balance?currency=USD`} />
            <p className={P}>The checkout address above is illustrative; always use the returned URL. Payment remains pending until network verification matches its reference, exact amount and currency. Existing signed merchant notifications and transaction lookups apply. Verified proceeds are credited once to the same-currency wallet, less verified network charges and the configured ObPay collection fee. Fee exemptions are preserved; missing charge evidence defers credit.</p>
            <Note tone="warn">A successful creation response, checkout redirect or browser message does not confirm receipt. Verify GET /transactions/REFERENCE before delivering goods. After an uncertain request, check the same reference and do not charge again.</Note>
            <Header icon="ri-history-line" label="Discontinued services and historical funds" />
            <p className={P}>New bank transfers, bank verification, receiving-account registration, airtime, data and bill payments are disabled. Existing saved receiving accounts and historical service records are retained. GET /services/history remains read-only; legacy pending obligations retain verification-only reconciliation. Legacy restricted UGX card funds are not converted, merged or relabeled as new USD, KES or NGN proceeds. No bank collection or automatic bank-to-wallet credit endpoint is offered.</p>
            <p className={P}><Link to="/dashboard/cards" className="text-primary underline">Card payments</Link> · <Link to="/dashboard/service-history" className="text-primary underline">Historical service records</Link></p>
          </section>}
          {active === "overview" && (
            <section className="space-y-4">
              <Header icon="ri-home-4-line" label="ObPay API" subtitle={`Base URL: ${BASE}`} />
              <p className={P}>
                Receive and send mobile money in {COUNTRY_AND} from your own website or app. Every
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

          {active === "operating" && (
            <section className="space-y-3">
              <Header icon="ri-compass-3-line" label="How to operate ObPay" />
              <p className={P}>
                Use these steps in order. A payment is complete only when its status is confirmed and the correct
                currency wallet is credited — never deliver an order on a pending payment.
              </p>
              <ol className="list-decimal pl-5 space-y-4 text-sm text-foreground-600">
                <li>
                  <strong>Verify your account.</strong> Sign in and open{" "}
                  <Link to="/dashboard/kyc" className="text-primary-600 font-semibold hover:underline">Dashboard → Verification</Link>.
                  Personal accounts submit a national ID (front and back); business accounts submit their registration
                  certificate. Review status is shown on the same page, and you get an email when it changes.
                </li>
                <li>
                  <strong>Choose your country and wallets.</strong> The country you picked at sign-up sets your main
                  currency wallet. Add or remove extra currency wallets any time in{" "}
                  <Link to="/dashboard/settings" className="text-primary-600 font-semibold hover:underline">Settings → Currency wallets</Link>.
                  Each wallet holds its own balance; switching the wallet selector only changes which balance you view —
                  it never converts money. Converting between currencies is done on the Exchange page.
                </li>
                <li>
                  <strong>Receive money.</strong> From{" "}
                  <Link to="/dashboard/collections" className="text-primary-600 font-semibold hover:underline">Dashboard → Collections</Link>{" "}
                  request a mobile money payment (the payer gets a PIN prompt on their MTN or Airtel phone), or share a
                  payment link that needs no code. Developers can send the same requests from their own server with the
                  REST API — see Quick start below.
                </li>
                <li>
                  <strong>Wait for confirmation.</strong> Every payment starts as <code className={C}>pending</code> and
                  becomes <code className={C}>success</code> or <code className={C}>failed</code> after network verification.
                  Wallet credit requires verified success and confirmed fees. A pending response or receipt alone is not proof of available funds.
                </li>
                <li>
                  <strong>Connect your website (optional).</strong> Create a secret key on{" "}
                  <Link to="/dashboard/api-keys" className="text-primary-600 font-semibold hover:underline">Dashboard → API Keys</Link>,
                  save it on your server, and follow the API sections in this documentation. The full secret key is shown
                  only once when you create it.
                </li>
                <li>
                  <strong>Track and withdraw.</strong> Follow every payment in{" "}
                  <Link to="/dashboard/transactions" className="text-primary-600 font-semibold hover:underline">Dashboard → Transactions</Link>.
                  To withdraw, open{" "}
                  <Link to="/dashboard/payouts" className="text-primary-600 font-semibold hover:underline">Withdrawals</Link>{" "}
                  and send to MTN or Airtel mobile money. Your saved fee choice determines whether fees are added to the
                  wallet debit or deducted from the submitted amount. Completion depends on network confirmation; no fixed delivery time is guaranteed.
                </li>
              </ol>
              <Note>
                Stuck on a step? Contact support from your dashboard with the payment reference (e.g.{" "}
                <code className={C}>OBP123ABC</code>) and the time it happened — support replies fastest with those two
                details.
              </Note>
            </section>
          )}

          {active === "quickstart" && (
            <section className="space-y-3">
              <Header icon="ri-flashlight-line" label="Quick start" />
              <p className={P}>Start with the no-money simulation in <Link to="/dashboard/api-sandbox" className="text-primary underline">Integration testing</Link>. The public API is live; test keys cannot access it.</p>
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

          {active === "subscriptions" && <section className="space-y-4">
            <Header icon="ri-calendar-check-line" label="Subscriptions & customer consent" />
            <p className={P}>Uganda mobile-money collections require the customer to approve each payment on the MTN or Airtel SIM. ObPay does not currently offer an unattended recurring debit, saved mobile-money mandate or subscription scheduling endpoint.</p>
            <ol className="list-decimal pl-5 space-y-3 text-sm text-foreground-600">
              <li>Your application stores subscription plans, customer consent, invoice dates and cancellation preferences.</li>
              <li>Each month, notify the customer and request that month's payment through <code className={C}>POST /collect</code>, using UGX and a distinct invoice reference.</li>
              <li>The customer approves on their own phone. Never ask for, store or forward a mobile-money PIN.</li>
              <li>Verify the signed notification and read <code className={C}>GET /transactions/REFERENCE</code>. Match reference, collection type, currency and amount to the invoice; activate the subscription once only after success.</li>
              <li>Handle declined, pending and timed-out requests without granting paid access. Check an uncertain request using its original reference before attempting another charge; reminders and cancellation remain in your application.</li>
            </ol>
            <CodeBlock title="Monthly invoice collection — live API example" code={`POST /collect
{"reference":"PESA-INV-2026-11-001","amount":5000,"currency":"UGX","phone_number":"256772123456","customer_name":"Jane Nakato","customer_email":"jane@example.com","description":"November subscription invoice","metadata":{"invoice_id":"2026-11-001"},"callback_url":"https://your-domain.example/payments/obpay"}`} />
          </section>}

          {active === "testing" && <section className="space-y-4">
            <Header icon="ri-flask-line" label="Testing & technical demonstration" />
            <IntegrationDemo />
            <p className={P}>Open <Link to="/dashboard/api-sandbox" className="text-primary underline">Dashboard → Integration testing</Link>. Simulation is the default and needs no credentials. It demonstrates pending initiation and successful reference lookup locally; it does not call a payment network, send signed webhooks, calculate real charges or credit any wallet. Its sample balance is fixed demonstration data.</p>
            <p className={P}>There is no external no-money sandbox API at present. A test key is not a live credential. Create your own live key and webhook signing secret in <Link to="/dashboard/api-keys" className="text-primary underline">API Keys</Link>; keep both on your server and never share them by email or support chat.</p>
            <ol className="list-decimal pl-5 space-y-3 text-sm text-foreground-600">
              <li>Simulate a collection with a reference such as PESA-DEMO-001. Check that same reference to demonstrate the transition from pending to success.</li>
              <li>Prepare an HTTPS callback that verifies the raw-body signature and safely handles duplicates; test invalid signatures and mismatched invoice amounts on your own server.</li>
              <li>Agree a real test amount and authorised recipient with ObPay support. A live demonstration is chargeable and requires a verified account, customer PIN approval and sufficient funds for payout plus fees.</li>
              <li>Read current UGX payout rules, then demonstrate a real collection, signed callback, verified transaction, net wallet credit, payout debit, recipient receipt and final status.</li>
              <li>Reconcile each reference and its gross amount, fees, wallet credit or debit. Check pending and failed outcomes before production use.</li>
            </ol>
            <p className={P}>Arrange the demonstration with ObPay Support: <a href="tel:+256745482977" className="text-primary underline">+256 745 482977</a>. A demonstration has not been booked or completed by viewing this guide.</p>
          </section>}

          {active === "settlement" && <section className="space-y-4">
            <Header icon="ri-bank-line" label="Uganda settlement, fees & custody" />
            <p className={P}>UGX collections and payouts support MTN Mobile Money Uganda and Airtel Money Uganda. Use the registered recipient name and the SIM's mobile-money number. Availability is subject to network service and account eligibility.</p>
            <p className={P}>Collection settlement into the ObPay ledger requires successful network verification, confirmed charges and an atomic wallet credit. A wallet credit is not the same as delivery to an external mobile-money account. Payout funds are reserved before submission; a confirmed failed payout releases the reservation once. An uncertain payout must be investigated, not resent with a new reference.</p>
            <p className={P}>Current standard ObPay collection and payout rates are listed on the <Link to="/pricing" className="text-primary underline">live transaction-fees page</Link>. Collection credit equals the gross amount minus the verified network charge and ObPay margin, charged once. Merchant-specific exemptions remain applicable. Payouts include the ObPay charge plus the current network quote; the saved sender/recipient fee choice determines the wallet debit and recipient amount.</p>
            <CodeBlock title="Read current Uganda network minimum and charges" code={`curl "${BASE}/payout-methods?currency=UGX" \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY"`} />
            <p className={P}>Do not hardcode a minimum or promise instant settlement. Live minimums, fees and whole-amount checks determine whether an entered payout is accepted. The payout response reports fee, recipient_gets, total_debit and fee_mode. Status remains pending until verified; delays can occur during network outages, review or insufficient settlement funding.</p>
            <Note tone="warn">This API guide does not establish the legal custody entity, licence holder, safeguarding account, insurance or insolvency protection arrangements. Obtain written confirmation and supporting documents from ObPay's business team before production integration. Neither a wallet balance nor technical verification proves a segregated bank deposit or deposit insurance.</Note>
            <p className={P}>For custody and licensing documentation, contact ObPay Support on +256 745 482977 or obsfashions@zohomail.com. Do not treat undocumented processing-partner arrangements as a financial guarantee.</p>
          </section>}

          {active === "authentication" && (
            <section className="space-y-3">
              <Header icon="ri-shield-keyhole-line" label="Authentication" />
              <p className={P}>Send your secret key on every request, in either header:</p>
              <CodeBlock title="Headers" code={`Authorization: Bearer sk_live_xxxxxxxxxxxxxxxx\n# or\nX-API-Key: sk_live_xxxxxxxxxxxxxxxx\n\nContent-Type: application/json`} />
              <p className={P}>
                A missing or wrong key returns <code className={C}>401</code>. Revoked keys stop working immediately. There is
                no IP whitelist — your server can call from any address. Test keys are refused by the live API with HTTP 403.
              </p>
            </section>
          )}

          {active === "collect" && (
            <section className="space-y-3">
              <Header icon="ri-download-cloud-line" label="Receive money" subtitle={`POST ${BASE}/collect`} />
              <p className={P}>
                Sends a PIN prompt to the customer's phone: MTN or Airtel in Uganda, M-Pesa in Kenya, MTN or Airtel in
                Rwanda, and Airtel, MTN or Zamtel in Zambia. The customer enters their PIN and the money
                lands in your ObPay balance. The payment starts as <code className={C}>pending</code> and becomes{" "}
                <code className={C}>success</code> or <code className={C}>failed</code> — usually within a minute.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "integer", required: "Yes", desc: "Whole amount in the chosen currency, e.g. 5000. No decimals." },
                  { name: "currency", type: "string", required: "No", desc: "Supported currency (e.g. UGX, KES, RWF, ZMW). Defaults to UGX; always send ZMW for Zambia." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Customer's mobile money number: 0772123456 (UG), 0971234567 (ZM) or 256772123456." },
                  { name: "customer_name", type: "string", required: "Yes", desc: "Customer's full name." },
                  { name: "customer_email", type: "string", required: "Yes", desc: "Customer's email (for the receipt)." },
                  { name: "reference", type: "string", required: "No", desc: "Unique order id (max 40 chars). A retry returns the existing payment; never reuse it for another order." },
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
                Sends money from your ObPay balance to a mobile money number in {COUNTRY_OR}. The response
                shows <code>fee</code>, <code>recipient_gets</code>, <code>total_debit</code> and <code>fee_mode</code>.
                By default your wallet pays both fees on top; the recipient gets the entered amount. If you choose recipient-paid
                fees in account Settings or Payouts, both fees come out of the entered amount instead. API payouts use that saved choice.
                Minimums and network fees are live: check <code>GET /payout-methods?currency=ZMW</code>. Bank payouts are not available yet.
              </p>
              <Table
                rows={[
                  { name: "amount", type: "integer", required: "Yes", desc: "Whole amount in the chosen currency, taken from your balance." },
                  { name: "currency", type: "string", required: "No", desc: "UGX (default), KES, RWF or ZMW." },
                  { name: "phone_number", type: "string", required: "Yes", desc: "Recipient's mobile money number, e.g. 0772123456 (UG) or 0971234567 (ZM)." },
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
              <CodeBlock
                title="Zambia payout"
                code={`curl -X POST ${BASE}/payouts \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "amount": 100,\n    "currency": "ZMW",\n    "phone_number": "0971234567",\n    "customer_name": "Chanda Mwansa",\n    "reference": "PAYOUT-78",\n    "callback_url": "https://yoursite.com/obpay/callback"\n  }'`}
              />
              <p className={P}>
                Zambia numbers are <code className={C}>09XXXXXXXX</code> local or <code className={C}>2609XXXXXXXX</code> international,
                on Airtel, MTN or Zamtel. Amounts are whole ZMW; the last checked network minimum was <b>ZMW 30</b>, before ObPay's charge in recipient-paid mode. Confirm current availability, minimum and network fee with{" "}
                <code className={C}>GET /payout-methods?currency=ZMW</code> before going live.
              </p>
              <Note>
                With a 5 ZMW network fee and 5% ObPay fee, sending 50 ZMW in wallet-paid mode deducts 58 ZMW and pays 50 ZMW;
                recipient-paid mode deducts 50 ZMW and pays 42 ZMW. Actual fees follow live network rules and your currency's admin-set rate.
                Only your ZMW wallet funds this payout; UGX and other balances are not interchangeable. Check the ZMW entry in
                <code className={C}>GET /balance</code>'s <code className={C}>balances</code> array, not the top-level UGX balance.
              </Note>
              <CodeBlock title="Zambia deposit" code={`curl -X POST ${BASE}/collect \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"currency":"ZMW","amount":50,"phone_number":"0971234567","network":"airtel","customer_name":"Chanda Mwansa","customer_email":"chanda@example.com","reference":"ZMW-DEPOSIT-1001"}'`} />
              <Note tone="warn">
                HTTP 200 alone does not mean a payment succeeded: check <code className={C}>success</code> and
                <code className={C}>data.status</code>. A successful submission starts pending. Confirm the returned reference at
                <code className={C}>GET /transactions/REFERENCE</code> until success or failed. If submission is uncertain, do not
                retry with a new reference; contact support. Never send your secret key from browser code.
              </Note>
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
              <CodeBlock title="Rwanda wallet" code={`curl "${BASE}/balance?currency=RWF" -H "Authorization: Bearer $OBPAY_SECRET_KEY"`} />
              <p className={P}>Use <code className={C}>currency=RWF</code> for Rwanda (not RWD). The top-level balance then refers only to that currency; an empty wallet returns zero. The <code className={C}>balances</code> list still includes your other wallets. Pending payments are checked with the payment network before the balance is returned. This is your merchant balance, not the network’s shared account funds. Without a currency parameter, the existing default response is unchanged.</p>
            </section>
          )}

          {active === "countries" && (
            <section className="space-y-4">
              <h2 className="font-heading font-bold text-xl">Countries, crypto & rates</h2>
              <p className="text-sm">Pass <code>currency</code> on <code>/collect</code> and <code>/payouts</code>. Amounts are whole numbers (USD collections allow cents). Always check live payout rules and your saved fee choice.</p>
              <ul className="text-sm list-disc pl-5 space-y-1">
                <li><b>UGX</b> Uganda – MTN, Airtel (<code>network: "mtn" | "airtel"</code>), phone <code>2567XXXXXXXX</code>. Read the current payout minimum from <code>GET /payout-methods?currency=UGX</code>.</li>
                <li><b>KES</b> Kenya – M-Pesa PIN prompt (<code>network: "mpesa"</code>), phone <code>2547XXXXXXXX</code>. Payout min 500.</li>
                <li><b>RWF</b> Rwanda – MTN, Airtel, phone <code>2507XXXXXXXX</code>. Payout min 500.</li>
                <li><b>ZMW</b> Zambia – Airtel, MTN or Zamtel (<code>network: "airtel" | "mtn" | "zamtel"</code>), phone <code>2609XXXXXXXX</code>. Payout min 30, mobile money only. Whole amounts only.</li>
                <li><b>USD</b> crypto – set <code>crypto: true</code>; the response has <code>checkout_url</code> for the customer to pay in coins. Credits your USD balance.</li>
              </ul>
              <CodeBlock title="Kenya collection" code={`curl -X POST ${BASE}/collect \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" -H "Content-Type: application/json" \\\n  -d '{"currency":"KES","amount":100,"phone_number":"254712345678","network":"mpesa","customer_name":"Jane W","customer_email":"jane@example.com"}'`} />
              <CodeBlock title="Zambia payout" code={`curl -X POST ${BASE}/payouts \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" -H "Content-Type: application/json" \\\n  -d '{"currency":"ZMW","amount":100,"phone_number":"260971234567","network":"airtel","customer_name":"Chanda Mwansa"}'`} />
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
                  <li>Reply with HTTP 200 within 8 seconds. Delivery makes up to three total attempts; this is not a guaranteed background delivery queue. Use transaction lookup as a fallback.</li>
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
                <li>Start with no-money simulation, then agree a small real collection and a payout meeting the current UGX minimum, fees and whole-amount rules.</li>
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
