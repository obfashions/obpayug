CREATE OR REPLACE FUNCTION public.settle_payment_record_and_balance(p_record_id uuid, p_status text, p_fee numeric DEFAULT 0, p_provider_reference text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  result public.payment_records;
  applied_at timestamptz := now();
  did_claim boolean := false;
BEGIN
  IF p_status NOT IN ('success', 'failed') THEN
    RAISE EXCEPTION 'Invalid terminal payment status';
  END IF;

  UPDATE public.payment_records
  SET status = p_status, settled_at = applied_at, updated_at = applied_at,
      fee_amount = greatest(coalesce(p_fee, 0), 0),
      net_amount = CASE WHEN p_status = 'success' THEN greatest(amount - greatest(coalesce(p_fee, 0), 0), 0) ELSE 0 END,
      provider_reference = coalesce(nullif(p_provider_reference, ''), provider_reference),
      -- Dashboard payments are credited to the merchant wallet by the transaction flow; never credit twice.
      balance_applied_at = CASE WHEN p_status = 'success' AND source <> 'dashboard' THEN applied_at ELSE NULL END
  WHERE id = p_record_id AND settled_at IS NULL
  RETURNING * INTO result;

  IF result.id IS NOT NULL THEN
    did_claim := true;
    IF p_status = 'success' AND result.source <> 'dashboard' THEN
      IF result.type = 'collection' THEN
        PERFORM public.apply_merchant_balance_change(result.merchant_id, result.currency, coalesce(result.net_amount,0), coalesce(result.amount,0), 0);
      ELSIF result.type = 'payout' THEN
        PERFORM public.apply_merchant_balance_change(result.merchant_id, result.currency, -coalesce(result.amount,0), 0, coalesce(result.amount,0));
      END IF;
    END IF;
  ELSE
    SELECT * INTO result FROM public.payment_records WHERE id = p_record_id;
  END IF;

  RETURN jsonb_build_object('claimed', did_claim, 'record', to_jsonb(result));
END;
$function$;