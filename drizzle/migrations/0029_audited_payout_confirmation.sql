CREATE OR REPLACE FUNCTION public.confirm_payout_status(p_record_id uuid, p_status text, p_provider_reference text, p_actor uuid, p_reason text, p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.payment_records; w public.merchant_wallets; b public.merchant_balances; merchant text; main text; wd numeric; md numeric; delta numeric := 0; before_balance numeric; after_balance numeric; fee numeric;
BEGIN
 IF NOT public.has_permission(p_actor,'finance') THEN RAISE EXCEPTION 'Finance permission required'; END IF;
 IF p_status NOT IN ('success','failed') OR length(trim(coalesce(p_reason,''))) < 5 OR nullif(trim(p_provider_reference),'') IS NULL THEN RAISE EXCEPTION 'Verified status, partner reference and reason required'; END IF;
 IF p_evidence->>'status' IS DISTINCT FROM p_status OR p_evidence->>'reference' IS DISTINCT FROM p_provider_reference THEN RAISE EXCEPTION 'Payment verification does not match'; END IF;
 SELECT merchant_id INTO merchant FROM public.payment_records WHERE id=p_record_id;
 IF merchant IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(merchant,0));
 SELECT * INTO r FROM public.payment_records WHERE id=p_record_id FOR UPDATE;
 IF r.type <> 'payout' OR r.metadata->>'atomic_reservation' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Historical payout requires a separate ledger review'; END IF;
 IF EXISTS(SELECT 1 FROM public.transactions WHERE reference=r.reference AND user_id::text=r.merchant_id) THEN RAISE EXCEPTION 'Mirrored payout requires a separate ledger review'; END IF;
 IF r.provider_reference IS NOT NULL AND r.provider_reference <> p_provider_reference THEN RAISE EXCEPTION 'Partner reference mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_records WHERE provider_reference=p_provider_reference AND id<>r.id AND type='payout') THEN RAISE EXCEPTION 'Partner payout already linked to another transaction'; END IF;
 IF p_evidence->>'currency' IS DISTINCT FROM r.currency THEN RAISE EXCEPTION 'Currency mismatch'; END IF;
 wd := coalesce((r.metadata->>'wallet_debit')::numeric,0); md := coalesce((r.metadata->>'managed_debit')::numeric,0);
 IF wd<0 OR md<0 OR wd+md<=0 OR wd+md IS DISTINCT FROM (r.metadata->>'total_debit')::numeric THEN RAISE EXCEPTION 'Invalid original debit'; END IF;
 fee := coalesce((r.metadata->>'partner_fee')::numeric,0)+coalesce((r.metadata->>'obpay_fee')::numeric,0);
 IF abs(coalesce((p_evidence->>'net_amount')::numeric,-1)-(wd+md-fee)) > 0.01 THEN RAISE EXCEPTION 'Partner payout amount does not match original reservation'; END IF;
 IF r.status=p_status AND r.settled_at IS NOT NULL THEN RETURN jsonb_build_object('changed',false,'status',r.status,'reference',r.reference); END IF;
 SELECT * INTO w FROM public.merchant_wallets WHERE user_id::text=r.merchant_id FOR UPDATE;
 SELECT * INTO b FROM public.merchant_balances WHERE merchant_id=r.merchant_id AND currency=r.currency FOR UPDATE;
 main := coalesce(w.currency,r.metadata->>'main_currency');
 before_balance := CASE WHEN main=r.currency THEN coalesce(w.available_balance,0) ELSE coalesce((w.balances_by_currency->>r.currency)::numeric,0) END + coalesce(b.available_balance,0);
 IF r.status='failed' AND r.settled_at IS NOT NULL AND p_status='success' THEN delta := -1;
 ELSIF p_status='failed' AND (r.status<>'failed' OR r.settled_at IS NULL) THEN delta := 1; END IF;
 IF delta<>0 THEN
  IF wd>0 THEN
   IF w.user_id IS NULL THEN RAISE EXCEPTION 'Original wallet missing'; END IF;
   UPDATE public.merchant_wallets SET available_balance=CASE WHEN main=r.currency THEN coalesce(available_balance,0)+delta*wd ELSE available_balance END,
    balances_by_currency=jsonb_set(coalesce(balances_by_currency,'{}'::jsonb),ARRAY[r.currency],to_jsonb(CASE WHEN main=r.currency THEN coalesce(available_balance,0) ELSE coalesce((balances_by_currency->>r.currency)::numeric,0) END+delta*wd)),
    total_payouts=CASE WHEN main=r.currency THEN coalesce(total_payouts,0)-delta*wd ELSE total_payouts END,updated_at=now() WHERE user_id=w.user_id;
  END IF;
  IF md>0 THEN PERFORM public.apply_merchant_balance_change(r.merchant_id,r.currency,delta*md,0,-delta*md); END IF;
 END IF;
 after_balance := before_balance+delta*(wd+md);
 UPDATE public.payment_records SET status=p_status,provider_reference=p_provider_reference,settled_at=now(),updated_at=now(),balance_applied_at=now(),fee_amount=fee,
 net_amount=CASE WHEN p_status='success' THEN wd+md-fee ELSE 0 END,
 metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('confirmation_actor',p_actor,'confirmation_reason',p_reason,'confirmation_evidence',p_evidence,'confirmation_at',now(),'confirmation_balance_before',before_balance,'confirmation_balance_after',after_balance)
 WHERE id=r.id;
 INSERT INTO public.audit_logs(user_id,action,resource,resource_id,details) VALUES(p_actor,'payout_status_confirmed','payment_records',r.id::text,jsonb_build_object('reference',r.reference,'previous_status',r.status,'status',p_status,'reason',p_reason,'provider_reference',p_provider_reference,'balance_before',before_balance,'balance_after',after_balance,'balance_change',delta*(wd+md),'evidence',p_evidence));
 RETURN jsonb_build_object('changed',true,'status',p_status,'reference',r.reference,'balance_before',before_balance,'balance_after',after_balance,'balance_change',delta*(wd+md),'currency',r.currency);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_payout_status(uuid,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payout_status(uuid,text,text,uuid,text,jsonb) TO service_role;