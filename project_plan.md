# ObPay - Payment Gateway Platform

## 1. Project Description

**Product:** ObPay is a modern, enterprise-grade payment gateway platform for East Africa, positioned between merchants and payment providers like LivePay. Merchants interact only with ObPay; the payment processor is abstracted behind the platform.

**Target Users:**
- **Merchants:** Businesses across East Africa who want to collect payments, send payouts, and integrate payments into their websites/apps
- **Developers:** Building integrations using ObPay APIs
- **Administrators:** Platform admins managing merchants, KYC, transactions, and system settings

**Core Value:** A single platform for collecting payments via mobile money (MTN, Airtel), bank transfers, and payment links - with a unified API, dashboard analytics, and robust developer tools.

## 2. Page Structure

### Public Pages (No Auth Required)
- `/` - Landing Page (Hero, features, testimonials, FAQ, contact)
- `/docs` - API Documentation Portal (ObPay API reference, integration guides)
- `/login` - Merchant Login
- `/register` - Merchant Registration
- `/forgot-password` - Password Reset

### Authenticated Pages (Merchant Dashboard)
- `/dashboard` - Main Dashboard (balance, collections, payouts, charts)
- `/dashboard/kyc` - KYC Verification Page
- `/dashboard/collections` - Collections Management
- `/dashboard/payouts` - Payouts Management
- `/dashboard/transactions` - Transaction History
- `/dashboard/payment-links` - Payment Links Management
- `/dashboard/api-sandbox` - API Test/Sandbox Environment
- `/dashboard/api-keys` - Developer Portal / API Credentials
- `/dashboard/webhooks` - Webhook Configuration
- `/dashboard/reports` - Reports & Analytics
- `/dashboard/settings` - Account Settings

### Admin Pages (Admin Only)
- `/admin` - Admin Dashboard
- `/admin/merchants` - Merchant Management
- `/admin/kyc-review` - KYC Review & Approval
- `/admin/transactions` - All Transactions
- `/admin/payout-requests` - Payout Requests
- `/admin/reports` - System Reports
- `/admin/settings` - Fee & System Settings
- `/admin/audit-logs` - Audit Logs
- `/admin/api-monitoring` - API Monitoring

## 3. Core Features

- [x] Modern Landing Page with hero, stats, testimonials, FAQ, contact, footer
- [x] Dark/Light mode support
- [x] Public API Documentation Portal with multi-language SDK examples
- [x] Merchant Registration with form validation
- [x] Merchant Login with session management
- [x] KYC Verification (company info, ID upload, address)
- [x] Merchant Dashboard with balance, charts, transactions
- [x] Payment Links (create, view, disable, delete, copy, track)
- [x] Collections (initiate, view status, filter, export)
- [x] Payouts (withdraw, view history, track status)
- [x] Transaction History (search, filter, export)
- [x] **ObPay API** — Complete REST API (collect, payout, balance, status) — ObPay IS the API provider
- [x] **API Sandbox** - Test environment for ObPay API calls with simulated responses
- [x] Developer Portal (API keys, webhook secrets, usage analytics)
- [x] Webhook Configuration & Logs
- [x] Admin Panel (merchant mgmt, KYC review, transactions, settings)
- [x] Role-Based Access Control (merchant, admin)
- [x] Secure API authentication with API keys

## 4. Data Model Design

### Table: `users`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| email | text | User email (unique) |
| full_name | text | Full name |
| phone_number | text | Phone number |
| password_hash | text | Hashed password |
| role | text | merchant / admin |
| status | text | active / pending / suspended / deactivated |
| created_at | timestamptz | Registration date |
| updated_at | timestamptz | Last update |

### Table: `merchant_profiles`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| company_name | text | Business name |
| country | text | Country |
| business_address | text | Business address |
| national_id | text | National ID number |
| verification_status | text | pending / approved / rejected |
| verified_at | timestamptz | Approval date |
| created_at | timestamptz | Created date |
| merchant_id | text | Unique merchant identifier |
| merchant_slug | text | Unique URL-friendly slug |
| credentials_generated | boolean | Whether API keys and webhook secret are generated |

### Table: `livepay_credentials`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| account_number | text | LivePay LP account number |
| api_key | text | Encrypted LivePay API key |
| environment | text | sandbox / live |
| status | text | active / disabled |
| connected_at | timestamptz | Connection date |

### Table: `transactions`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| reference | text | Transaction reference |
| amount | numeric | Transaction amount |
| currency | text | Currency code |
| status | text | pending / success / failed |
| type | text | collection / payout |
| payment_method | text | mtn / airtel / bank |
| customer_phone | text | Customer phone |
| customer_name | text | Customer name |
| provider_reference | text | LivePay internal reference |
| description | text | Transaction description |
| fee_amount | numeric | Platform fee deducted |
| net_amount | numeric | Net amount after fee |
| merchant_reference | text | Merchant's own reference |
| completed_at | timestamptz | Completion timestamp |
| metadata | jsonb | Extra data |
| created_at | timestamptz | Transaction date |
| updated_at | timestamptz | Last update |

### Table: `merchant_wallets`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to profiles (unique) |
| available_balance | numeric | Available for payouts |
| pending_balance | numeric | Pending confirmation |
| total_collections | numeric | Lifetime collections |
| total_payouts | numeric | Lifetime payouts |
| currency | text | Default UGX |

### Table: `webhook_configs`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to profiles (unique) |
| webhook_url | text | Merchant's webhook endpoint |
| webhook_secret | text | HMAC signing secret |
| events | text[] | Subscribed event types |
| is_active | boolean | Enabled/disabled |
| last_delivery_at | timestamptz | Last successful delivery |
| failed_count | int | Consecutive failures |

### Table: `platform_settings`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| platform_fee_percent | numeric | Default 5% |
| min/max_payout_amount | numeric | Payout limits |
| maintenance_mode | boolean | Platform maintenance |
| kyc_required | boolean | Require KYC for payments |
| supported_currencies | text[] | e.g. {UGX} |
| supported_payment_methods | text[] | e.g. {MTN, Airtel} |

### Table: `payout_requests`
| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to profiles |
| amount | numeric | Payout amount |
| phone_number | text | Recipient phone |
| network | text | mtn / airtel |
| status | text | pending / completed / failed |
| provider_reference | text | LivePay reference |

## 5. Backend / Third-party Integration Plan

- **Supabase Auth:** User authentication with auto-profile creation
- **Supabase Database:** All data with RLS policies
- **Supabase Edge Functions:**
  - `obpay-api` — Main REST API gateway (authenticate → route → LivePay proxy)
  - `obpay-webhook-receiver` — LivePay callback handler (update transactions, wallets, send merchant webhooks)
- **LivePay Integration:** `https://livepay.me/api`
  - POST /collect-money — Mobile money collection
  - POST /send-money — Payout/money send
  - GET /check-balance — Wallet balance
  - GET /transaction-status — Status check
  - Webhooks with signature verification

## 6. Development Phase Plan

### Phase 1: Design System & Landing Page ✅
### Phase 2: Public API Documentation Portal ✅
### Phase 3: Authentication & Merchant Registration ✅
### Phase 4: KYC Verification ✅
### Phase 5: Merchant Dashboard ✅
### Phase 6: Payment Links & Collections ✅
### Phase 7: LivePay Integration ✅
### Phase 8: Admin Panel ✅
### Phase 9: LivePay Integration (API Sandbox) ✅
### Phase 10: Complete Payment Engine ✅

**Delivered:**
- Database: merchant_wallets, webhook_configs, platform_settings, payout_requests tables with full RLS
- KYC Approval: Auto-generates merchant_id, API keys (pk_live_/sk_live_), webhook secret, creates wallet
- ObPay REST API Edge Function: /collect, /payout, /balance, /transaction/:ref, /transactions with fee engine
- Webhook Receiver: LivePay callback → update transaction → credit wallet → send merchant webhook → notify
- Real Dashboard Pages: Main dashboard with wallet, Collections form, Payouts form, Transactions with filters/search/export
- Payment Links: Create/disable/delete payment links, customer-facing /pay/:slug page
- Webhooks: Register URL, manage events, view delivery logs, HMAC signing
- Reports: Daily/weekly/monthly/custom reports with CSV export, financial breakdown
- Notifications: In-app bell with unread count, mark-all-read, per-notification read
- Admin Controls: Platform fee %, min/max limits, maintenance mode, KYC toggle, all DB-persisted
- Architecture: Merchant → ObPay API → Payment Service → LivePay → MTN/Airtel/Banks
- Platform Fee Engine: Configurable %, auto-deduct on collection success, net amount to wallet
- Merchant Wallet: Available/pending balance, total collections/payouts, auto-update on transactions

### Phase 11: Production Hardening & Testing ✅

**Completed:**
- [x] Unique merchant funding link with QR code on pay page
- [x] Fee calculation display on collections, payouts, and payment pages
- [x] Webhook auto-cancel/fund with proper fee deduction (already in place, verified)
- [x] Admin: Balance management (add/deduct merchant balances with audit trail)
- [x] Admin: Role management (promote/demote users between merchant and admin)
- [x] Admin: User management (ban, suspend, activate, manage all users including admins)
- [x] Funding link made clickable on payout page (opens in new tab)
- [x] Payouts page: column name fix (requested_at), network display with colored badges
- [x] Dashboard: Bank payment method banners (MTN, Airtel, Bank Transfer) with visual cards
- [x] Dashboard: Admin Panel quick-access button in header
- [x] DashboardLayout: Admin Panel button in sidebar (visible to admin users only)
- [x] Dashboard: Enhanced visuals — transaction type icons, color-coded status badges, gradient accents
- [x] Payouts page: Enhanced wallet cards with gradient accents, improved table visuals
- [x] Verified & admin access set for obsfashions256@gmail.com (merchant profile + wallet created)
- [x] API SDK / Embed code for external website integration (embed code added to payout page)

### Phase 12: Support Chat, API & Documentation ✅

**Completed:**
- [x] Support chat system: `support_messages` table with RLS policies, realtime enabled
- [x] Admin support chat page (`/admin/support`): Conversations list + real-time messaging panel
- [x] User support chat widget: Floating chat button on dashboard with real-time messaging
- [x] Support Chat nav item added to AdminLayout sidebar
- [x] SupportChatWidget integrated into DashboardLayout (visible to verified users)
- [x] ObPay API documentation added to /docs page with endpoint reference & auth guide
- [x] Website Integration guide added to /docs: Embed code, JS SDK, server-side examples
- [x] LivePay Integration Guide for merchants: Architecture, transaction lifecycle, connection steps
- [x] Docs sidebar updated with 3 new sections: ObPay API, Website Integration, LivePay Guide

## Phase 13: LivePay Webhook Sync Fix
- **Status**: Completed 2026-06-27
- **Problem**: Payments succeeded on LivePay but stayed "pending" on OBPay
- **Solution**:
  1. Added `webhookUrl` to LivePay collect-money API call so LivePay knows where to notify OBPay
  2. Made webhook receiver handle nested payloads and multiple status variations (success/completed/approved/etc)
  3. Added `check-transaction` action to OBPay API — polls LivePay status endpoints and auto-updates DB + wallet
  4. Added auto-poll every 5 seconds on Collections and Transactions pages for pending items
  5. Added manual "Check Status" button on every pending transaction row
- **Files**: `supabase/functions/obpay-api/index.ts`, `supabase/functions/obpay-webhook-receiver/index.ts`, `src/pages/dashboard/collections/page.tsx`, `src/pages/dashboard/transactions/page.tsx`

## Phase 14: Real-Time Sync & Merchant Integration Experience
- **Status**: Completed 2026-06-27
- **Problem**: Merchants needed real-time transaction syncing even without LivePay webhooks configured, easier API integration tools, and ability to test webhooks
- **Solution**:
  1. Dashboard now auto-polls LivePay every ~15s for pending transactions with toast notifications for status changes
  2. Added copy-paste HTML embed code on API Keys page so merchants can integrate a "Pay with ObPay" button in seconds
  3. Added "Test Webhook" button on Webhooks page — sends a test event to merchant's server and shows delivery result
  4. Added `test-webhook` action to obpay-api edge function that generates HMAC-signed test payloads
  5. Completely rewrote Docs "Website Integration" section with 3-tier approach (Payment Link, Embed Button, Full API) plus complete checkout.js code example
  6. Added step-by-step checkout flow guide with security notes about server-side key usage
- **Files**: `supabase/functions/obpay-api/index.ts`, `src/pages/dashboard/page.tsx`, `src/pages/dashboard/api-keys/page.tsx`, `src/pages/dashboard/webhooks/page.tsx`, `src/pages/docs/page.tsx`

## Phase 15: Active Sync — OBPay Polls JulyPay Directly

- **Status**: Completed 2026-06-28
- **Problem**: JulyPay webhooks consistently returned HTTP 400 due to PostgREST parameter format mismatch between JulyPay's raw payload `{"id":"...","type":"...","data":{...}}` and PostgREST function signatures. Three rounds of webhook debugging failed to resolve the 400.
- **Solution — Architecture Pivot**: Abandoned the webhook receiver approach entirely. OBPay now **actively polls** JulyPay for pending transaction status instead of waiting for JulyPay to push updates.
  - New `sync-all-pending` action in obpay-api edge function:
    - Fetches ALL pending transactions with provider_reference (up to 30 per batch)
    - Loops through each, calling JulyPay's status endpoint
    - Primary: `GET /wallet/collections/{id}/status`
    - Fallback: `GET /data/transaction/verify/{reference}` (DusuPay-compatible)
    - Handles rate limiting (429) with 3s pause and single retry
    - 800ms delay between calls to respect JulyPay rate limits
    - Credits wallet on success, marks failed on failure
    - Returns detailed logs and summary of all changes
  - Frontend sync strategy:
    - **Dashboard**: Syncs ALL pending on initial page load (catches up when browser was closed), then polls every 30s
    - **Collections page**: Dynamic polling with exponential backoff (20s → 60s → 120s on rate limits, recovers on success)
    - **Transactions page**: Polls sync-all-pending every 15s, plus silent local DB refresh
    - Toast notifications for all status changes
  - Webhook receiver kept as secondary fallback only
  - Maintenance mode turned off on platform
  - pg_cron unavailable for server-side cron (pg_net not installed, pg_cron requires postgres DB)
- **Files**: `supabase/functions/obpay-api/index.ts`, `src/pages/dashboard/page.tsx`, `src/pages/dashboard/collections/page.tsx`, `src/pages/dashboard/transactions/page.tsx`, `src/pages/dashboard/webhook-test/page.tsx`

### Phase 16: Landing Page Overhaul & Documentation Expansion

- **Status**: In Progress — 2026-07-03
- **Changes**:
  1. Hero Section redesigned: Replaced single dashboard mockup with 4-image scrollable carousel showing real banking/ATM scenes (ATM withdrawal, bank branch, mobile money confirmation, business meeting)
  2. Added Loans Section: 4 business loan products (Growth, Working Capital, Merchant Advance, Enterprise), eligibility, 3-step application process
  3. Added Trust & Security Section: 6 security certifications, trust stats, compliance badges (PCI DSS, GDPR, ISO 27001, SSL/TLS 1.3, Bank of Uganda)
  4. Added Partners Section: 12 partner banks & mobile networks with visual grid, 3 business leader testimonials
  5. Documentation expanded: 3 new sections — Rate Limiting (tiers, exponential backoff code), Security Guide (key protection, webhook verification, idempotency, checklist), Testing & Go-Live Checklist (3 phases with interactive checkboxes)
  6. Landing page now has 13 sections total for a comprehensive, trust-building experience
- **Files**: `src/pages/home/components/HeroSection.tsx`, `src/pages/home/components/LoansSection.tsx`, `src/pages/home/components/TrustSection.tsx`, `src/pages/home/components/PartnersSection.tsx`, `src/pages/home/page.tsx`, `src/pages/docs/page.tsx`

### Phase 17: Compliance & AML Landing Page Section

- **Status**: Completed — 2026-07-13
- **Context**: JulyPay requested details on ObPay's compliance and AML framework to continue processing transactions.
- **Changes**:
  1. New `ComplianceSection` component: 5-step compliance process flow (Registration → KYC Upload → Manual Review → Approval → Ongoing Monitoring), 6 compliance areas (KYC, AML monitoring, risk controls, audit trail, regulatory alignment, fraud protection), CTA block for merchant registration and compliance team contact
  2. Added compliance/AML FAQ to existing FAQ section covering KYC verification, AML monitoring, audit trails, and regulatory alignment with Bank of Uganda and FATF
  3. Compliance section placed between TrustSection and PartnersSection on the landing page
- **JulyPay Response**: Delivered a comprehensive compliance response covering 6 areas — merchant KYC, transaction monitoring, risk-based controls, data security, record keeping, and regulatory alignment — ready to send to JulyPay
- **Files**: `src/pages/home/components/ComplianceSection.tsx`, `src/pages/home/components/FAQSection.tsx`, `src/pages/home/page.tsx`