CREATE TABLE public.merchant_signing_secrets (
  merchant_id uuid PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);
GRANT ALL ON public.merchant_signing_secrets TO service_role;
ALTER TABLE public.merchant_signing_secrets ENABLE ROW LEVEL SECURITY;