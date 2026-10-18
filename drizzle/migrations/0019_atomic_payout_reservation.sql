CREATE OR REPLACE FUNCTION public.reserve_payout_and_balance(p_merchant_id text, p_reference text, p_amount numeric, p_currency text, p_phone text, p_source text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 w public.merchant_wallets; b public.merchant_balances; r public.payment_records;
 main_currency text; wallet_available numeric := 0; available numeric; wallet_debit numeric; managed_debit numeric;
BEGIN
 IF p_amount <= 0 OR p_amount <> trunc(p_amount) OR p_currency NOT IN ('UGX','KES','RWF') THEN RAISE EXCEPTION 'Invalid payout amount or currency'; END IF;
 -- Serialize every reservation for a merchant, including different references.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_merchant_id, 0));
 SELECT * INTO r FROM public.payment_records WHERE reference = p_reference;
 IF r.id IS NOT NULL THEN RAISE EXCEPTION 'Reference already reserved. Check its status before retrying.'; END IF;
 SELECT * INTO w FROM public.merchant_wallets WHERE user_id::text = p_merchant_id FOR UPDATE;
 IF w.withdrawals_enabled IS FALSE THEN RAISE EXCEPTION 'Withdrawals are disabled on this account.'; END IF;
 SELECT upper(coalesce(default_currency, 'UGX')) INTO main_currency FROM public.profiles WHERE id::text = p_merchant_id;
 main_currency := coalesce(main_currency, upper(w.currency), 'UGX');
 IF p_currency = main_currency THEN wallet_available := coalesce(w.available_balance, 0);
 ELSE wallet_available := coalesce((w.balances_by_currency->>p_currency)::numeric, 0); END IF;
 INSERT INTO public.merchant_balances(merchant_id,currency) VALUES(p_merchant_id,p_currency) ON CONFLICT(merchant_id,currency) DO NOTHING;
 SELECT * INTO b FROM public.merchant_balances WHERE merchant_id=p_merchant_id AND currency=p_currency FOR UPDATE;
 available := wallet_available + b.available_balance;
 IF available < p_amount THEN RAISE EXCEPTION 'Insufficient balance. Available: % %.', available, p_currency; END IF;
 wallet_debit := least(greatest(wallet_available, 0), p_amount);
 managed_debit := p_amount - wallet_debit;
 IF wallet_debit > 0 THEN
  UPDATE public.merchant_wallets SET
   available_balance = CASE WHEN p_currency=main_currency THEN coalesce(available_balance,0)-wallet_debit ELSE available_balance END,
   balances_by_currency = jsonb_set(coalesce(balances_by_currency,'{}'::jsonb), ARRAY[p_currency], to_jsonb(wallet_available-wallet_debit)),
   total_payouts = CASE WHEN p_currency=main_currency THEN coalesce(total_payouts,0)+wallet_debit ELSE total_payouts END, updated_at=now()
  WHERE user_id::text=p_merchant_id;
 END IF;
 UPDATE public.merchant_balances SET available_balance=available_balance-managed_debit, total_payouts=total_payouts+managed_debit, updated_at=now() WHERE id=b.id;
 INSERT INTO public.payment_records(merchant_id,reference,type,source,amount,currency,status,phone_number,description,metadata,balance_applied_at)
 VALUES(p_merchant_id,p_reference,'payout',p_source,p_amount,p_currency,'pending',p_phone,p_description,
 coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('submission_state','submitting','balance_debited',true,'atomic_reservation',true,'wallet_debit',wallet_debit,'managed_debit',managed_debit,'main_currency',main_currency,'balance_before',available,'balance_after',available-p_amount),now()) RETURNING * INTO r;
 RETURN to_jsonb(r);
END; $$;
REVOKE ALL ON FUNCTION public.reserve_payout_and_balance(text,text,numeric,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payout_and_balance(text,text,numeric,text,text,text,text,jsonb) TO service_role;
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
 UPDATE public.payment_records SET status=p_status,settled_at=now(),updated_at=now(),fee_amount=greatest(coalesce(p_fee,0),0),net_amount=CASE WHEN p_status='success' THEN greatest(amount-greatest(coalesce(p_fee,0),0),0) ELSE 0 END,
 provider_reference=coalesce(nullif(p_provider_reference,''),provider_reference),metadata=r.metadata,
 balance_applied_at=CASE WHEN legacy_transaction THEN balance_applied_at ELSE now() END WHERE id=p_record_id RETURNING * INTO r;
 RETURN jsonb_build_object('claimed',true,'record',to_jsonb(r));
END; $$;
REVOKE ALL ON FUNCTION public.settle_payment_record_and_balance(uuid,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_record_and_balance(uuid,text,numeric,text) TO service_role;