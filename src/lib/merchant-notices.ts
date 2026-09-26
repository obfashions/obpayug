// Ready-made merchant notice templates (browser-safe, shared with server).
// Use {name} to insert the merchant's name.

export interface NoticeTemplate {
  id: string;
  label: string;
  subject: string;
  body: string;
}

export const NOTICE_TEMPLATES: NoticeTemplate[] = [
  {
    id: "service-restored",
    label: "Service fully restored",
    subject: "ObPay is fully restored",
    body: "Hi {name},\n\nGood news — ObPay is fully restored. Collections, payouts, payment links and the API are all working normally again.\n\nThank you for your patience. If anything looks wrong on your account, contact support on +256762201984.\n\nThe ObPay Team",
  },
  {
    id: "maintenance",
    label: "Scheduled maintenance",
    subject: "Scheduled maintenance on ObPay",
    body: "Hi {name},\n\nWe will carry out short maintenance to improve ObPay. During this time some payments may be delayed for a few minutes. Your balance and money are safe.\n\nFor questions, contact support on +256762201984.\n\nThe ObPay Team",
  },
  {
    id: "new-features",
    label: "New features update",
    subject: "What's new on ObPay",
    body: "Hi {name},\n\nWe've improved ObPay: customers now get a PIN prompt straight on their phone, receipts are emailed after every successful payment, and the API documentation has been rewritten to make integration easier.\n\nLog in to your dashboard to try it out. Support: +256762201984.\n\nThe ObPay Team",
  },
  {
    id: "verify-account",
    label: "Verify your account",
    subject: "Complete your ObPay verification",
    body: "Hi {name},\n\nPlease complete your account verification to unlock collections and payouts. Personal accounts only need the front and back of a National ID; business accounts need a registration certificate.\n\nOpen your dashboard and go to Verification. Support: +256762201984.\n\nThe ObPay Team",
  },
  {
    id: "withdrawal-fee",
    label: "Withdrawal fee notice",
    subject: "Update on ObPay withdrawal fees",
    body: "Hi {name},\n\nWithdrawal fees are now taken from the amount you withdraw, not from your remaining balance. For example, when you withdraw UGX 10,000, the fee is deducted from that 10,000 and the rest is sent to you.\n\nQuestions? Contact support on +256762201984.\n\nThe ObPay Team",
  },
  {
    id: "security",
    label: "Security reminder",
    subject: "Keep your ObPay account safe",
    body: "Hi {name},\n\nObPay will never ask for your password, PIN or verification codes by phone, SMS or WhatsApp. Never share them with anyone.\n\nIf you notice anything unusual, contact support immediately on +256762201984.\n\nThe ObPay Team",
  },
];
