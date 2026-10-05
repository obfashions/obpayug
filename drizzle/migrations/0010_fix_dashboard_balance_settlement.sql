CREATE OR REPLACE FUNCTION public.settle_payment_record_and_balance(p_record_id uuid, p_status text, p_fee numeric DEFAULT 0, p_provider_reference text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
 result public.payment_records;
 applied_at timestamptz := now();
 did_claim boolean := false;
 legacy_mirror boolean := false;
 changed_balance public.merchant_balances;
 wallet_row public.merchant_wallets;
 main_currency text;
 wallet_component numeric := 0;
BEGIN
 IF p_status NOT IN ('success', 'failed') THEN RAISE EXCEPTION 'Invalid terminal payment status'; END IF;
 -- Only the old wallet flow (which also writes a row in transactions and moves
 -- the wallet itself) must be skipped here; every other record moves the balance.
 SELECT EXISTS (
   SELECT 1 FROM public.payment_records pr JOIN public.transactions t
     ON t.user_id::text = pr.merchant_id AND t.reference = pr.reference
   WHERE pr.id = p_record_id AND pr.source = 'dashboard'
 ) INTO legacy_mirror;
 UPDATE public.payment_records
 SET status = p_status, settled_at = applied_at, updated_at = applied_at,
 fee_amount = greatest(coalesce(p_fee, 0), 0),
 net_amount = CASE WHEN p_status = 'success' THEN greatest(amount - greatest(coalesce(p_fee, 0), 0), 0) ELSE 0 END,
 provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference),
 balance_applied_at = CASE WHEN p_status = 'success' AND NOT legacy_mirror THEN applied_at ELSE NULL END
 WHERE id = p_record_id AND settled_at IS NULL RETURNING * INTO result;
 IF result.id IS NOT NULL THEN
  did_claim := true;
  IF p_status = 'success' AND NOT legacy_mirror THEN
   IF result.type = 'collection' THEN
    PERFORM public.apply_merchant_balance_change(result.merchant_id, result.currency, coalesce(result.net_amount,0), coalesce(result.amount,0), 0);
   ELSIF result.type = 'payout' THEN
    SELECT * INTO wallet_row FROM public.merchant_wallets WHERE user_id::text = result.merchant_id FOR UPDATE;
    SELECT coalesce(default_currency, 'UGX') INTO main_currency FROM public.profiles WHERE id::text = result.merchant_id;
    wallet_component := coalesce((wallet_row.balances_by_currency ->> result.currency)::numeric, 0);
    IF result.currency = coalesce(main_currency, 'UGX') THEN
     wallet_component := greatest(wallet_component, coalesce(wallet_row.available_balance, 0));
    END IF;
    changed_balance := public.apply_merchant_balance_change(result.merchant_id, result.currency, -coalesce(result.amount,0), 0, coalesce(result.amount,0));
    UPDATE public.payment_records SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
     'balance_before', changed_balance.available_balance + wallet_component + result.amount,
     'balance_after', changed_balance.available_balance + wallet_component,
     'balance_snapshot_at', applied_at
    ) WHERE id = result.id RETURNING * INTO result;
   END IF;
  END IF;
 ELSE
  SELECT * INTO result FROM public.payment_records WHERE id = p_record_id;
 END IF;
 RETURN jsonb_build_object('claimed', did_claim, 'record', to_jsonb(result));
END;
$function$;

-- Backfill: successful dashboard payouts that never left the balance.
DO $$
DECLARE r record; wallet_row public.merchant_wallets; main_currency text; wc numeric; cb public.merchant_balances;
BEGIN
 FOR r IN SELECT pr.* FROM public.payment_records pr
   WHERE pr.source = 'dashboard' AND pr.type = 'payout' AND pr.status = 'success' AND pr.balance_applied_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id::text = pr.merchant_id AND t.reference = pr.reference)
   ORDER BY pr.created_at
 LOOP
  SELECT * INTO wallet_row FROM public.merchant_wallets WHERE user_id::text = r.merchant_id FOR UPDATE;
  SELECT coalesce(default_currency, 'UGX') INTO main_currency FROM public.profiles WHERE id::text = r.merchant_id;
  wc := coalesce((wallet_row.balances_by_currency ->> r.currency)::numeric, 0);
  IF r.currency = coalesce(main_currency, 'UGX') THEN wc := greatest(wc, coalesce(wallet_row.available_balance, 0)); END IF;
  cb := public.apply_merchant_balance_change(r.merchant_id, r.currency, -coalesce(r.amount,0), 0, coalesce(r.amount,0));
  UPDATE public.payment_records SET balance_applied_at = now(), metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'balance_after', cb.available_balance + wc, 'balance_corrected_at', now(), 'balance_correction', 'Successful payout debited after missed balance update')
  WHERE id = r.id;
 END LOOP;
END $$;