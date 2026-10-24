CREATE OR REPLACE FUNCTION public.reserve_payout_and_balance(p_merchant_id text, p_reference text, p_amount numeric, p_currency text, p_phone text, p_source text, p_description text, p_metadata jsonb DEFAULT '{}'::jsonb, p_debit numeric DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
 w public.merchant_wallets; b public.merchant_balances; r public.payment_records;
 main_currency text; wallet_available numeric := 0; available numeric; wallet_debit numeric; managed_debit numeric; debit numeric;
BEGIN
 debit := coalesce(p_debit, p_amount);
 IF p_amount <= 0 OR p_amount <> trunc(p_amount) OR debit <= 0 OR debit < p_amount OR p_currency NOT IN ('UGX','KES','RWF') THEN RAISE EXCEPTION 'Invalid payout amount or currency'; END IF;
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
 IF available < debit THEN RAISE EXCEPTION 'Insufficient balance. Available: % %.', available, p_currency; END IF;
 wallet_debit := least(greatest(wallet_available, 0), debit);
 managed_debit := debit - wallet_debit;
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
 coalesce(p_metadata,'{}'::jsonb)||jsonb_build_object('submission_state','submitting','balance_debited',true,'atomic_reservation',true,'wallet_debit',wallet_debit,'managed_debit',managed_debit,'total_debit',debit,'main_currency',main_currency,'balance_before',available,'balance_after',available-debit),now()) RETURNING * INTO r;
 RETURN to_jsonb(r);
END; $function$