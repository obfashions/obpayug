import { Link } from "@tanstack/react-router";
import PolicyLayout, { PolicyContact, type PolicySection } from "@/components/feature/PolicyLayout";

const sections: PolicySection[] = [
  { id: "about", title: "About these terms", content: <>
    <p>These terms cover your use of the ObPay website, merchant account, payment links and API. Read them with our <Link to="/privacy">Privacy Policy</Link> before creating an account. By agreeing at registration, you accept these terms.</p>
    <p>ObPay’s business location is Fort Portal, Uganda. Contact details for questions and complaints appear below.</p>
  </> },
  { id: "account", title: "Your account", content: <>
    <p>Provide accurate identity, business and contact information, and keep it up to date. Only act for a business if you are authorised to do so. Access to services may depend on identity verification, account approval and availability in your country.</p>
    <p>Keep your password, verification codes and API credentials private. You are responsible for the instructions you authorise and for access you give to your account. Contact us promptly if you suspect unauthorised access.</p>
  </> },
  { id: "payments", title: "Payments and balances", content: <>
    <p>ObPay supports the payment and service options shown for your account. Processing depends on the relevant payment network and service availability. A submitted or pending instruction is not proof that a payment has completed.</p>
    <p>Check the amount, currency, recipient details and service account before confirming. Keep the transaction reference if you need assistance. If an outcome is uncertain, check its status or contact support before submitting another instruction.</p>
    <p>Wallets are recorded separately by currency. An ObPay account balance is not a bank deposit or a statement of the payment network’s total funds. Funds awaiting verification may not yet be available to spend.</p>
  </> },
  { id: "fees", title: "Fees", content: <>
    <p>Applicable charges can include payment-network costs and ObPay fees. They vary by currency, service and any agreed account-specific arrangement. Consult the <Link to="/pricing">pricing page</Link> and the fee information for your transaction.</p>
    <p>Collection fees are deducted before funds are credited. For payouts, your selected fee mode determines whether fees are added to the wallet debit or deducted from the submitted amount. Check both the total debit and the recipient amount before confirming.</p>
    <p>Ask support to clarify any charge you do not understand before proceeding.</p>
  </> },
  { id: "disputes", title: "Failed payments, refunds and complaints", content: <>
    <p>Report an incorrect, failed or unauthorised transaction using its reference, date, amount and currency. Do not send your password, PIN or verification code.</p>
    <p>Payment status and any refund must be checked against transaction evidence. A pending payment is not automatically refundable, and recovery of a completed payment to an incorrect recipient cannot be guaranteed. Refunds and disputes depend on the transaction circumstances, applicable law and payment-network rules.</p>
    <p>You can raise a complaint using the contact details below or the <Link to="/support">support page</Link>. Your rights under applicable law are not excluded by these terms.</p>
  </> },
  { id: "restrictions", title: "Acceptable use and account restrictions", content: <>
    <p>Do not use ObPay for fraud, unlawful transactions, false identity information or unauthorised access. Do not attempt to bypass account controls or interfere with other customers’ accounts.</p>
    <p>Access may be restricted while verification, security concerns, disputed activity or legal requirements are investigated. Contact support to request account closure; unresolved payments, disputes and required records may need to be addressed first.</p>
  </> },
  { id: "availability", title: "Availability and responsibility", content: <>
    <p>Services can be delayed or unavailable because of maintenance, connectivity or payment-network interruptions. No website or payment service can promise uninterrupted operation or error-free processing.</p>
    <p>Responsibility for a loss depends on its cause and applicable law. These terms do not remove any rights or responsibilities that cannot lawfully be excluded.</p>
  </> },
  { id: "law", title: "Changes and governing law", content: <>
    <p>Changes to these terms will appear on this page with an updated date. Check this page before using the service if you are unsure which terms apply.</p>
    <p>These terms are governed by the laws of Uganda, subject to any mandatory protections that apply to you. Contact us first if a dispute arises; this does not prevent you from pursuing remedies available under applicable law.</p>
  </> },
  { id: "contact", title: "Contact", content: <>
    <p>For questions about these terms or a complaint, contact:</p>
    <PolicyContact />
  </> },
];

export default function TermsPage() {
  return <PolicyLayout title="Terms of Service" introduction="The terms that apply when you open an ObPay account and use our payment services." sections={sections} />;
}