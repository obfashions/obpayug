CREATE TABLE public.merchant_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  original_reference text NOT NULL,
  refund_reference text NOT NULL UNIQUE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'UGX',
  phone_number text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX merchant_refunds_merchant_idx ON public.merchant_refunds (merchant_id, created_at DESC);
CREATE INDEX merchant_refunds_original_idx ON public.merchant_refunds (original_reference);
GRANT ALL ON public.merchant_refunds TO service_role;
ALTER TABLE public.merchant_refunds ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.currency_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  from_amount numeric NOT NULL,
  to_amount numeric NOT NULL,
  rate numeric NOT NULL,
  fee_percent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX currency_exchanges_merchant_idx ON public.currency_exchanges (merchant_id, created_at DESC);
GRANT ALL ON public.currency_exchanges TO service_role;
ALTER TABLE public.currency_exchanges ENABLE ROW LEVEL SECURITY;