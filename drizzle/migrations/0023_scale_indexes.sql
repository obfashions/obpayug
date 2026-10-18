CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON public.transactions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_merchant_status_created ON public.payment_records (merchant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_payment_records_reference ON public.payment_records (reference);
CREATE INDEX IF NOT EXISTS idx_merchant_balances_merchant ON public.merchant_balances (merchant_id, currency);