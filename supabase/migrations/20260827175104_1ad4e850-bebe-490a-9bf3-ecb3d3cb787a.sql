CREATE TABLE public.merchant_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  currency text NOT NULL DEFAULT 'UGX',
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  total_collections numeric NOT NULL DEFAULT 0,
  total_payouts numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, currency)
);

GRANT SELECT ON public.merchant_balances TO authenticated;
GRANT ALL ON public.merchant_balances TO service_role;

ALTER TABLE public.merchant_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view their own balances"
ON public.merchant_balances
FOR SELECT
TO authenticated
USING (merchant_id = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.apply_merchant_balance_change(
  p_merchant_id text,
  p_currency text,
  p_available_delta numeric,
  p_collections_delta numeric DEFAULT 0,
  p_payouts_delta numeric DEFAULT 0
)
RETURNS public.merchant_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.merchant_balances;
BEGIN
  INSERT INTO public.merchant_balances (
    merchant_id, currency, available_balance, total_collections, total_payouts
  ) VALUES (
    p_merchant_id,
    upper(coalesce(nullif(trim(p_currency), ''), 'UGX')),
    p_available_delta,
    p_collections_delta,
    p_payouts_delta
  )
  ON CONFLICT (merchant_id, currency) DO UPDATE SET
    available_balance = public.merchant_balances.available_balance + EXCLUDED.available_balance,
    total_collections = public.merchant_balances.total_collections + EXCLUDED.total_collections,
    total_payouts = public.merchant_balances.total_payouts + EXCLUDED.total_payouts,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_merchant_balance_change(text, text, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_merchant_balance_change(text, text, numeric, numeric, numeric) TO service_role;