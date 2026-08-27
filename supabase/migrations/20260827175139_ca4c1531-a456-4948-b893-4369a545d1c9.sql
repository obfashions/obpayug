ALTER TABLE public.payment_records
ADD COLUMN IF NOT EXISTS balance_applied_at timestamptz;