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
  { id: "services", label: "Banks, bills & cards", icon: "ri-apps-line" },
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
  { m: "GET", p: "/services", d: "Current additional service availability." },
  { m: "GET", p: "/services/airtime/catalog", d: "Uganda networks and live data bundles." },
  { m: "GET", p: "/services/bills/catalog", d: "Utilities and the current service fee." },
  { m: "POST", p: "/services/airtime", d: "Buy airtime or a data bundle." },
  { m: "POST", p: "/services/bills", d: "Pay a verified Uganda utility account." },
  { m: "POST", p: "/services/cards", d: "Create a hosted card collection in UGX." },
  { m: "GET", p: "/services/status/{reference}", d: "Reverify a service payment." },
  { m: "GET", p: "/services/history", d: "Latest 30 service payments and restricted card balance." },
  { m: "GET", p: "/services/airtime/network?msisdn=256771234567", d: "Detect the recipient mobile network." },
  { m: "GET", p: "/services/bills/areas", d: "Current NWSC areas." },
  { m: "GET", p: "/services/bills/packages?utility_code=DSTV", d: "Current DSTV or GOTV packages and prices." },
  { m: "POST", p: "/services/bills/verify", d: "Look up a utility account before confirming payment." },
  { m: "GET", p: "/services/banks", d: "Current supported banks." },
  { m: "GET", p: "/services/banks/catalog", d: "Bank-transfer availability and exact fee settings, if supplied." },
  { m: "POST", p: "/services/banks/validate", d: "Verify an active bank account and registered name." },
  { m: "POST", p: "/services/banks/transfers", d: "Submit an outgoing bank transfer with confirmed recipient and fee." },
  { m: "GET", p: "/services/banks/accounts", d: "List your saved receiving bank accounts." },
  { m: "POST", p: "/services/banks/accounts", d: "Network-verify and save a receiving bank account; no wallet credit." },
  { m: "DELETE", p: "/services/banks/accounts/{id}", d: "Remove one of your saved bank accounts." },
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
          {active === "services" && <section className="space-y-4">
            <Header icon="ri-apps-line" label="Bank accounts, transfers, bills, airtime & cards"/>
            <p className={P}>These additional services currently use UGX in Uganda. Existing mobile-money collections and payouts keep their current endpoints and fee rules. Bank transfers use a separate outgoing-transfer endpoint and require a live exact fee and a verified recipient. Saved receiving accounts do not create automatic incoming-payment collection or ObPay wallet credits. All service endpoints use the same live merchant secret; purchases require an active, identity-verified account.</p>
            <Table rows={[
              {name:"Airtime",type:"MTN / Airtel / Lyca",required:"UGX",desc:"Live network minimum; Lyca supports airtime only."},
              {name:"Data",type:"MTN / Airtel",required:"UGX",desc:"Use a live catalog product_id. Airtel delivery may remain pending."},
              {name:"Bills",type:"LIGHT / NWSC / DSTV / GOTV",required:"UGX",desc:"NWSC requires area. TV amount must match the live package price."},
              {name:"Cards",type:"Card collections",required:"UGX",desc:"Hosted checkout, 500–10,000,000 UGX. Card proceeds are restricted and separate; no card issuing."},
              {name:"Bank transfers",type:"Outgoing payments",required:"UGX",desc:"Verified account holder and exact live fee required. Unknown fee blocks submission."},
              {name:"Receiving accounts",type:"Saved bank details",required:"UGX",desc:"Verified accounts belonging to your merchant record; direct bank receipts do not credit the ObPay wallet."},
            ]}/>
            <CodeBlock title="Buy airtime" code={`curl -X POST "${BASE}/services/airtime" \\\n  -H "Authorization: Bearer $OBPAY_SECRET_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"reference":"550e8400-e29b-41d4-a716-446655440000","purchase_type":"airtime","msisdn":"256771234567","amount":5000}'`}/>
            <CodeBlock title="Buy a data bundle" code={`POST /services/airtime
{"reference":"660e8400-e29b-41d4-a716-446655440000","purchase_type":"bundle","msisdn":"256771234567","bundle_id":"RACT_UG_Data_201","expected_amount":1000}`}/>
            <p className={P}>Read <code className={C}>GET /services/airtime/catalog</code> first. Use the current product price as expected_amount; do not send amount for bundles. Server-side price checks reject changed prices without sending a purchase.</p>
            <CodeBlock title="Pay an electricity bill" code={`POST /services/bills
{"reference":"770e8400-e29b-41d4-a716-446655440000","utility_code":"LIGHT","meter_number":"12345678901","phone_number":"256771234567","amount":10000,"expected_fee":1200,"confirmed_name":"Jane Nakato"}`}/>
            <p className={P}>First call POST /services/bills/verify with utility_code, meter_number and area for NWSC. Read customer_details.customer_name (or customer_name) and require the customer to confirm it; submit that exact value as confirmed_name. Read the current bill fee from <code className={C}>GET /services/bills/catalog</code>; 1,200 above is an example, not a fixed guarantee. Minimum bill amount is 1,000 UGX. The wallet pays amount plus the verified service fee. Optional customer_name and email are supported. NWSC requires area; DSTV/GOTV require bouquet_code and its exact current price.</p>
            <CodeBlock title="Create a card collection" code={`POST /services/cards
{"reference":"880e8400-e29b-41d4-a716-446655440000","amount":5000,"description":"Order payment"}`}/>
            <p className={P}>Redirect the customer to the returned checkout_url. Never collect card numbers or PINs in your own form. Check <code className={C}>GET /services/status/REFERENCE</code> for verified confirmation. Card funds appear as card_balance in service history, not in the mobile-money balance endpoint. Contact customer service to withdraw card proceeds to a bank.</p>
            <Header icon="ri-bank-line" label="Bank integration" />
            <p className={P}>Read GET /services/banks for bank names, then GET /services/banks/catalog for bank_transfer_available and bank_transfer_settings. Fees may be unavailable even when the rail is enabled: do not guess. Fixed settings use fixed_transfer_charge or charge_amount; percentage settings use charge_percentage when amount_type is percentage. The amount plus its exact whole-UGX fee is reserved from your UGX wallet. A changed or fractional fee blocks submission.</p>
            <CodeBlock title="Verify a bank recipient — no money movement" code={`POST /services/banks/validate
{"bank_name":"Equity Bank","account_number":"60001256421"}

// Example verified response; never assume this name for a real recipient.
{"success":true,"data":{"valid":true,"account_name":"Jane Nakato"}}`} />
            <p className={P}>Only valid=true with a registered name permits saving or sending. A returned name without active registration is not verification. Display the verified name for explicit approval, then submit it as confirmed_name. The account is reverified before sending.</p>
            <CodeBlock title="Outgoing bank transfer — live, chargeable request" code={`POST /services/banks/transfers
{"reference":"990e8400-e29b-41d4-a716-446655440000","amount":100000,"description":"Invoice payment","bank_name":"Equity Bank","bank_account_number":"60001256421","bank_branch":"Kampala","confirmed_name":"Jane Nakato","expected_fee":50000}`} />
            <p className={P}>The 50,000 fee above is illustrative, not a guaranteed charge. Required fields are reference (UUID), amount (positive whole UGX), description (1–500 characters), bank_name (current list, up to 100 characters), bank_account_number (5–30 digits), confirmed_name and expected_fee (nonnegative whole UGX). bank_branch is optional, up to 100 characters. Do not use POST /payouts for bank transfers.</p>
            <CodeBlock title="Save receiving bank details — no payment or wallet credit" code={`POST /services/banks/accounts
{"bank_name":"Equity Bank","account_number":"60001256421","branch":"Kampala","currency":"UGX"}

GET /services/banks/accounts
DELETE /services/banks/accounts/ACCOUNT_UUID`} />
            <p className={P}>The server verifies the account and stores the bank-returned account_name; a supplied name or merchant_id cannot override it. branch is optional and currency defaults to UGX; other currencies are rejected. Creation returns data.account; listing returns data.accounts. Both include automatic_wallet_credit=false. Deletion returns data.id and removed=true. Your secret can only list or remove accounts belonging to your merchant. A duplicate saved account is rejected.</p>
            <Note tone="warn">There is no incoming bank-collection, virtual-account, bank-receipt webhook or automatic bank-to-wallet credit endpoint. Customers paying a saved bank account pay the bank directly; verify receipts with your bank. Saving an account does not establish settlement or make an unconfirmed bank account active.</Note>
            <Header icon="ri-search-eye-line" label="Service status and reconciliation" />
            <CodeBlock title="Status and history" code={`GET /services/status/990e8400-e29b-41d4-a716-446655440000
GET /services/history

// Example pending transfer response
{"success":true,"data":{"reference":"990e8400-e29b-41d4-a716-446655440000","amount":100000,"currency":"UGX","status":"pending","fee":50000,"net_amount":100000,"checkout_url":null}}`} />
            <p className={P}>Service responses include reference, amount, currency, status, fee, net_amount, description, msisdn, checkout_url and created_at; historical balance snapshots may be unavailable. Bank transfers have no mobile recipient, so msisdn may be null. History returns data.purchases (latest 30) and data.card_balance in UGX. Use the service status endpoint for airtime, bills, cards and bank transfers, not the primary-payment lookup. Status is pending, success or failed after matching network evidence; a successful request envelope is not proof of delivery. Poll with the same UUID, respect HTTP 429, and treat any success=false response as a refusal or uncertainty, even with HTTP 200. These services do not currently send merchant service webhooks or support callback_url; reconcile through status reads.</p>
            <Note tone="warn">Keep the same UUID reference when checking or retrying the same request. A timeout is not proof of failure: do not pay again with a new reference. Funds are reserved before service submission; confirmed failed purchases are refunded once. No unsigned callback credits a wallet. Pending services are rechecked through status and history reads.</Note>
            <p className={P}><Link to="/services" className="text-primary underline">Browse service pages</Link> · <Link to="/dashboard/service-history" className="text-primary underline">Service history</Link></p>
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
