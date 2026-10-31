import { Link } from "@tanstack/react-router";
import PolicyLayout, { PolicyContact, type PolicySection } from "@/components/feature/PolicyLayout";

const sections: PolicySection[] = [
  { id: "scope", title: "About this policy", content: <>
    <p>This policy explains how information is used when you visit ObPay, register, verify your identity, make payments or contact support. It also covers information supplied through payment links and merchant API integrations.</p>
    <p>ObPay’s business location is Fort Portal, Uganda. For privacy questions or requests, use the contact details below.</p>
  </> },
  { id: "information", title: "Information we handle", content: <>
    <ul>
      <li>Account and business details, such as your name, email address, phone number, country, business information and optional website.</li>
      <li>Identity-verification information and documents you submit, including identity documents or business registration documents where required.</li>
      <li>Payment and service details, such as amounts, currencies, references, status, fees, wallet records, recipient numbers and bill account details.</li>
      <li>Support messages and the information you provide when reporting a problem.</li>
      <li>Technical records needed for account access, API activity, security checks and investigating errors.</li>
    </ul>
    <p>The information required depends on the service you use. Do not include a mobile-money PIN, password or verification code in a support message.</p>
  </> },
  { id: "purposes", title: "Why information is used", content: <>
    <p>Information is used to create and maintain accounts, verify identities, process and reconcile authorised payments, provide statements, respond to requests and send account or transaction notices.</p>
    <p>It is also used to investigate suspected fraud, prevent unauthorised access, resolve disputes and meet applicable legal obligations. Where consent is legally required for an additional use, that use requires the appropriate consent.</p>
  </> },
  { id: "sharing", title: "Service providers and disclosures", content: <>
    <p>Payment networks and service operators receive information needed to carry out the transaction you request. Providers supporting hosting, account access, document storage and email delivery may process information needed to operate ObPay.</p>
    <p>Information may also be disclosed where required by law or necessary to investigate fraud or resolve a payment dispute. Processing by service providers may take place outside Uganda and remains subject to applicable data-protection requirements.</p>
    <p>Contact us if you need further information about recipients or processing locations for your data.</p>
  </> },
  { id: "storage", title: "Storage, access and security", content: <>
    <p>Account access and service controls are used to restrict access to customer information. No internet service can guarantee absolute security; protect your credentials and tell us promptly about suspected misuse.</p>
    <p>Financial, verification and security records may need to be kept to meet legal obligations, reconcile payments or resolve disputes. Closing an account does not necessarily remove every record immediately. Contact us for information about the retention requirements that apply to your records.</p>
  </> },
  { id: "browser", title: "Browser storage", content: <>
    <p>ObPay uses browser storage for account sessions, verification steps and preferences such as the selected appearance. Blocking or clearing this storage may sign you out or interrupt account verification.</p>
    <p>This policy does not provide consent for advertising tracking. Any such tracking must meet the applicable notice and consent requirements.</p>
  </> },
  { id: "rights", title: "Your privacy requests", content: <>
    <p>You may ask about the information held about you, request access or correction, or request deletion or restriction where applicable. You may also raise an objection or withdraw consent for processing that relies on it, subject to applicable law.</p>
    <p>We may need to verify your identity before acting on a request. Some records cannot be deleted while legal retention requirements or unresolved transactions apply. Withdrawing consent does not affect lawful processing that already took place.</p>
    <p>If a concern remains unresolved, you may contact Uganda’s Personal Data Protection Office or pursue other remedies available under applicable law.</p>
  </> },
  { id: "updates", title: "Policy updates", content: <>
    <p>Updates will be posted on this page with a revised date. Read this policy with the <Link to="/terms">Terms of Service</Link>.</p>
  </> },
  { id: "contact", title: "Privacy contact", content: <>
    <p>For privacy requests, corrections or complaints, contact:</p>
    <PolicyContact />
    <p>Include enough information to identify your account, but do not email your password, PIN, verification code or identity documents unless a secure submission method has been arranged.</p>
  </> },
];

export default function PrivacyPage() {
  return <PolicyLayout title="Privacy Policy" introduction="How ObPay handles account, identity and transaction information, and how to contact us about your data." sections={sections} />;
}