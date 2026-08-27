ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_amount numeric(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_amount numeric(18,2);

CREATE INDEX IF NOT EXISTS idx_payment_records_pending
  ON public.payment_records (status, created_at DESC)
  WHERE status = 'pending';