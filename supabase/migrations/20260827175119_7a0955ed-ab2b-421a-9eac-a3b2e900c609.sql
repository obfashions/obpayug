REVOKE EXECUTE ON FUNCTION public.apply_merchant_balance_change(text, text, numeric, numeric, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_merchant_balance_change(text, text, numeric, numeric, numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.apply_merchant_balance_change(text, text, numeric, numeric, numeric) TO service_role;