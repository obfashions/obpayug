export interface AdminDashboardStats {
  totalMerchants: number;
  activeMerchants: number;
  pendingKYCCount: number;
  totalVolume: number;
  todayVolume: number;
  monthlyVolume: number;
  totalPayouts: number;
  totalTransactions: number;
  successRate: number;
}

export interface AdminMerchant {
  id: string;
  companyName: string;
  fullName: string;
  email: string;
  phone: string;
  country: string;
  status: "active" | "suspended" | "deactivated";
  verificationStatus: "approved" | "pending" | "rejected";
  balance: number;
  totalVolume: number;
  joinedAt: string;
}

export interface AdminKYCReview {
  id: string;
  userId: string;
  companyName: string;
  fullName: string;
  country: string;
  businessAddress: string;
  nationalId: string;
  idFrontUrl: string;
  idBackUrl: string;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
}

export interface AdminTransaction {
  id: string;
  merchantName: string;
  reference: string;
  amount: number;
  currency: string;
  type: "collection" | "payout";
  status: "success" | "failed" | "pending";
  paymentMethod: string;
  customerPhone: string;
  providerRef: string;
  createdAt: string;
}

export interface AdminPayoutRequest {
  id: string;
  merchantName: string;
  amount: number;
  currency: string;
  recipientPhone: string;
  recipientName: string;
  status: "pending" | "processing" | "success" | "failed";
  createdAt: string;
  processedAt: string | null;
}

export interface AdminAuditLog {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  ipAddress: string;
  createdAt: string;
  details: Record<string, string>;
}

export interface AdminAPIMetric {
  endpoint: string;
  requests: number;
  successRate: number;
  avgLatencyMs: number;
  errors: number;
}

export interface AdminSystemSettings {
  platformFeePercent: number;
  minPayoutAmount: number;
  maxPayoutAmount: number;
  payoutProcessingTime: string;
  supportedCurrencies: string[];
  supportedPaymentMethods: string[];
  maintenanceMode: boolean;
  kycRequired: boolean;
  autoApproveThreshold: number;
}