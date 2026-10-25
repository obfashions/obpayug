CREATE OR REPLACE FUNCTION public.exchange_wallet_balance(
  p_merchant_id text, p_from text, p_to text, p_amount numeric, p_to_amount numeric, p_rate numeric, p_fee_percent numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  w public.merchant_wallets; b public.merchant_balances;
  main_currency text; wallet_available numeric := 0; available numeric;
  wallet_debit numeric; managed_debit numeric;
BEGIN
  p_from := upper(trim(p_from)); p_to := upper(trim(p_to));
  IF p_from IS NULL OR p_to IS NULL OR p_from NOT IN ('UGX','KES','RWF','NGN','XOF','USD','ZMW','SLL','CDF','XAF') OR p_to NOT IN ('UGX','KES','RWF','NGN','XOF','USD','ZMW','SLL','CDF','XAF') OR p_from = p_to THEN
    RAISE EXCEPTION 'Choose two different supported currencies.';
  END IF;
  IF p_amount <= 0 OR p_to_amount <= 0 THEN RAISE EXCEPTION 'Invalid exchange amount.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_merchant_id, 0));
  SELECT * INTO w FROM public.merchant_wallets WHERE user_id::text = p_merchant_id FOR UPDATE;
  IF w.id IS NULL THEN RAISE EXCEPTION 'Wallet not found.'; END IF;
  SELECT upper(coalesce(default_currency, 'UGX')) INTO main_currency FROM public.profiles WHERE id::text = p_merchant_id;
  main_currency := coalesce(main_currency, upper(w.currency), 'UGX');
  IF p_from = main_currency THEN wallet_available := coalesce(w.available_balance, 0);
  ELSE wallet_available := coalesce((w.balances_by_currency->>p_from)::numeric, 0); END IF;
  INSERT INTO public.merchant_balances(merchant_id, currency) VALUES(p_merchant_id, p_from) ON CONFLICT(merchant_id, currency) DO NOTHING;
  SELECT * INTO b FROM public.merchant_balances WHERE merchant_id = p_merchant_id AND currency = p_from FOR UPDATE;
  available := wallet_available + b.available_balance;
  IF available < p_amount THEN RAISE EXCEPTION 'Insufficient % balance. Available: % %.', p_from, available, p_from; END IF;
  wallet_debit := least(greatest(wallet_available, 0), p_amount);
  managed_debit := p_amount - wallet_debit;
  IF wallet_debit > 0 THEN
    UPDATE public.merchant_wallets SET
      available_balance = CASE WHEN p_from = main_currency THEN coalesce(available_balance, 0) - wallet_debit ELSE available_balance END,
      balances_by_currency = jsonb_set(coalesce(balances_by_currency, '{}'::jsonb), ARRAY[p_from], to_jsonb(wallet_available - wallet_debit)),
      updated_at = now()
    WHERE user_id::text = p_merchant_id;
  END IF;
  IF managed_debit > 0 THEN
    UPDATE public.merchant_balances SET available_balance = available_balance - managed_debit, updated_at = now() WHERE id = b.id;
  END IF;
  INSERT INTO public.merchant_balances(merchant_id, currency, available_balance) VALUES(p_merchant_id, p_to, p_to_amount)
  ON CONFLICT (merchant_id, currency) DO UPDATE SET
    available_balance = public.merchant_balances.available_balance + EXCLUDED.available_balance, updated_at = now();
  INSERT INTO public.currency_exchanges(merchant_id, from_currency, to_currency, from_amount, to_amount, rate, fee_percent)
  VALUES(p_merchant_id, p_from, p_to, p_amount, p_to_amount, p_rate, p_fee_percent);
  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'from_amount', p_amount, 'to_amount', p_to_amount,
    'rate', p_rate, 'fee_percent', p_fee_percent, 'balance_before', available, 'balance_after', available - p_amount);
END;
$function$;
REVOKE ALL ON FUNCTION public.exchange_wallet_balance(text,text,text,numeric,numeric,numeric,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exchange_wallet_balance(text,text,text,numeric,numeric,numeric,numeric) TO service_role;