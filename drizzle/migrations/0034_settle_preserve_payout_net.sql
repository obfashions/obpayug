CREATE OR REPLACE FUNCTION public.settle_payment_record_and_balance(p_record_id uuid, p_status text, p_fee numeric DEFAULT 0, p_provider_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.payment_records; w public.merchant_wallets; b public.merchant_balances; wallet_credit numeric; managed_credit numeric; main_currency text; legacy_transaction boolean;
BEGIN
 IF p_status NOT IN ('success','failed') THEN RAISE EXCEPTION 'Invalid terminal payment status'; END IF;
 SELECT * INTO r FROM public.payment_records WHERE id=p_record_id FOR UPDATE;
 IF r.id IS NULL OR r.settled_at IS NOT NULL THEN RETURN jsonb_build_object('claimed',false,'record',to_jsonb(r)); END IF;
 -- Dashboard transaction mirrors are owned by the old wallet settlement path.
 SELECT EXISTS(SELECT 1 FROM public.transactions WHERE reference=r.reference AND user_id::text=r.merchant_id) INTO legacy_transaction;
 IF r.metadata->>'atomic_reservation' = 'true' THEN
  IF p_status='failed' THEN
    wallet_credit := coalesce((r.metadata->>'wallet_debit')::numeric,0);
    managed_credit := coalesce((r.metadata->>'managed_debit')::numeric,0);
    main_currency := r.metadata->>'main_currency';
    IF wallet_credit > 0 THEN
     SELECT * INTO w FROM public.merchant_wallets WHERE user_id::text=r.merchant_id FOR UPDATE;
     UPDATE public.merchant_wallets SET
      available_balance=CASE WHEN r.currency=main_currency THEN coalesce(available_balance,0)+wallet_credit ELSE available_balance END,
      balances_by_currency=jsonb_set(coalesce(balances_by_currency,'{}'::jsonb),ARRAY[r.currency],to_jsonb(CASE WHEN r.currency=main_currency THEN coalesce(available_balance,0) ELSE coalesce((balances_by_currency->>r.currency)::numeric,0) END+wallet_credit)),
      total_payouts=CASE WHEN r.currency=main_currency THEN coalesce(total_payouts,0)-wallet_credit ELSE total_payouts END,updated_at=now() WHERE user_id::text=r.merchant_id;
    END IF;
    IF managed_credit <> 0 THEN PERFORM public.apply_merchant_balance_change(r.merchant_id,r.currency,managed_credit,0,-managed_credit); END IF;
  END IF;
 ELSIF NOT legacy_transaction THEN
  IF r.type='collection' AND p_status='success' THEN
   PERFORM public.apply_merchant_balance_change(r.merchant_id,r.currency,greatest(r.amount-greatest(coalesce(p_fee,0),0),0),r.amount,0);
  ELSIF r.type='payout' THEN
   IF r.metadata->>'balance_debited'='true' THEN
    IF p_status='failed' THEN PERFORM public.apply_merchant_balance_change(r.merchant_id,r.currency,r.amount,0,-r.amount); END IF;
   ELSIF p_status='success' THEN
    b := public.apply_merchant_balance_change(r.merchant_id,r.currency,-r.amount,0,r.amount);
    r.metadata := coalesce(r.metadata,'{}'::jsonb)||jsonb_build_object('balance_before',b.available_balance+r.amount,'balance_after',b.available_balance);
   END IF;
  END IF;
 END IF;
 -- For payouts the recipient amount saved at acceptance is authoritative: in
 -- account mode the recipient gets the full entered amount (the fee is added
 -- on top of the debit), so never recompute net as amount minus fee.
 UPDATE public.payment_records SET status=p_status,settled_at=now(),updated_at=now(),fee_amount=greatest(coalesce(p_fee,0),0),
 net_amount=CASE WHEN p_status='success' THEN
   CASE WHEN r.type='payout' AND r.net_amount IS NOT NULL AND r.net_amount > 0 THEN r.net_amount
        ELSE greatest(amount-greatest(coalesce(p_fee,0),0),0) END
  ELSE 0 END,
 provider_reference=coalesce(nullif(p_provider_reference,''),provider_reference),metadata=r.metadata,
 balance_applied_at=CASE WHEN legacy_transaction THEN balance_applied_at ELSE now() END WHERE id=p_record_id RETURNING * INTO r;
 RETURN jsonb_build_object('claimed',true,'record',to_jsonb(r));
END; $$;
REVOKE ALL ON FUNCTION public.settle_payment_record_and_balance(uuid,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_record_and_balance(uuid,text,numeric,text) TO service_role;