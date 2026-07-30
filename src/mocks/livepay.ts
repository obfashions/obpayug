// LivePay API mock data — https://livepay.me/api

export const mockLivePayCredentials = {
  api_key: "lp_live_abc123def456ghi789",
  account_number: "LP2305443309",
  environment: "live" as "sandbox" | "live",
  connected: true,
  last_tested: "2026-07-15T14:30:00Z",
};

export const mockLivePayBalance = {
  success: true,
  account_number: "LP2305443309",
  currency: "UGX",
  balance: 1500000,
  status: "active",
};

// LivePay transaction status response
export const mockLivePayTransaction = {
  success: true,
  status: "Pending",
  message: "N/A",
  customer_reference: "WITHDRAW123456789",
  internal_reference: "550e8400-e29b-41d4-a716-446655440000",
  msisdn: "+256777123456",
  amount: 50000,
  currency: "UGX",
  provider: "MTN",
  charge: 2000,
  remote_ip: "192.168.1.100",
  provider_transaction_id: "N/A",
  created_at: "2026-07-15 10:30:00",
  completed_at: "N/A",
};

// LivePay collect money response (POST /collect-money)
export const mockLivePayCollectResponse = {
  success: true,
  message: "Collection request sent successfully",
  reference: "INVOICE123456789",
  internal_reference: "550e8400-e29b-41d4-a716-446655440000",
  network: "MTN",
};

// LivePay send money response (POST /send-money)
export const mockLivePaySendResponse = {
  success: true,
  message: "Payment request in progress.",
  reference: "WITHDRAW123456789",
  internal_reference: "550e8400-e29b-41d4-a716-446655440000",
};

// LivePay webhook payload
export const mockLivePayWebhookPayload = {
  status: "Success",
  message: "Payment completed successfully",
  customer_reference: "INV-123456789",
  internal_reference: "550e8400-e29b-41d4-a716-446655440000",
  msisdn: "+256777123456",
  amount: 50000,
  currency: "UGX",
  provider: "MTN",
  charge: 1500,
  completed_at: "2024-01-15 10:35:00",
};

// LivePay supported networks per country
export const supportedNetworks = [
  { country: "Uganda", flag: "🇺🇬", currency: "UGX", networks: ["AIRTEL", "MTN"], minAmount: 500, maxAmount: 10000000 },
  { country: "Kenya", flag: "🇰🇪", currency: "KES", networks: ["SAFARICOM", "AIRTEL"], minAmount: 10, maxAmount: 150000 },
  { country: "Ghana", flag: "🇬🇭", currency: "GHS", networks: ["AIRTELTIGO", "MTN", "VODAFONE"], minAmount: 1, maxAmount: 10000 },
  { country: "Cameroon", flag: "🇨🇲", currency: "XAF", networks: ["MTN", "ORANGE"], minAmount: 100, maxAmount: 1000000 },
];

// ObPay charges (applied on top of LivePay fees)
export const obpayCharges = {
  collection_fee_percent: 5,        // 5% of collected amount
  // Payouts & Withdrawals use tiered pricing:
  //   500 – 70,000 UGX  → flat 2,000 UGX
  //   70,001 – 5,000,000 UGX → 3%
  payout_flat_fee_ugx: 2000,        // flat fee per payout to others (tier 1)
  withdrawal_fee_percent: 3,        // 3% when merchant withdraws to own number (tier 2)
  min_collection_ugx: 1000,
  min_payout_ugx: 1000,
};