CREATE OR REPLACE FUNCTION public.settle_dashboard_collection(p_transaction_id uuid, p_status text, p_fee numeric, p_provider_reference text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t public.transactions; w public.merchant_wallets; merchant uuid; main text; credit numeric; before_balance numeric;
BEGIN
 SELECT user_id INTO merchant FROM public.transactions WHERE id=p_transaction_id;
 IF merchant IS NULL THEN RAISE EXCEPTION 'Collection not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(merchant::text,0));
 SELECT * INTO t FROM public.transactions WHERE id=p_transaction_id FOR UPDATE;
 IF t.type IS DISTINCT FROM 'collection' THEN RAISE EXCEPTION 'Not a collection'; END IF;
 IF t.status IS DISTINCT FROM 'pending' THEN RETURN jsonb_build_object('claimed',false,'transaction',to_jsonb(t)); END IF;
 IF p_status IS NULL OR p_status NOT IN ('success','failed') OR p_fee IS NULL OR p_fee::text IN ('NaN','Infinity','-Infinity') OR p_fee<0 OR p_fee>t.amount OR t.amount IS NULL OR t.amount<=0 OR t.amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid collection settlement'; END IF;
 IF t.currency IS NULL OR t.currency NOT IN ('UGX','KES','RWF','NGN','XOF','USD','ZMW','SLL','CDF','XAF') THEN RAISE EXCEPTION 'Invalid collection currency'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_records r WHERE r.reference=t.reference AND r.merchant_id=t.user_id::text AND (r.currency IS DISTINCT FROM t.currency OR r.amount IS DISTINCT FROM t.amount OR r.type IS DISTINCT FROM 'collection' OR r.balance_applied_at IS NOT NULL)) THEN RAISE EXCEPTION 'Collection mirror requires review'; END IF;
 IF p_status='success' THEN
  SELECT default_currency INTO main FROM public.profiles WHERE id=merchant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merchant account not found'; END IF;
  INSERT INTO public.merchant_wallets(user_id,currency) VALUES(merchant,coalesce(main,t.currency)) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO w FROM public.merchant_wallets WHERE user_id=merchant FOR UPDATE;
  credit:=t.amount-p_fee;
  before_balance:=CASE WHEN w.currency=t.currency THEN coalesce(w.available_balance,0) ELSE coalesce((w.balances_by_currency->>t.currency)::numeric,0) END;
  UPDATE public.merchant_wallets SET available_balance=CASE WHEN currency=t.currency THEN coalesce(available_balance,0)+credit ELSE available_balance END,
   balances_by_currency=jsonb_set(coalesce(balances_by_currency,'{}'::jsonb),ARRAY[t.currency],to_jsonb(before_balance+credit)),
   total_collections=CASE WHEN currency=t.currency THEN coalesce(total_collections,0)+credit ELSE total_collections END,updated_at=now() WHERE user_id=merchant;
 END IF;
 UPDATE public.transactions SET status=p_status,fee_amount=CASE WHEN p_status='success' THEN p_fee ELSE 0 END,net_amount=CASE WHEN p_status='success' THEN amount-p_fee ELSE 0 END,
  completed_at=CASE WHEN p_status='success' THEN now() ELSE completed_at END,updated_at=now(),provider_reference=coalesce(nullif(p_provider_reference,''),provider_reference),
  metadata=coalesce(metadata,'{}'::jsonb)||CASE WHEN p_status='success' THEN jsonb_build_object('collection_balance_applied_at',now(),'collection_credit',credit,'collection_balance_before',before_balance,'collection_balance_after',before_balance+credit) ELSE '{}'::jsonb END
 WHERE id=t.id RETURNING * INTO t;
 UPDATE public.payment_records SET balance_applied_at=now(),updated_at=now() WHERE reference=t.reference AND merchant_id=t.user_id::text AND type='collection' AND status=p_status AND settled_at IS NOT NULL AND p_status='success';
 RETURN jsonb_build_object('claimed',true,'transaction',to_jsonb(t));
END; $$;
REVOKE ALL ON FUNCTION public.settle_dashboard_collection(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.settle_dashboard_collection(uuid,text,numeric,text) TO service_role;