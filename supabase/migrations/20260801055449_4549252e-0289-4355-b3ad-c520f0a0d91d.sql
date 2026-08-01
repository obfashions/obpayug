CREATE TABLE public.merchant_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  name text NOT NULL DEFAULT 'Default key',
  environment text NOT NULL DEFAULT 'live',
  public_key text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  secret_prefix text NOT NULL,
  secret_last4 text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_merchant ON public.merchant_api_keys (merchant_id);
CREATE INDEX idx_api_keys_hash ON public.merchant_api_keys (secret_hash);

CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  amount numeric(18,2),
  currency text NOT NULL DEFAULT 'UGX',
  fixed_amount boolean NOT NULL DEFAULT true,
  redirect_url text,
  status text NOT NULL DEFAULT 'active',
  views integer NOT NULL DEFAULT 0,
  payments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_links_merchant ON public.payment_links (merchant_id);

CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['collection.success','collection.failed','payout.success','payout.failed'],
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_endpoints_merchant ON public.webhook_endpoints (merchant_id);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  merchant_id text NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_code integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_merchant ON public.webhook_deliveries (merchant_id, created_at DESC);

CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text,
  method text NOT NULL,
  path text NOT NULL,
  action text,
  status_code integer NOT NULL DEFAULT 200,
  duration_ms integer,
  ip_address text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_logs_merchant ON public.api_request_logs (merchant_id, created_at DESC);

CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL UNIQUE,
  email text,
  full_name text,
  business_name text,
  phone text,
  address text,
  id_type text,
  id_number text,
  status text NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  submission_id uuid REFERENCES public.kyc_submissions(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_path text NOT NULL,
  file_name text,
  file_size integer,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_docs_merchant ON public.kyc_documents (merchant_id);

CREATE TABLE public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  reference text NOT NULL UNIQUE,
  provider_reference text,
  type text NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'UGX',
  phone_number text,
  status text NOT NULL DEFAULT 'pending',
  description text,
  source text NOT NULL DEFAULT 'dashboard',
  payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_records_merchant ON public.payment_records (merchant_id, created_at DESC);

GRANT ALL ON public.merchant_api_keys TO service_role;
GRANT ALL ON public.payment_links TO service_role;
GRANT ALL ON public.webhook_endpoints TO service_role;
GRANT ALL ON public.webhook_deliveries TO service_role;
GRANT ALL ON public.api_request_logs TO service_role;
GRANT ALL ON public.kyc_submissions TO service_role;
GRANT ALL ON public.kyc_documents TO service_role;
GRANT ALL ON public.payment_records TO service_role;

ALTER TABLE public.merchant_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;